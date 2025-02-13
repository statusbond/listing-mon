const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const { handleListingChange } = require('./notifications');
// Removed previous status functions (getPreviousStatus and saveStatus) if they were solely used for previous status tracking.
// If you still want to update a stored status for deduplication purposes, you can keep saveStatus, but we'll omit previous status from messages.

const app = express();
app.use(bodyParser.json());

// Serve the Slack test page
app.use(express.static('public'));

// Root Status Route
app.get('/', (req, res) => {
  res.send(
    'Service is running. Use POST /listing-change to send listing data, GET /test-spark to check for live listing status changes, or visit /slack-test to send Slack test messages.'
  );
});

// Serve the Slack test page
app.get('/slack-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'slack-test.html'));
});

// POST route to manually test listing changes
app.post('/listing-change', (req, res) => {
  try {
    handleListingChange(req.body);
    res.status(200).send("Listing change processed successfully.");
  } catch (error) {
    console.error("Error processing listing change:", error);
    res.status(500).send("Error processing listing change.");
  }
});

// GET route to check for listing status changes (Sorted by `StatusChangeTimestamp`)
app.get('/test-spark', async (req, res) => {
  const sparkApiUrl = 'https://replication.sparkapi.com/Reso/OData/Property?$orderby=StatusChangeTimestamp desc&$top5';

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
      return res.status(404).send("No property data found from Spark API.");
    }

    for (const property of properties) {
      // Using only current status; no previous status tracking in the Slack message.
      const newStatus = property.StandardStatus;

      // Format Address (you can adjust if needed)
      const formattedAddress = `${property.StreetNumber || ''} ${property.StreetName || ''}, ${property.City || ''}, ${property.StateOrProvince || ''}`.trim();

      // Format Price with commas
      const formattedPrice = property.ListPrice ? `$${property.ListPrice.toLocaleString()}` : "N/A";

      // Extract Listing Agent Info
      const agentName = property.ListAgentFullName || "Unknown Agent";
      const agentPhone = property.ListAgentPreferredPhone || "No Phone Available";

      // Build the Slack message details (only current status is included, with an arrow)
      const listingDetails = {
        title: `Listing Status Change`,
        price: formattedPrice,
        address: formattedAddress,
        description: property.PublicRemarks || "No description available.",
        // Simply show an arrow and the new status.
        newStatus: `→ ${newStatus}`,
        agentName: agentName,
        agentPhone: agentPhone
      };

      // Optionally, if you have a function to store the latest status, you can call it here.
      // await saveStatus(property.ListingId, newStatus);

      // Send the Slack notification
      handleListingChange(listingDetails);
    }

    res.send("Checked for status changes. Slack messages were sent if updates were found.");
  } catch (error) {
    console.error("Error fetching property data from Spark API:", error.response?.data || error.message);
    res.status(500).send("Error fetching property data from Spark API.");
  }
});

// GET route to fetch and send Slack test messages (Sorted by `StatusChangeTimestamp`)
app.get('/send-slack-test', async (req, res) => {
  const status = req.query.status || "Active"; // Default to Active if no status provided
  const sparkApiUrl = `https://replication.sparkapi.com/Reso/OData/Property?$filter=StandardStatus eq '${status}'&$orderby=StatusChangeTimestamp desc&$top5`;

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
      return res.status(404).send(`No ${status} properties found.`);
    }

    for (const property of p
