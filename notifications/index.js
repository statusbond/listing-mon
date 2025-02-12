const slack = require('./slack');

function handleListingChange(listingDetails) {
  if (!listingDetails || !listingDetails.title) {
    console.error("Missing listing details or title");
    return;
  }

  const messagePayload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:remax: *STATUS CHANGE*\n` + 
                `${listingDetails.address}\n` +
                `${listingDetails.price}\n` +
                `${listingDetails.previousStatus} → ${listingDetails.newStatus}\n` +
                `Listing Agent: ${listingDetails.agentName}\n` +
                `Cell: ${listingDetails.agentPhone}`
        }
      }
    ]
  };

  slack.sendMessage(messagePayload);
}

module.exports = { handleListingChange };
