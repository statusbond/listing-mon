const express = require('express');
const bodyParser = require('body-parser');
const { handleListingChange } = require('./notifications');

const app = express();
app.use(bodyParser.json());

// Endpoint to handle listing changes
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
})
