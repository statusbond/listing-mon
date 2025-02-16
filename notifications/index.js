const slack = require('./slack');

function handleListingChange(listingDetails) {
  if (!listingDetails || !listingDetails.title) {
    console.error("Missing listing details or title");
    return;
  }

  // Split the address into street and city/state/zip (assuming a standard format)
  const addressParts = listingDetails.address.split(',');
  const streetAddress = addressParts[0].trim();
  const cityStateZip = addressParts.slice(1).join(',').trim();

  const messagePayload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🏡 *STATUS CHANGE*\n` +
                `*${streetAddress}*\n${cityStateZip}\n\n` +
                `${listingDetails.price}\n` +
                `${listingDetails.newStatus}\n` +
                `Listing Agent: ${listingDetails.agentName}\n` +
                `Cell: ${listingDetails.agentPhone}`
        }
      }
    ]
  };

  slack.sendMessage(messagePayload);
}

module.exports = { handleListingChange };
