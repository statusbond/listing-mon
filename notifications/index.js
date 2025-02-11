const slack = require('./slack');

function handleListingChange(listingDetails) {
  // Check if listingDetails is provided and has the expected properties
  if (!listingDetails || !listingDetails.title) {
    console.error("Missing listing details or title");
    return;
  }
  
  // Compose and send the Slack message
  const message = `New listing: ${listingDetails.title}`;
  slack.sendMessage(message);
}

module.exports = { handleListingChange };
