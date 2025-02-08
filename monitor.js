require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// Main function to handle listing changes
async function handleListingChange(notification) {
    const listingId = notification.Listing.Id;
    const changeType = notification.NewsFeed.Event;
    const listingDetails = await getListingDetails(listingId, process.env.SPARK_ACCESS_TOKEN);

    switch (changeType) {
        case 'StatusChange':
            await sendStatusChangeNotification(
                listingDetails,
                notification.OldStatus,
                notification.NewStatus
            );
            break;
        case 'PriceChange':
            await sendPriceChangeNotification(
                listingDetails,
                notification.OldPrice,
                notification.NewPrice
            );
            break;
        default:
            console.log(`Unhandled change type: ${changeType}`);
    }
}

// Status change notification with simplified agent info
async function sendStatusChangeNotification(listingDetails, oldStatus, newStatus) {
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
                        "text": `*Listing Agent:*\n${listingDetails.agent}\n${listingDetails.agentCell || 'No phone'}`
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
                        "text": `*Property:*\n${listingDetails.address}\n${listingDetails.city}, ${listingDetails.state}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Price:* $${listingDetails.price.toLocaleString()}`
                    }
                ]
            }
        ]
    };

    await sendSlackMessage(message);
}

// Price change notification with simplified agent info
async function sendPriceChangeNotification(listingDetails, oldPrice, newPrice) {
    const priceChange = newPrice - oldPrice;
    const changePercent = ((priceChange / oldPrice) * 100).toFixed(1);
    const changeDirection = priceChange > 0 ? "⬆️ Price Increase" : "⬇️ Price Reduction";
    
    const message = {
        blocks: [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `${changeDirection} Alert!`
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Listing Agent:*\n${listingDetails.agent}\n${listingDetails.agentCell || 'No phone'}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Price Change:*\n$${oldPrice.toLocaleString()} → $${newPrice.toLocaleString()}\n${changePercent}% (${priceChange > 0 ? '+' : ''}$${priceChange.toLocaleString()})`
                    }
                ]
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Property:*\n${listingDetails.address}\n${listingDetails.city}, ${listingDetails.state}`
                    }
                ]
            }
        ]
    };

    await sendSlackMessage(message);
}

// Simplified getListingDetails function
async function getListingDetails(listingId, accessToken) {
    const response = await fetch(`https://sparkplatform.com/api/v1/listings/${listingId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    const data = await response.json();
    const fields = data.D.Results[0].StandardFields;
    
    return {
        address: `${fields.StreetNumber} ${fields.StreetName} ${fields.StreetSuffix || ''} ${fields.StreetDirSuffix || ''}`,
        city: fields.City,
        state: fields.StateOrProvince,
        price: fields.ListPrice,
        agent: `${fields.ListAgentFirstName} ${fields.ListAgentLastName}`,
        agentCell: fields.ListAgentCellPhone
    };
}

// Generic function to send messages to Slack
async function sendSlackMessage(message) {
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

// Endpoint that receives webhook notifications from Spark API
app.post('/webhook', async (req, res) => {
    try {
        await handleListingChange(req.body);
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
                    Uri: process.env.PUBLIC_WEBHOOK_URL,
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
