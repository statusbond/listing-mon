const slack = require('./slack');

function handleListingChange(listingDetails) {
  if (!listingDetails || !listingDetails.title) {
    console.error("Missing listing details or title");
    return;
  }

  // Format phone number as an SMS link
  const smsLink = `<sms:${listingDetails.agentPhone}|${listingDetails.agentPhone}>`;

  const messagePayload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🏡 *STATUS CHANGE*\n` + 
                `${listingDetails.address}\n` +
                `${listingDetails.price}\n` +  // Price moved below address
                `${listingDetails.previousStatus} → ${listingDetails.newStatus}\n` +
                `Days on Market: ${listingDetails.daysOnMarket}\n` +
                `Listing Agent: ${listingDetails.agentName}\n` +
                `Cell: ${smsLink}`
        }
      }
    ]
  };

  slack.sendMessage(messagePayload);
}

module.exports = { handleListingChange };
