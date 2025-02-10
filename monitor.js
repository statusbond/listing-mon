require('dotenv').config();
const express = require('express');
const { sendStatusChange, sendPriceChange, sendOpenHouse } = require('./notifications');

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
            await sendStatusChange(
                listingDetails,
                notification.OldStatus,
                notification.NewStatus
            );
            break;
        case 'PriceChange':
            await sendPriceChange(
                listingDetails,
                notification.OldPrice,
                notification.NewPrice
            );
            break;
        case 'OpenHouse':
            await sendOpenHouse(
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
    const { listingId, type, oldStatus, newStatus, oldPrice, newPrice, OpenHouse } = req.body;
    
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
        listing.StandardFields.StandardStatus = newStatus;
    } else if (type === 'PriceChange') {
        webhookPayload.OldPrice = oldPrice;
        webhookPayload.NewPrice = newPrice;
        listing.StandardFields.ListPrice = newPrice;
    } else if (type === 'OpenHouse') {
        webhookPayload.OpenHouse = OpenHouse;
    }

    try {
        await handleListingChange(webhookPayload);
        res.json({ success: true });
    } catch (error) {
        console.error('Error processing test change:', error);
        res.status(500).json({ error: 'Failed to process change' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
