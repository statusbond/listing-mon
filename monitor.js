require('dotenv').config();
const express = require('express');
const { sendStatusChange, sendPriceChange, sendOpenHouse } = require('./notifications');

const app = express();
app.use(express.json());

// Spark API Configuration
const SPARK_API_BASE_URL = 'https://replication.sparkapi.com/v1';
const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutes

// Persistent storage for listing states
const previousListingStates = new Map();

// Global variable to track first-time polling
let isFirstPoll = true;

// Helper function to create secure API request
async function sparApiRequest(endpoint, method = 'GET', body = null) {
    const accessToken = process.env.SPARK_ACCESS_TOKEN;
    
    if (!accessToken) {
        throw new Error('No SparkAPI access token provided');
    }

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };

    const config = {
        method,
        headers
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const fullUrl = `${SPARK_API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(fullUrl, config);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SparkAPI request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Detailed Spark API Error:', {
            message: error.message,
            endpoint: fullUrl,
            method
        });
        throw error;
    }
}

// Enhanced getListingDetails function
async function getListingDetails(listingId) {
    try {
        const response = await sparApiRequest(`/listings/${listingId}`);
        
        if (!response.D || !response.D.Results || response.D.Results.length === 0) {
            throw new Error('No listing details found');
        }

        const fields = response.D.Results[0].StandardFields;
        
        return {
            id: listingId,
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
            photoUrl: fields.Media?.[0]?.Uri300 || `${process.env.PUBLIC_WEBHOOK_URL || ''}/api/placeholder/300/200`,
            status: fields.StandardStatus,
            originalFields: fields
        };
    } catch (error) {
        console.error(`Error fetching listing details for ${listingId}:`, error);
        throw error;
    }
}

// Initialize complete listing states
async function initializeListingStates() {
    try {
        console.log('Initializing complete listing states...');
        
        let allListings = [];
        let skipToken = '';
        let hasMoreListings = true;

        while (hasMoreListings) {
            // Construct the URL with _skiptoken and _limit
            const params = new URLSearchParams({
                '_limit': '1000',
                '_skiptoken': skipToken,
                '_filter': 'StandardStatus eq \'Active\' or StandardStatus eq \'Pending\'',
                '_select': 'ListingId,StandardStatus,ListPrice,ModificationTimestamp,OpenHouse,StandardFields'
            });

            const response = await sparApiRequest(`/listings?${params}`);
            const currentPageListings = response.D.Results;

            // Accumulate listings
            allListings = allListings.concat(currentPageListings);

            // Get the next skipToken
            skipToken = response.D.NextSkipToken || '';

            // Determine if there are more listings
            hasMoreListings = skipToken !== '';

            console.log(`Fetched page, total listings so far: ${allListings.length}`);
            
            // Prevent infinite loop if something goes wrong
            if (!skipToken) break;
        }

        console.log(`Discovered ${allListings.length} total active/pending listings`);

        // Populate previousListingStates with initial state
        allListings.forEach(listing => {
            const listingState = {
                status: listing.StandardFields.StandardStatus,
                price: listing.StandardFields.ListPrice,
                modificationTimestamp: listing.StandardFields.ModificationTimestamp,
                openHouse: listing.StandardFields.OpenHouse
            };
            previousListingStates.set(listing.Id, listingState);
        });

        isFirstPoll = false;
        console.log('Initial listing states completely initialized');
    } catch (error) {
        console.error('Error initializing listing states:', error);
        isFirstPoll = true; // Retry on next poll if initialization fails
    }
}

async function pollSparkAPI() {
    try {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Starting SparkAPI poll...`);

        let allListings = [];
        let skipToken = '';
        let hasMoreListings = true;
        let changesDetected = false;

        while (hasMoreListings) {
            const params = new URLSearchParams({
                '_limit': '1000',
                '_skiptoken': skipToken,
                '_filter': 'StandardStatus eq \'Active\' or StandardStatus eq \'Pending\'',
                '_select': 'ListingId,StandardStatus,ListPrice,ModificationTimestamp,OpenHouse,StandardFields'
            });

            const response = await sparApiRequest(`/listings?${params}`);
            const currentPageListings = response.D.Results;

            allListings = allListings.concat(currentPageListings);

            skipToken = response.D.NextSkipToken || '';
            hasMoreListings = skipToken !== '';

            if (!skipToken) break;
        }

        console.log(`[${timestamp}] Fetched ${allListings.length} active/pending listings`);

        for (const listing of allListings) {
            const listingId = listing.Id;
            const currentState = {
                status: listing.StandardFields.StandardStatus,
                price: listing.StandardFields.ListPrice,
                modificationTimestamp: listing.StandardFields.ModificationTimestamp,
                openHouse: listing.StandardFields.OpenHouse
            };

            const previousState = previousListingStates.get(listingId);

            if (!previousState) {
                // First time seeing this listing
                previousListingStates.set(listingId, currentState);
                continue;
            }

            // Extremely verbose logging for debugging
            console.log(`Examining Listing ${listingId}:`);
            console.log('Previous State:', JSON.stringify(previousState));
            console.log('Current State:', JSON.stringify(currentState));

            // Detailed change detection
            const stateChanged = 
                previousState.status !== currentState.status ||
                previousState.price !== currentState.price ||
                previousState.modificationTimestamp !== currentState.modificationTimestamp;

            const openHouseChanged = 
                (!previousState.openHouse && currentState.openHouse) || 
                (previousState.openHouse && currentState.openHouse && 
                 JSON.stringify(previousState.openHouse) !== JSON.stringify(currentState.openHouse));

            if (stateChanged || openHouseChanged) {
                changesDetected = true;
                console.log(`[SIGNIFICANT CHANGE] Listing ${listingId}`);
                
                if (stateChanged) {
                    console.log('State change detected:', {
                        previousStatus: previousState.status,
                        currentStatus: currentState.status,
                        previousPrice: previousState.price,
                        currentPrice: currentState.price,
                        previousTimestamp: previousState.modificationTimestamp,
                        currentTimestamp: currentState.modificationTimestamp
                    });
                }

                if (openHouseChanged) {
                    console.log('Open House change detected');
                    console.log('Previous Open House:', previousState.openHouse);
                    console.log('Current Open House:', currentState.openHouse);
                }

                // Fetch and send notifications
                const listingDetails = await getListingDetails(listingId);

                if (previousState.status !== currentState.status) {
                    await sendStatusChange(listingDetails, previousState.status, currentState.status);
                }

                if (previousState.price !== currentState.price) {
                    await sendPriceChange(listingDetails, previousState.price, currentState.price);
                }

                if (openHouseChanged) {
                    await sendOpenHouse(listingDetails, currentState.openHouse);
                }

                // Update the stored state
                previousListingStates.set(listingId, currentState);
            }
        }

        if (!changesDetected) {
            console.log(`[${timestamp}] No significant changes detected in any listings`);
        }

        console.log(`[${timestamp}] Polling cycle completed`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error during SparkAPI polling:`, error);
    }
}

// Test interface route
app.get('/test-interface', async (req, res) => {
    try {
        const params = new URLSearchParams({
            '$top': '10',
            '$select': 'ListingId,StandardFields'
        });

        const response = await sparApiRequest(`/listings?${params}`);
        const listings = response.D.Results;

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
                <h1>Test Interface - Real Listings</h1>
                ${listings.map(listing => `
                    <div class="listing">
                        <h3>${listing.StandardFields.StreetNumber} ${listing.StandardFields.StreetName} 
                            ${listing.StandardFields.StreetSuffix || ''}</h3>
                        <p>Current Price: $${listing.StandardFields.ListPrice.toLocaleString()}</p>
                        <p>Current Status: ${listing.StandardFields.StandardStatus}</p>
                        <button onclick="fetch('/test-change', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                listingId: '${listing.Id}',
                                type: 'StatusChange',
                                oldStatus: '${listing.StandardFields.StandardStatus}',
                                newStatus: '${listing.StandardFields.StandardStatus === 'Active' ? 'Pending' : 'Active'}'
                            })
                        })">Toggle Status</button>
                        
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
                    </div>
                `).join('')}
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error generating test interface:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

// Test change handler
app.post('/test-change', async (req, res) => {
    const { listingId, type, oldStatus, newStatus, oldPrice, newPrice } = req.body;
    
    try {
        // Fetch listing details
        const listingDetails = await getListingDetails(listingId);
        
        switch (type) {
            case 'StatusChange':
                await sendStatusChange(listingDetails, oldStatus, newStatus);
                break;
            case 'PriceChange':
                await sendPriceChange(listingDetails, oldPrice, newPrice);
                break;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing test change:', error);
        res.status(500).json({ error: 'Failed to process change', details: error.message });
    }
});

// Polling status route
app.get('/polling-status', (req, res) => {
    res.json({
        isPollingEnabled: process.env.ENABLE_POLLING === 'true',
        pollingInterval: POLLING_INTERVAL / 1000 + ' seconds',
        trackedListings: previousListingStates.size,
        lastPollTimestamp: new Date().toISOString()
    });
});

// Force poll route
app.get('/force-poll', async (req, res) => {
    try {
        console.log('Manual polling triggered');
        await pollSparkAPI();
        res.json({ 
            status: 'Polling completed', 
            timestamp: new Date().toISOString(),
            storedListings: Array.from(previousListingStates.entries()).map(([id, state]) => ({
                id,
                ...state
            }))
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Polling failed', 
            message: error.message 
        });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start periodic polling when the server starts
    if (process.env.ENABLE_POLLING === 'true') {
        console.log('Starting SparkAPI periodic polling...');
        
        // Initial call to set up complete listing states
        initializeListingStates();
        
        // Regular polling
        setInterval(pollSparkAPI, POLLING_INTERVAL);
    }
});

module.exports = { 
    pollSparkAPI, 
    sparApiRequest,
    initializeListingStates
};
