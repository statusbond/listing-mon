const slack = require('./slack');

function handleListingChange(listingDetails) {
  if (!listingDetails || !listingDetails.title) {
    console.error("Missing listing details or title");
    return;
  }

  const messagePayload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🏡 Listing Status Change`,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*📍 Address:* ${listingDetails.address}`
          },
          {
            type: "mrkdwn",
            text: `*💰 Price:* ${listingDetails.price}`
          },
          {
            type: "mrkdwn",
            text: `*🔄 Status:* ${listingDetails.previousStatus} → *${listingDetails.newStatus}*`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📜 *Description:*\n${listingDetails.description}`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*👤 Listing Agent:* ${listingDetails.agentName}`
          },
          {
            type: "mrkdwn",
            text: `*📞 Cell:* ${listingDetails.agentPhone}`
          }
        ]
      }
    ]
  };

  slack.sendMessage(messagePayload);
}

module.exports = { handleListingChange };
