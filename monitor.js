// Simple Listing Monitor with Slack notifications
require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// Function to send notification to Slack
async function sendSlackNotification(listingDetails, oldStatus, newStatus) {
    // Create a nice looking Slack message
    const message = {
        blocks: [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🏠 Listing Status Change Alert!"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Address:*\n${listingDetails.address}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Status Change:*\n${oldStatus} → ${newStatus}`
                    }
                ]
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Price:* $${listingDetails.price.toLocaleString()}\n*Agent:* ${listingDetails.agent}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Beds:* ${listingDetails.beds}\n*Baths:* ${listingDetails.baths}`
                    }
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `Time: ${new Date().toLocaleString()}`
                    }
                ]
            }
        ]
    };

    // Send to Slack
    try {
        const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            throw new Error('Failed to send to Slack');
        }
    } catch (error) {
        console.error('Error sending to Slack:', error);
    }
}

// Function to get listing details from Spark API
async function getListingDetails(listingId, accessToken) {
    const response = await fetch(`https://sparkplatform.com/api/v1/listings/${listingId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    const data = await response.json();
    
    return {
        address: data.UnparsedAddress,
        price: data.ListPrice,
        beds: data.BedsTotal,
        baths: data.BathsTotal,
        agent: data.ListAgentFullName
    };
}

// Endpoint that receives webhook notifications from Spark API
app.post('/webhook', async (req, res) => {
    try {
        // Get the notification details
        const notification = req.body;
        const listingId = notification.Listing.Id;
        
        // Get the full listing details
        const listingDetails = await getListingDetails(
            listingId, 
            process.env.SPARK_ACCESS_TOKEN
        );
        
        // Send Slack notification
        await sendSlackNotification(
            listingDetails,
            notification.OldStatus,
            notification.NewStatus
        );
        
        // Let Spark API know we received the webhook successfully
        res.json({ success: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Failed to process notification' });
    }
});

// Register the webhook with Spark API when the app starts
async function registerSparkWebhook() {
    try {
        const response = await fetch('https://sparkplatform.com/api/v1/developers/newsfeeds/webhooks', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                D: {
                    Uri: process.env.PUBLIC_WEBHOOK_URL,  // Your public URL
                    Active: true
                }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to register webhook');
        }
        
        console.log('Spark webhook registered successfully');
    } catch (error) {
        console.error('Error registering webhook:', error);
    }
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await registerSparkWebhook();
});