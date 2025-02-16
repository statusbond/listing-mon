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

  // Use the known good query for office key filtering for Remax.
  let sparkApiUrl = `https://replication.sparkapi.com/Reso/OData/Property?$filter=ListOfficeKey eq '20200217215042865159000000'`;

  if (lastTimestamp) {
    sparkApiUrl += ` and StatusChangeTimestamp gt ${lastTimestamp}`;
  }

  sparkApiUrl += `&$orderby=StatusChangeTimestamp desc&$select=UnparsedAddress,ListPrice,StandardStatus,StatusChangeTimestamp,ListAgentFullName,ListAgentPreferredPhone`;

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

    let latestTimestamp = lastTimestamp;

    for (const listing of listings) {
      const formattedAddress = listing.UnparsedAddress || "No Address";
      const formattedPrice = listing.ListPrice ? `$${listing.ListPrice.toLocaleString()}` : "N/A";
      const agentName = listing.ListAgentFullName || "Unknown Agent";
      const agentPhone = listing.ListAgentPreferredPhone || "No Phone Available";
      const newStatus = listing.StandardStatus;
      const timestamp = listing.StatusChangeTimestamp;

      // Send Slack message
      handleListingChange({
        title: "Listing Status Change",
        price: formattedPrice,
        address: formattedAddress,
        newStatus: newStatus,
        agentName: agentName,
        agentPhone: agentPhone
      });

      // Update the latest timestamp if this one is newer
      if (!latestTimestamp || timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
      }
    }

    // Save the most recent timestamp for the next run
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
