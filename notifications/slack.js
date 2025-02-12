const axios = require('axios');

const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!slackWebhookUrl) {
  console.error("SLACK_WEBHOOK_URL environment variable not set.");
}

function sendMessage(messagePayload) {
  if (!slackWebhookUrl) {
    console.error("Cannot send message: SLACK_WEBHOOK_URL not defined.");
    return;
  }
  
  axios.post(slackWebhookUrl, messagePayload)
    .then(response => {
      console.log("Message sent to Slack successfully.");
    })
    .catch(error => {
      console.error("Error sending message to Slack:", error);
    });
}

module.exports = { sendMessage };
