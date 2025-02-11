const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { handleListingChange } = require('./notifications');

const app = express();
app.use(bodyParser.json());

// GET route for the root (simple status message)
app.get('/', (req, res) => {
  res.send(
    'Service is running. Use POST /listing-change to send listing data, GET /test for sample data, GET /test-api for a generic API test, or GET /test-spark to send a test message using Spark API data.'
  );
});

// POST endpoint to handle listing changes from an external source
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

// GET endpoint for testing the formatted Slack notification with sample data
app.get('/test', (req, res) => {
  const testListing = {
    title: "Test Listing",
    price: "$500,000",
    address: "123 Test St, Test City, Test Country",
    description: "This is a sample test listing to check the Slack formatting. Contact the agent for more details."
  };
  
  try {
    handleListingChange(testListing);
    res.send("Test formatted message sent to Slack using sample data. Check your Slack channel!");
  } catch (error) {
    console.error("Error sending test message:", error);
    res.status(500).send("Error sending test message to Slack.");
  }
});

// GET endpoint for testing the formatted Slack notification using data from a generic API
app.get('/test-api', async (req, res) => {
  // Replace with your actual API endpoint if needed
  const apiUrl = 'https://api.example.com/listings/123';
  
  try {
    const response = await axios.get(apiUrl);
    const listingData = response.data;
    handleListingChange(listingData);
    res.send("Test message sent to Slack using API data. Check your Slack channel!");
  } catch (error) {
    console.error("Error fetching listing data from API:", error);
    res.status(500).send("Error fetching listing data from API.");
  }
});

// GET endpoint for testing the formatted Slack notification using data from the Spark API
app.get('/test-spark', async (req, res) => {
  // Construct the API URL using your provided Spark API endpoint.
  // Adjust the listing ID ('123') as needed.
  const sparkApiUrl = 'https://replication.sparkapi.com/listings/123';
  
  try {
    const response = await axios.get(sparkApiUrl);
    const sparkListingData = response.data;
    
    // Map the Spark API fields to the fields expected by handleListingChange.
    // If the Spark API returns different property names, adjust this mapping accordingly.
    const listingDetails = {
      title: sparkListingData.listing_title || sparkListingData.title,
      price: sparkListingData.listing_price || sparkListingData.price,
      address: sparkListingData.listing_address || sparkListingData.address,
      description: sparkListingData.listing_description || sparkListingData.description
    };

    handleListingChange(listingDetails);
    res.send("Test message sent to Slack using Spark API data. Check your Slack channel!");
  } catch (error) {
    console.error("Error fetching listing data from Spark API:", error);
    res.status(500).send("Error fetching listing data from Spark API.");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
