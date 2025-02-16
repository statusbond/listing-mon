const slack = require('./slack');

function handleListingChange(listingDetails) {
  if (!listingDetails || !listingDetails.title) {
    console.error("Missing listing details or title");
    return;
  }

  // Split the address by commas
  const addressParts = listingDetails.address.split(',');

  // Assume the last two parts are always City, State, Zip (to handle varying street address lengths)
  const cityStateZip = addressParts.slice(-2).join(',').trim(); // Get the last two elements
  const streetAddress = addressParts.slice(0, -2).join(',').trim(); // Everything before that is the street address

  const messagePayload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🏡 *LISTING STATUS CHANGE*\n` +  
                `${streetAddress}\n${cityStateZip}` +  
                `\n${listingDetails.price}\n` +
                `${listingDetails.newStatus}\n` +
                `Agent: ${listingDetails.agentName}\n` +
                `Cell: ${listingDetails.agentPhone}`
        }
      }
    ]
  };

  slack.sendMessage(messagePayload);
}

module.exports = { handleListingChange };
