const axios = require('axios');

const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!slackWebhookUrl) {
  console.error("SLACK_WEBHOOK_URL environment variable not set.");
}

/**
 * Sends a message to Slack.
 * @param {string|object} messagePayload - A plain text message or an object containing blocks, etc.
 */
function sendMessage(messagePayload) {
  if (!slackWebhookUrl) {
    console.error("Cannot send message: SLACK_WEBHOOK_URL not defined.");
    return;
  }
  
  // If messagePayload is a string, wrap it as { text: messagePayload }
  const payload = typeof messagePayload === 'string' ? { text: messagePayload } : messagePayload;
  
  axios.post(slackWebhookUrl, payload)
    .then(response => {
      console.log("Message sent to Slack successfully.");
    })
    .catch(error => {
      console.error("Error sending message to Slack:", error);
    });
}

module.exports = { sendMessage };
