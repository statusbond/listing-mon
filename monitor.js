require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// Sample listing data for testing
const sampleListings = [
    {
        Id: "20060412165917817933000000",
        StandardFields: {
            ListingId: "10-1796",
            StreetNumber: "611",
            StreetName: "8th",
            StreetSuffix: "St",
            StreetDirSuffix: "S",
            City: "Fargo",
            StateOrProvince: "ND",
            ListPrice: 1079900,
            BedsTotal: 8,
            BathsTotal: 8,
            ListAgentFirstName: "Joe",
            ListAgentLastName: "Agent",
            ListAgentCellPhone: "123-456-7890",
            Photos: [{
                Primary: true,
                Uri300: "https://photos.sparkplatform.com/example.jpg"
            }]
        }
    },
    {
        Id: "20060412165917817933000001",
        StandardFields: {
            ListingId: "10-1797",
            StreetNumber: "123",
            StreetName: "Main",
            StreetSuffix: "Ave",
            City: "Fargo",
            StateOrProvince: "ND",
            ListPrice: 450000,
            BedsTotal: 4,
            BathsTotal: 3,
            ListAgentFirstName: "Jane",
            ListAgentLastName: "Smith",
            ListAgentCellPhone: "123-555-7890",
            Photos: [{
                Primary: true,
                Uri300: "https://photos.sparkplatform.com/example2.jpg"
            }]
        }
    }
];

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

// Enhanced getListingDetails function to include photo
async function getListingDetails(listingId, accessToken) {
    // For testing, return mock data if no access token
    if (!accessToken) {
        const sampleListing = sampleListings.find(l => l.Id === listingId);
        if (sampleListing) {
            const fields = sampleListing.StandardFields;
            return {
                address: `${fields.StreetNumber} ${fields.StreetName} ${fields.StreetSuffix || ''} ${fields.StreetDirSuffix || ''}`,
                city: fields.City,
                state: fields.StateOrProvince,
                price: fields.ListPrice,
                agent: `${fields.ListAgentFirstName} ${fields.ListAgentLastName}`,
                agentCell: fields.ListAgentCellPhone,
                photoUrl: fields.Photos?.[0]?.Uri300 || null
            };
        }
    }

    const response = await fetch(`https://sparkplatform.com/api/v1/listings/${listingId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    const data = await response.json();
    const fields = data.D.Results[0].StandardFields;
    
    // Find the primary photo if available, use smaller Uri300 size
    const primaryPhoto = fields.Photos?.find(p => p.Primary)?.Uri300 || 
                        fields.Photos?.[0]?.Uri300;

    return {
        address: `${fields.StreetNumber} ${fields.StreetName} ${fields.StreetSuffix || ''} ${fields.StreetDirSuffix || ''}`,
        city: fields.City,
        state: fields.StateOrProvince,
        price: fields.ListPrice,
        agent: `${fields.ListAgentFirstName} ${fields.ListAgentLastName}`,
        agentCell: fields.ListAgentCellPhone,
        photoUrl: primaryPhoto
    };
}

// Simplified status change notification with smaller image
async function sendStatusChangeNotification(listingDetails, oldStatus, newStatus) {
    const message = {
        blocks: [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🏠 Listing Status Change Alert!"
                }
            }
        ]
    };

    // Add image if available (using smaller size)
    if (listingDetails.photoUrl) {
        message.blocks.push({
            "type": "image",
            "title": {
                "type": "plain_text",
                "text": listingDetails.address
            },
            "image_url": listingDetails.photoUrl,
            "alt_text": "Property image"
        });
    }

    // Add main info
    message.blocks.push(
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
    );

    await sendSlackMessage(message);
}

// Price change notification with smaller image
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
            }
        ]
    };

    // Add image if available
    if (listingDetails.photoUrl) {
        message.blocks.push({
            "type": "image",
            "title": {
                "type": "plain_text",
                "text": listingDetails.address
            },
            "image_url": listingDetails.photoUrl,
            "alt_text": "Property image"
        });
    }

    message.blocks.push(
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
    );

    await sendSlackMessage(message);
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

// Test interface route
app.get('/test-interface', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Listing Status Test Interface</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                .listing { border: 1px solid #ccc; padding: 10px; margin: 10px 0; }
                button { margin: 5px; padding: 5px 10px; }
            </style>
        </head>
        <body>
            <h1>Test Interface</h1>
            ${sampleListings.map(listing => `
                <div class="listing">
                    <h3>${listing.StandardFields.StreetNumber} ${listing.StandardFields.StreetName} 
                        ${listing.StandardFields.StreetSuffix}</h3>
                    <p>Current Price: $${listing.StandardFields.ListPrice}</p>
                    <button onclick="fetch('/test-change', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            listingId: '${listing.Id}',
                            type: 'StatusChange',
                            oldStatus: 'Active',
                            newStatus: 'Pending'
                        })
                    })">Change to Pending</button>
                    
                    <button onclick="fetch('/test-change', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            listingId: '${listing.Id}',
                            type: 'PriceChange',
                            oldPrice: ${listing.StandardFields.ListPrice},
                            newPrice: ${listing.StandardFields.ListPrice * 0.95}
                        })
                    })">Reduce Price 5%</button>
                </div>
            `).join('')}
        </body>
        </html>
    `);
});

// Test change handler
app.post('/test-change', async (req, res) => {
    const { listingId, type, oldStatus, newStatus, oldPrice, newPrice } = req.body;
    
    // Find the listing in our sample data
    const listing = sampleListings.find(l => l.Id === listingId);
    
    if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
    }

    // Simulate the webhook payload
    const webhookPayload = {
        Listing: { Id: listingId },
        NewsFeed: { 
            Event: type,
            EventTimestamp: new Date().toISOString()
        }
    };

    if (type === 'StatusChange') {
        webhookPayload.OldStatus = oldStatus;
        webhookPayload.NewStatus = newStatus;
    } else if (type === 'PriceChange') {
        webhookPayload.OldPrice = oldPrice;
        webhookPayload.NewPrice = newPrice;
        // Update the sample listing price
        listing.StandardFields.ListPrice = newPrice;
    }

    try {
        // Process the simulated change using our existing handler
        await handleListingChange(webhookPayload);
        res.json({ success: true });
    } catch (error) {
        console.error('Error processing test change:', error);
        res.status(500).json({ error: 'Failed to process change' });
    }
});

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
