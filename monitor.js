require('dotenv').config();
const express = require('express');
const { sendStatusChange, sendPriceChange, sendOpenHouse } = require('./notifications');

const app = express();
app.use(express.json());

// Configuration for API polling
const POLL_CONFIG = {
    interval: 5 * 60 * 1000, // 5 minutes
    batchSize: 100,
    maxRequestsPerPoll: 10
};

// Error logging utility
function logAPIError(error, context, data = null) {
    const errorLog = {
        timestamp: new Date().toISOString(),
        context,
        error: {
            message: error.message,
            stack: error.stack
        },
        data
    };

    console.error('API Error:', JSON.stringify(errorLog, null, 2));
}

// Helper function to format address
function formatAddress(listing) {
    const parts = [
        listing.StreetNumber,
        listing.StreetDirPrefix,
        listing.StreetName,
        listing.StreetSuffix,
        listing.StreetDirSuffix
    ].filter(Boolean);
    
    return parts.join(' ');
}

// Function to fetch listings for test interface
async function fetchTestListings() {
    try {
        const response = await fetch('https://sparkapi.com/v1/listings?_limit=5', {
            headers: {
                'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.D.Results || [];
    } catch (error) {
        logAPIError(error, 'fetchTestListings');
        return [];
    }
}

// API Testing function
async function testSparkAPI() {
    try {
        console.log('Testing Spark API connection...');
        
        const response = await fetch('https://sparkapi.com/v1/listings?_limit=1', {
            headers: {
                'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Connection Test Successful');
        return true;
    } catch (error) {
        logAPIError(error, 'API-Test');
        return false;
    }
}

// Main function to handle listing changes
async function handleListingChange(notification) {
    const listingId = notification.Listing.Id;
    const changeType = notification.NewsFeed.Event;
    const listingDetails = await getListingDetails(listingId);

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

// Enhanced getListingDetails function with error handling
async function getListingDetails(listingId) {
    try {
        console.log(`Fetching details for listing: ${listingId}`);

        const response = await fetch(`https://sparkapi.com/v1/listings/${listingId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorBody}`);
        }
        
        const data = await response.json();
        
        if (!data.D?.Success || !data.D?.Results?.[0]) {
            throw new Error('Invalid API response format');
        }

        const fields = data.D.Results[0].StandardFields;
        
        return {
            address: formatAddress(fields),
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
    } catch (error) {
        logAPIError(error, 'getListingDetails', { listingId });
        throw error;
    }
}

// Test interface route
app.get('/test-interface', async (req, res) => {
    const listings = await fetchTestListings();
    
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
            ${listings.map(listing => `
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
                            oldStatus: '${listing.StandardFields.StandardStatus}',
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
                            newPrice: ${Math.round(listing.StandardFields.ListPrice * 0.95)}
                        })
                    })">Reduce Price 5%</button>

                    <button onclick="fetch('/test-change', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            listingId: '${listing.Id}',
                            type: 'OpenHouse',
                            OpenHouse: {
                                Date: '2025-02-15',
                                StartTime: '1:00 PM',
                                EndTime: '4:00 PM'
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

// Polling mechanism
async function startPolling() {
    let lastPollTime = new Date().toISOString();
    console.log(`Starting Spark API polling service. Initial timestamp: ${lastPollTime}`);

    setInterval(async () => {
        try {
            console.log(`Checking for changes since: ${lastPollTime}`);
            await checkForChanges(lastPollTime);
            lastPollTime = new Date().toISOString();
        } catch (error) {
            logAPIError(error, 'polling-interval');
        }
    }, POLL_CONFIG.interval);
}

async function checkForChanges(sinceTimestamp) {
    let offset = 0;
    let hasMore = true;
    let requestCount = 0;

    while (hasMore && requestCount < POLL_CONFIG.maxRequestsPerPoll) {
        try {
            const response = await fetch(
                `https://sparkapi.com/v1/listings?` + 
                `_filter=ModificationTimestamp gt ${sinceTimestamp}&` +
                `_limit=${POLL_CONFIG.batchSize}&` +
                `_offset=${offset}`,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            const listings = data.D.Results;
            
            console.log(`Processing ${listings.length} listings from batch ${requestCount + 1}`);

            for (const listing of listings) {
                await processListingChanges(listing, sinceTimestamp);
            }

            requestCount++;
            offset += POLL_CONFIG.batchSize;
            hasMore = listings.length === POLL_CONFIG.batchSize;

            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            logAPIError(error, 'checkForChanges', { sinceTimestamp, offset });
            throw error;
        }
    }
}

async function processListingChanges(listing, sinceTimestamp) {
    const fields = listing.StandardFields;
    
    // Check for status changes
    if (fields.StatusChangeTimestamp > sinceTimestamp) {
        await handleListingChange({
            Listing: { Id: listing.Id },
            NewsFeed: { 
                Event: 'StatusChange',
                EventTimestamp: fields.StatusChangeTimestamp
            },
            OldStatus: fields.PreviousStatus || 'Unknown',
            NewStatus: fields.StandardStatus
        });
    }
    
    // Check for price changes
    if (fields.PriceChangeTimestamp > sinceTimestamp) {
        await handleListingChange({
            Listing: { Id: listing.Id },
            NewsFeed: { 
                Event: 'PriceChange',
                EventTimestamp: fields.PriceChangeTimestamp
            },
            OldPrice: fields.PreviousListPrice || fields.OriginalListPrice,
            NewPrice: fields.ListPrice
        });
    }
}

// Start the server and initialize services
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    // Test API connection
    const apiTest = await testSparkAPI();
    if (apiTest) {
        // Start polling if API test is successful
        startPolling();
    } else {
        console.error('API test failed - polling not started');
    }
});
