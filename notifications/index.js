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
          text: `🏡 *STATUS CHANGE*\n` + 
                `*${listingDetails.address}*\n` +
                `*${listingDetails.previousStatus} → ${listingDetails.newStatus}*\n` +
                `*${listingDetails.price}*\n` +
                `*Days on Market:* ${listingDetails.daysOnMarket}\n` +
                `*Listing Agent:* ${listingDetails.agentName}\n` +
                `*Cell:* ${listingDetails.agentPhone}`
        }
      }
    ]
  };

  slack.sendMessage(messagePayload);
}

module.exports = { handleListingChange };
