const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { handleListingChange } = require('./notifications');

const LAST_TIMESTAMP_FILE = path.join(__dirname, 'last_timestamp.txt');

// Function to retrieve the last checked timestamp
async function getLastCheckedTimestamp() {
  try {
    if (fs.existsSync(LAST_TIMESTAMP_FILE)) {
      return fs.readFileSync(LAST_TIMESTAMP_FILE, 'utf8').trim();
    }
  } catch (error) {
    console.error("Error reading last checked timestamp:", error);
  }
  return null;
}

// Function to save the latest checked timestamp
async function saveLastCheckedTimestamp(timestamp) {
  try {
    fs.writeFileSync(LAST_TIMESTAMP_FILE, timestamp, 'utf8');
  } catch (error) {
    console.error("Error saving last checked timestamp:", error);
  }
}

// Function to check for new listing status changes
async function checkForNewListings() {
  const lastTimestamp = await getLastCheckedTimestamp();
  console.log(`Last checked timestamp: ${lastTimestamp || "None (First Run)"}`);

  // Construct Spark API query with filtering for office ID and timestamp
  let sparkApiUrl = `https://replication.sparkapi.com/Reso/OData/Property?$filter=ListOfficeMlsId eq 'ocRMKP'`;

  if (lastTimestamp) {
    sparkApiUrl += ` and StatusChangeTimestamp gt '${lastTimestamp}'`;
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

    const properties = response.data.value;
    if (!properties || properties.length === 0) {
      console.log("No new listings found.");
      return;
    }

    for (const property of properties) {
      const formattedPrice = property.ListPrice ? `$${property.ListPrice.toLocaleString()}` : "N/A";
      const addressParts = property.UnparsedAddress.split(',').map(part => part.trim());

      const slackMessage = `STATUS CHANGE
${addressParts[0]}
${addressParts.slice(1).join(', ')}

${formattedPrice}
→ ${property.StandardStatus}

Agent: ${property.ListAgentFullName}
Cell: ${property.ListAgentPreferredPhone}`;

      handleListingChange(slackMessage);
    }

    // Save the timestamp of the latest listing change
    if (properties.length > 0) {
      const latestTimestamp = properties[0].StatusChangeTimestamp;
      await saveLastCheckedTimestamp(latestTimestamp);
    }
  } catch (error) {
    console.error("Error fetching property data from Spark API:", error.response?.data || error.message);
  }
}

// Run the polling function when the script starts
(async () => {
  await checkForNewListings();
})();
