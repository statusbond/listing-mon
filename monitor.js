require('dotenv').config();
const express = require('express');
const { sendStatusChange, sendPriceChange, sendOpenHouse } = require('./notifications');

const app = express();
app.use(express.json());

const SPARK_API_BASE_URL = 'https://sparkapi.com/v1';
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastPollTimestamp = null;
let cachedListings = []; // Global cache for listings

// Enhanced getListingDetails function
async function getListingDetails(listingId, accessToken) {
    // If no access token, try to use cached listings
    const cachedListing = cachedListings.find(l => l.Id === listingId);
    if (cachedListing) {
        const fields = cachedListing.StandardFields;
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
            photoUrl: fields.Media?.[0]?.Uri300 || `${process.env.PUBLIC_WEBHOOK_URL || ''}/api/placeholder/300/200`,
            status: fields.StandardStatus
        };
    }

    // If not in cache, fetch from API
    if (accessToken) {
        try {
            const response = await fetch(`${SPARK_API_BASE_URL}/listings/${listingId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Listing fetch failed: ${response.status}`);
            }

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
                photoUrl: fields.Media?.[0]?.Uri300 || `${process.env.PUBLIC_WEBHOOK_URL || ''}/api/placeholder/300/200`,
                status: fields.StandardStatus
            };
        } catch (error) {
            console.error(`Error fetching listing details for ${listingId}:`, error);
            throw error;
        }
    }

    throw new Error('No access token or cached listing found');
}

// Fetch listings from Spark API
async function fetchSparkListings(accessToken, limit = 10) {
    try {
        const params = new URLSearchParams({
            '$top': String(limit),
            '$select': 'ListingId,StandardFields'
        });

        const response = await fetch(`${SPARK_API_BASE_URL}/listings?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SparkAPI request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // Cache the listings globally
        cachedListings = data.D.Results;

        return cachedListings;
    } catch (error) {
        console.error('Error fetching listings:', error);
        throw error;
    }
}

// Test Spark API route
app.get('/test-spark-api', async (req, res) => {
    try {
        const accessToken = process.env.SPARK_ACCESS_TOKEN;
        
        if (!accessToken) {
            return res.status(400).json({ 
                error: 'No SparkAPI access token provided',
                message: 'Please set SPARK_ACCESS_TOKEN in your environment variables'
            });
        }

        const listings = await fetchSparkListings(accessToken);

        res.json({
            totalResults: listings.length,
            listings: listings.map(listing => ({
                id: listing.Id,
                listingId: listing.StandardFields.ListingId,
                address: `${listing.StandardFields.StreetNumber} ${listing.StandardFields.StreetName}`,
                city: listing.StandardFields.City,
                state: listing.StandardFields.StateOrProvince,
                price: listing.StandardFields.ListPrice,
                status: listing.StandardFields.StandardStatus
            }))
        });
    } catch (error) {
        console.error('Error testing Spark API:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Dynamic Test Interface route
app.get('/test-interface', async (req, res) => {
    try {
        const accessToken = process.env.SPARK_ACCESS_TOKEN;
        
        if (!accessToken) {
            return res.status(400).send('No SparkAPI access token provided');
        }

        const listings = await fetchSparkListings(accessToken);

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
                                newPrice: ${listing.StandardFields.ListPrice * 0.95}
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
        const accessToken = process.env.SPARK_ACCESS_TOKEN;
        
        if (!accessToken) {
            return res.status(400).json({ error: 'No SparkAPI access token provided' });
        }

        // Fetch listing details
        const listingDetails = await getListingDetails(listingId, accessToken);
        
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

// Periodic polling function (placeholder)
async function pollSparkAPI() {
    try {
        console.log('Polling SparkAPI for listing changes...');
        const accessToken = process.env.SPARK_ACCESS_TOKEN;
        
        if (!accessToken) {
            console.error('No SparkAPI access token provided');
            return;
        }

        // Fetch and process changes
        const changedListings = await fetchSparkListings(accessToken);
        
        console.log(`Found ${changedListings.length} listings`);
    } catch (error) {
        console.error('Error during SparkAPI polling:', error);
    }
}

// Start periodic polling when the server starts
if (process.env.ENABLE_POLLING === 'true') {
    console.log('Starting SparkAPI periodic polling...');
    setInterval(pollSparkAPI, POLLING_INTERVAL);
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Initial poll on startup
    if (process.env.ENABLE_POLLING === 'true') {
        pollSparkAPI();
    }
});

module.exports = { pollSparkAPI, fetchSparkListings };
