const axios = require('axios');

const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!slackWebhookUrl) {
  console.error("SLACK_WEBHOOK_URL environment variable not set.");
}

function sendMessage(message) {
  if (!slackWebhookUrl) {
    console.error("Cannot send message: SLACK_WEBHOOK_URL not defined.");
    return;
  }
  
  axios.post(slackWebhookUrl, { text: message })
    .then(response => {
      console.log("Message sent to Slack successfully.");
    })
    .catch(error => {
      console.error("Error sending message to Slack:", error);
    });
}

module.exports = { sendMessage };
