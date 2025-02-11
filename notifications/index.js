const slack = require('./slack');

function handleListingChange(listingDetails) {
  // Validate that listingDetails has at least a title.
  if (!listingDetails || !listingDetails.title) {
    console.error("Missing listing details or title");
    return;
  }
  
  let messagePayload;
  
  // Check if we have extra details for richer formatting.
  if (listingDetails.price || listingDetails.address || listingDetails.description) {
    messagePayload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "New Listing Detected",
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Title:*\n${listingDetails.title}`
            },
            // Only include these fields if they exist.
            ...(listingDetails.price ? [{
              type: "mrkdwn",
              text: `*Price:*\n${listingDetails.price}`
            }] : []),
            ...(listingDetails.address ? [{
              type: "mrkdwn",
              text: `*Address:*\n${listingDetails.address}`
            }] : [])
          ]
        },
        // Add description if it exists.
        ...(listingDetails.description ? [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Description:*\n${listingDetails.description}`
          }
        }] : [])
      ]
    };
  } else {
    // Fallback: send a simple text message.
    messagePayload = { text: `New listing: ${listingDetails.title}` };
  }
  
  slack.sendMessage(messagePayload);
}

module.exports = { handleListingChange };
