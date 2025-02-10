// Add this near the top of your monitor.js file
const previousListingStates = new Map(); // Store previous listing states

// Enhanced polling function
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

// Add diagnostic routes
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

app.get('/polling-status', (req, res) => {
    res.json({
        isPollingEnabled: process.env.ENABLE_POLLING === 'true',
        pollingInterval: POLLING_INTERVAL / 1000 + ' seconds',
        trackedListings: previousListingStates.size,
        lastPollTimestamp: new Date().toISOString()
    });
});

// Update the polling interval to be more frequent during testing
const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutes instead of 5

// Start polling when server starts
if (process.env.ENABLE_POLLING === 'true') {
    console.log('Starting SparkAPI periodic polling...');
    // Initial poll
    pollSparkAPI();
    // Set up regular polling
    setInterval(pollSparkAPI, POLLING_INTERVAL);
}
