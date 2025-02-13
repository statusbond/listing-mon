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

    await saveLastCheckedTimestamp(properties[0].StatusChangeTimestamp);
  } catch (error) {
    console.error("Error fetching property data from Spark API:", error.response?.data || error.message);
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

// Polling function (runs every X minutes)
setInterval(checkForNewListings, 60000); // Run every 60 seconds

module.exports = { checkForNewListings };
