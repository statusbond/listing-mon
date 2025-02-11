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
  // Use the RESO OData endpoint for all properties.
  const sparkApiUrl = 'https://replication.sparkapi.com/Reso/OData/Property';

  try {
    const response = await axios.get(sparkApiUrl, {
      headers: {
        'User-Agent': 'MySparkClient/1.0',  // Replace with your client identifier if needed
        'Accept': 'application/json'
      }
    });

    // Assuming the response data is in OData format with a "value" array.
    const properties = response.data.value;
    if (!properties || properties.length === 0) {
      return res.status(404).send("No property data found from Spark API.");
    }

    // Select the first property for testing.
    const property = properties[0];

    // Map fields from the property to the format expected by your Slack notification.
    // Adjust these field names based on the actual RESO API response.
    const listingDetails = {
      title: property.PropertyType || "Property",  // Use a relevant title field
      price: property.ListPrice ? `$${property.ListPrice}` : "N/A",
      address: `${property.StreetNumber || ''} ${property.StreetName || ''}, ${property.City || ''}, ${property.StateOrProvince || ''} ${property.PostalCode || ''}`.trim(),
      description: property.PublicRemarks || "No description available."
    };

    // Send the formatted listing details to Slack.
    handleListingChange(listingDetails);
    res.send("Test message sent to Slack using Spark API data. Check your Slack channel!");
  } catch (error) {
    console.error("Error fetching property data from Spark API:", error.message);
    res.status(500).send("Error fetching property data from Spark API.");
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
