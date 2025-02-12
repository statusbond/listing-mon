const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { handleListingChange } = require('./notifications');

const app = express();
app.use(bodyParser.json());

// GET route for root status
app.get('/', (req, res) => {
  res.send(
    'Service is running. Use POST /listing-change to send listing data, GET /test for sample data, or GET /test-spark to fetch and send a listing from Spark API.'
  );
});

// POST endpoint for external listing change events
app.post('/listing-change', (req, res) => {
  const listingDetails = req.body;

  try {
    handleListingChange(listingDetails);
    res.status(200).send("Listing change processed successfully.");
  } catch (error) {
    console.error("Error processing listing change:", error);
    res.status(500).send("Error processing listing change.");
  }
});

// GET endpoint to send a sample test message to Slack
app.get('/test', (req, res) => {
  const testListing = {
    title: "Test Listing",
    price: "$500,000",
    address: "123 Test St, Test City, Test Country",
    description: "This is a sample test listing to check Slack formatting."
  };

  try {
    handleListingChange(testListing);
    res.send("Test message sent to Slack using sample data. Check your Slack channel!");
  } catch (error) {
    console.error("Error sending test message:", error);
    res.status(500).send("Error sending test message to Slack.");
  }
});

// GET endpoint to fetch a live listing from Spark API and send it to Slack
app.get('/test-spark', async (req, res) => {
  const sparkApiUrl = 'https://replication.sparkapi.com/Reso/OData/Property';

  try {
    const response = await axios.get(sparkApiUrl, {
      headers: {
        'User-Agent': 'MySparkClient/1.0',  // Replace if needed
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`  // Using stored Spark Access Token
      }
    });

    const properties = response.data.value;
    if (!properties || properties.length === 0) {
      return res.status(404).send("No property data found from Spark API.");
    }

    const property = properties[0]; // Fetch first available property for testing

    const listingDetails = {
      title: property.PropertyType || "Property",
      price: property.ListPrice ? `$${property.ListPrice}` : "N/A",
      address: `${property.StreetNumber || ''} ${property.StreetName || ''}, ${property.City || ''}, ${property.StateOrProvince || ''} ${property.PostalCode || ''}`.trim(),
      description: property.PublicRemarks || "No description available."
    };

    handleListingChange(listingDetails);
    res.send("Test message sent to Slack using Spark API data. Check your Slack channel!");
  } catch (error) {
    console.error("Error fetching property data from Spark API:", error.response?.data || error.message);
    res.status(500).send("Error fetching property data from Spark API.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
