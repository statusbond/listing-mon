const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { handleListingChange } = require('./notifications');

const TIMESTAMP_FILE = path.join(__dirname, 'last_timestamp.txt'); // File to store last timestamp

async function getLastCheckedTimestamp() {
  try {
    if (fs.existsSync(TIMESTAMP_FILE)) {
      return fs.readFileSync(TIMESTAMP_FILE, 'utf8').trim();
    }
  } catch (error) {
    console.error("Error reading timestamp file:", error);
  }
  return null; // Return null if no previous timestamp exists
}

async function saveLastCheckedTimestamp(timestamp) {
  try {
    fs.writeFileSync(TIMESTAMP_FILE, timestamp, 'utf8');
  } catch (error) {
    console.error("Error saving timestamp file:", error);
  }
}

async function checkForNewListings() {
  const lastTimestamp = await getLastCheckedTimestamp();
  console.log(`Last checked timestamp: ${lastTimestamp || "None (First Run)"}`);

  let sparkApiUrl = `https://replication.sparkapi.com/Reso/OData/Property?$filter=ListOfficeMlsId eq 'ocRMKP'`;

  if (lastTimestamp) {
    sparkApiUrl += ` and StatusChangeTimestamp gt ${lastTimestamp}`;
  }

  sparkApiUrl += `&$orderby=StatusChangeTimestamp desc&$select=UnparsedAddress,ListPrice,StandardStatus,StatusChangeTimestamp,ListAgentFullName,ListAgentPreferredPhone,ListOfficeMlsId`;

  try {
    const response = await axios.get(sparkApiUrl, {
      headers: {
        'User-Agent': 'MySparkClient/1.0',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`
      }
    });

    const listings = response.data.value;
    if (!listings || listings.length === 0) {
      console.log("No new listings found.");
      return;
    }

    // In production (main), if this is the first run (no lastTimestamp), update the timestamp without sending notifications.
    if (!lastTimestamp && process.env.NODE_ENV === 'production') {
      // Find the most recent timestamp among the returned listings.
      const latestTimestamp = listings.reduce((acc, listing) => {
        return (!acc || listing.StatusChangeTimestamp > acc) ? listing.StatusChangeTimestamp : acc;
      }, null);
      console.log("First run in production: updating last timestamp to", latestTimestamp, "without sending notifications.");
      await saveLastCheckedTimestamp(latestTimestamp);
      return;
    }

    let latestTimestamp = lastTimestamp;

    for (const listing of listings) {
      const formattedAddress = listing.UnparsedAddress || "No Address";
      const formattedPrice = listing.ListPrice ? `$${listing.ListPrice.toLocaleString()}` : "N/A";
      const agentName = listing.ListAgentFullName || "Unknown Agent";
      const agentPhone = listing.ListAgentPreferredPhone || "No Phone Available";
      const newStatus = listing.StandardStatus;
      const timestamp = listing.StatusChangeTimestamp;

      // Send Slack message for each new listing.
      handleListingChange({
        title: "Listing Status Change",
        price: formattedPrice,
        address: formattedAddress,
        newStatus: newStatus,
        agentName: agentName,
        agentPhone: agentPhone
      });

      if (!latestTimestamp || timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
      }
    }

    if (latestTimestamp) {
      await saveLastCheckedTimestamp(latestTimestamp);
    }
  } catch (error) {
    console.error("Error fetching property data from Spark API:", error.response?.data || error.message);
  }
}

// Polling function (runs every 60 seconds)
setInterval(checkForNewListings, 60000);

module.exports = { checkForNewListings };
