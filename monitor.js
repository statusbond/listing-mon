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

// Polling function
async function pollSparkAPI() {
    try {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Starting SparkAPI poll...`);

        const params = new URLSearchParams({
            '$top': '100', // Increase number of listings checked
            '$orderby': 'ModificationTimestamp desc', // Get most recently modified first
            '$filter': 'StandardStatus ne \'Closed\'', // Only active listings
            '$select': 'ListingId,StandardStatus,ListPrice,ModificationTimestamp,StandardFields'
        });

        const response = await sparApiRequest(`/listings?${params}`);
        const currentListings = response.D.Results;

        console.log(`[${timestamp}] Fetched ${currentListings.length} listings`);

        for (const listing of currentListings) {
            const listingId = listing.Id;
            const currentState = {
                status: listing.StandardFields.StandardStatus,
                price: listing.StandardFields.ListPrice,
                modificationTimestamp: listing.StandardFields.ModificationTimestamp
            };

            const previousState = previousListingStates.get(listingId);

            // If we have a previous state, check for changes
            if (previousState) {
                console.log(`[${timestamp}] Checking changes for listing ${listingId}`);
                console.log('Previous state:', previousState);
                console.log('Current state:', currentState);

                // Check for status change
                if (previousState.status !== currentState.status) {
                    console.log(`[${timestamp}] Status change detected for ${listingId}`);
                    const listingDetails = await getListingDetails(listingId);
                    await sendStatusChange(
                        listingDetails,
                        previousState.status,
                        currentState.status
                    );
                }

                // Check for price change
                if (previousState.price !== currentState.price) {
                    console.log(`[${timestamp}] Price change detected for ${listingId}`);
                    const listingDetails = await getListingDetails(listingId);
                    await sendPriceChange(
                        listingDetails,
                        previousState.price,
                        currentState.price
                    );
                }
            } else {
                console.log(`[${timestamp}] First time seeing listing ${listingId}`);
            }

            // Update the stored state
            previousListingStates.set(listingId, currentState);
        }

        console.log(`[${timestamp}] Polling cycle completed`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error during SparkAPI polling:`, error);
    }
}

// Diagnostic route for force polling
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

// Polling status route
app.get('/polling-status', (req, res) => {
    res.json({
        isPollingEnabled: process.env.ENABLE_POLLING === 'true',
        pollingInterval: POLLING_INTERVAL / 1000 + ' seconds',
        trackedListings: previousListingStates.size,
        lastPollTimestamp: new Date().toISOString()
    });
});

// Existing test interface and test change routes from previous implementation would go here
// (Include the routes from the previous monitor.js)

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start polling if enabled
    if (process.env.ENABLE_POLLING === 'true') {
        console.log('Starting SparkAPI periodic polling...');
        // Initial poll
        pollSparkAPI();
        // Set up regular polling
        setInterval(pollSparkAPI, POLLING_INTERVAL);
    }
});

module.exports = { 
    pollSparkAPI, 
    sparApiRequest 
};
