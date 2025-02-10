// Slack notification handler
async function sendSlackMessage(message) {
    try {
        console.log('Attempting to send to Slack webhook:', process.env.SLACK_WEBHOOK_URL);
        
        const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Slack response error:', {
                status: response.status,
                statusText: response.statusText,
                errorBody: errorText
            });
            throw new Error(`Failed to send to Slack: ${response.status} ${response.statusText}`);
        }

        console.log('Successfully sent message to Slack');
    } catch (error) {
        console.error('Slack error:', error);
        throw error;
    }
}

async function sendStatusChangeSlack(listingDetails, oldStatus, newStatus) {
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
                        "text": `*Property:*\n${listingDetails.address}\n${listingDetails.city}, ${listingDetails.state} ${listingDetails.zip}`
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

async function sendPriceChangeSlack(listingDetails, oldPrice, newPrice) {
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
                        "text": `*Property:*\n${listingDetails.address}\n${listingDetails.city}, ${listingDetails.state} ${listingDetails.zip}`
                    }
                ]
            }
        ]
    };

    await sendSlackMessage(message);
}

async function sendOpenHouseSlack(listingDetails, openHouse) {
    const message = {
        blocks: [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📅 New Open House Alert!"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Open House:*\n${openHouse.Date}\n${openHouse.StartTime} - ${openHouse.EndTime}`
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Listing Agent:*\n${listingDetails.agent}\n${listingDetails.agentCell || 'No phone'}`
                    }
                ]
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Property:*\n${listingDetails.address}\n${listingDetails.city}, ${listingDetails.state} ${listingDetails.zip}`
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

module.exports = {
    sendStatusChangeSlack,
    sendPriceChangeSlack,
    sendOpenHouseSlack
};
