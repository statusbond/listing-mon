const express = require('express');
const bodyParser = require('body-parser');
const { handleListingChange } = require('./notifications');

const app = express();
app.use(bodyParser.json());

// GET route for the root (simple status message)
app.get('/', (req, res) => {
  res.send('Service is running. Use POST /listing-change to send listing data or GET /test to send a formatted test message to Slack.');
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

// GET endpoint for testing the formatted Slack notification
app.get('/test', (req, res) => {
  // Create a sample test listing with extra details
  const testListing = {
    title: "Test Listing",
    price: "$500,000",
    address: "123 Test St, Test City, Test Country",
    description: "This is a sample test listing to check the Slack formatting. Contact the agent for more details."
  };
  
  try {
    handleListingChange(testListing);
    res.send("Test formatted message sent to Slack. Check your Slack channel!");
  } catch (error) {
    console.error("Error sending test message:", error);
    res.status(500).send("Error sending test message to Slack.");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
