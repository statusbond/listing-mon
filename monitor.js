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
            PostalCode: "58103",
            ListPrice: 1079900,
            BedsTotal: 8,
            BathroomsTotalInteger: 8,
            BuildingAreaTotal: 7275,
            ListAgentFirstName: "Joe",
            ListAgentLastName: "Agent",
            ListAgentMobilePhone: "123-456-7890",
            ListAgentEmail: "joe@agent.com",
            OpenHouse: [{
                Date: "2025-02-15",
                StartTime: "1:00 PM",
                EndTime: "4:00 PM"
            }],
            StandardStatus: "Active"
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
            PostalCode: "58104",
            ListPrice: 450000,
            BedsTotal: 4,
            BathroomsTotalInteger: 3,
            BuildingAreaTotal: 2500,
            ListAgentFirstName: "Jane",
            ListAgentLastName: "Smith",
            ListAgentMobilePhone: "123-555-7890",
            ListAgentEmail: "jane@agent.com",
            OpenHouse: [{
                Date: "2025-02-16",
                StartTime: "2:00 PM",
                EndTime: "5:00 PM"
            }],
            StandardStatus: "Active"
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
        case 'OpenHouse':
            await sendOpenHouseNotification(
                listingDetails,
                notification.OpenHouse
            );
            break;
        default:
            console.log(`Unhandled change type: ${changeType}`);
    }
}

// Enhanced getListingDetails function
async function getListingDetails(listingId, accessToken) {
    if (!accessToken) {
        const sampleListing = sampleListings.find(l => l.Id === listingId);
        if (sampleListing) {
            const fields = sampleListing.StandardFields;
            return {
                address: `${fields.StreetNumber} ${fields.StreetName} ${fields.StreetSuffix || ''}`,
                city: fields.City,
                state: fields.StateOrProvince,
                zip: fields.PostalCode,
                price: fields.ListPrice,
                beds: fields.BedsTotal,
                baths: fields.BathroomsTotalInteger,
                sqft: fields.BuildingAreaTotal,
                agent: `${fields.ListAgentFirstName} ${fields.ListAgentLastName}`,
                agentCell: fields.ListAgentMobilePhone,
                agentEmail: fields.ListAgentEmail,
                openHouse: fields.OpenHouse,
                photoUrl: `${process.env.PUBLIC_WEBHOOK_URL}/api/placeholder/300/200`,
                status: fields.StandardStatus
            };
        }
    }

    const response = await fetch(`https://sparkapi.com/v1/listings/${listingId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    const data = await response.json();
    const fields = data.D.Results[0].StandardFields;
    
    return {
        address: `${fields.StreetNumber} ${fields.StreetName} ${fields.StreetSuffix || ''}`,
        city: fields.City,
        state: fields.StateOrProvince,
        zip: fields.PostalCode,
        price: fields.ListPrice,
        beds: fields.BedsTotal,
        baths: fields.BathroomsTotalInteger,
        sqft: fields.BuildingAreaTotal,
        agent: `${fields.ListAgentFirstName} ${fields.ListAgentLastName}`,
        agentCell: fields.ListAgentMobilePhone,
        agentEmail: fields.ListAgentEmail,
        openHouse: fields.OpenHouse,
        photoUrl: fields.Media?.[0]?.Uri300 || `${process.env.PUBLIC_WEBHOOK_URL}/api/placeholder/300/200`,
        status: fields.StandardStatus
    };
}

// Status change notification
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
                "type": "image",
                "title": {
                    "type": "plain_text",
                    "text": listingDetails.address
                },
                "image_url": listingDetails.photoUrl,
                "alt_text": "Property image"
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

// Price change notification
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
                "type": "image",
                "title": {
                    "type": "plain_text",
                    "text": listingDetails.address
                },
                "image_url": listingDetails.photoUrl,
                "alt_text": "Property image"
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

// New Open House notification
async function sendOpenHouseNotification(listingDetails, openHouse) {
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
                "type": "image",
                "title": {
                    "type": "plain_text",
                    "text": listingDetails.address
                },
                "image_url": listingDetails.photoUrl,
                "alt_text": "Property image"
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
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": `*Details:*\n${listingDetails.beds} beds | ${listingDetails.baths} baths | ${listingDetails.sqft.toLocaleString()} sqft`
                    }
                ]
            }
        ]
    };

    await sendSlackMessage(message);
}

// Generic function to send messages to Slack with detailed error logging
async function sendSlackMessage(message) {
    try {
        console.log('Attempting to send to Slack webhook:', process.env.SLACK_WEBHOOK_URL);
        console.log('Message content:', JSON.stringify(message, null, 2));

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
        console.error('Detailed Slack error:', {
            message: error.message,
            stack: error.stack,
            webhookUrl: process.env.SLACK_WEBHOOK_URL ? 'URL present' : 'URL missing'
        });
        throw error;
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

                    <button onclick="fetch('/test-change', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            listingId: '${listing.Id}',
                            type: 'OpenHouse',
                            OpenHouse: {
                                Date: '${listing.StandardFields.OpenHouse[0].Date}',
                                StartTime: '${listing.StandardFields.OpenHouse[0].StartTime}',
                                EndTime: '${listing.StandardFields.OpenHouse[0].EndTime}'
                            }
                        })
                    })">Add Open House</button>
                </div>
            `).join('')}
        </body>
        </html>
    `);
});

// Test change handler
app.post('/test-change', async (req, res) => {
    const { listingId, type, oldStatus,
