const slack = require('./slack');

function handleListingChange(listingDetails) {
  if (!listingDetails || !listingDetails.title) {
    console.error("Missing listing details or title");
    return;
  }

  // Split the address into street and city/state/zip
  const addressParts = listingDetails.address.split(',');
  const streetAddress = addressParts[0].trim();
  const cityStateZip = addressParts.slice(1).join(',').trim();

  const messagePayload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🏡 *LISTING STATUS CHANGE*\n` +  // Updated text for first line
                `${streetAddress}\n${cityStateZip}` +  // No extra new lines
                `\n${listingDetails.price}\n` +
                `${listingDetails.newStatus}\n` +
                `Agent: ${listingDetails.agentName}\n` +  // Changed from "Listing Agent" to "Agent"
                `Cell: ${listingDetails.agentPhone}`
        }
      }
    ]
  };

  slack.sendMessage(messagePayload);
}

module.exports = { handleListingChange };
