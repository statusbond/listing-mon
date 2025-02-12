const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { handleListingChange } = require('./notifications');
const { getPreviousStatus, saveStatus } = require('./helpers/statusTracker');

const app = express();
app.use(bodyParser.json());

// Root Status Route
app.get('/', (req, res) => {
  res.send(
    'Service is running. Use POST /listing-change to send listing data, GET /test-spark to check for live listing status changes.'
  );
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

// GET route to check for listing status changes
app.get('/test-spark', async (req, res) => {
  const sparkApiUrl = 'https://replication.sparkapi.com/Reso/OData/Property?$orderby=ModificationTimestamp desc&$top=5';

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
      const listingId = property.ListingId;
      const newStatus = property.StandardStatus;
      const previousStatus = await getPreviousStatus(listingId);

      if (newStatus !== previousStatus) {
        // Format Address (remove ZIP)
        const formattedAddress = `${property.StreetNumber || ''} ${property.StreetName || ''}, ${property.City || ''}, ${property.StateOrProvince || ''}`.trim();

        // Format Price with Commas
        const formattedPrice = property.ListPrice ? `$${property.ListPrice.toLocaleString()}` : "N/A";

        // Extract Listing Agent Info
        const agentName = property.ListAgentFullName || "Unknown Agent";
        const agentPhone = property.ListAgentPreferredPhone || "No Phone Available";

        const listingDetails = {
          title: `Listing Status Change`,
          price: formattedPrice,
          address: formattedAddress,
          description: property.PublicRemarks || "No description available.",
          newStatus: newStatus,
          previousStatus: previousStatus,
          agentName: agentName,
          agentPhone: agentPhone
        };

        await saveStatus(listingId, newStatus);
        handleListingChange(listingDetails);
      }
    }

    res.send("Checked for status changes. If any were found, messages were sent.");
  } catch (error) {
    console.error("Error fetching property data from Spark API:", error.response?.data || error.message);
    res.status(500).send("Error fetching property data from Spark API.");
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
