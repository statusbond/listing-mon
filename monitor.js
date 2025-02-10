require('dotenv').config();
const express = require('express');
const { sendStatusChange, sendPriceChange, sendOpenHouse } = require('./notifications');

const app = express();
app.use(express.json());

// SparkAPI Polling Configuration
const SPARK_API_BASE_URL = 'https://sparkapi.com/v1';
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastPollTimestamp = null;

// Fetch recent listing changes from SparkAPI
async function fetchListingChanges(accessToken) {
    try {
        // Construct query parameters for changes
        const params = new URLSearchParams({
            // If you have a last poll timestamp, use it to fetch only recent changes
            ...(lastPollTimestamp && { 
                '$filter': `ModificationTimestamp gt '${lastPollTimestamp}'` 
            }),
            '$select': 'ListingId,StandardStatus,ListPrice,ModificationTimestamp,OpenHouse'
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
        
        // Update last poll timestamp
        lastPollTimestamp = new Date().toISOString();

        return data.D.Results;
    } catch (error) {
        console.error('Error fetching listing changes:', error);
        throw error;
    }
}

// Process individual listing changes
async function processListingChanges(listings, accessToken) {
    for (const listing of listings) {
        try {
            // Fetch full listing details
            const listingDetails = await getListingDetails(listing.Id, accessToken);

            // Determine change type and trigger appropriate notification
            // Note: This is a simplified example. You'll want to track previous state more robustly
            if (listing.StandardStatus !== listingDetails.status) {
                await sendStatusChange(
                    listingDetails, 
                    'Previous Status', 
                    listing.StandardStatus
                );
            }

            // Similar checks for price changes and open houses can be added
        } catch (error) {
            console.error(`Error processing listing ${listing.Id}:`, error);
        }
    }
}

// Periodic polling function
async function pollSparkAPI() {
    try {
        console.log('Polling SparkAPI for listing changes...');
        const accessToken = process.env.SPARK_ACCESS_TOKEN;
        
        if (!accessToken) {
            console.error('No SparkAPI access token provided');
            return;
        }

        const changedListings = await fetchListingChanges(accessToken);
        
        if (changedListings && changedListings.length > 0) {
            console.log(`Found ${changedListings.length} changed listings`);
            await processListingChanges(changedListings, accessToken);
        } else {
            console.log('No listing changes detected');
        }
    } catch (error) {
        console.error('Error during SparkAPI polling:', error);
    }
}

// Rest of the existing monitor.js code remains the same...
// (getListingDetails, test interface routes, etc.)

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

module.exports = { pollSparkAPI };
