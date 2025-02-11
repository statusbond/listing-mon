require('dotenv').config();
const express = require('express');
const { handleListingChange } = require('./notifications/index');

const app = express();
app.use(express.json());

const SPARK_API_BASE = "https://replication.sparkapi.com/v1";

const getSparkHeaders = () => ({
    'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
});

async function fetchTestListings() {
    try {
        console.log("Fetching test listings...");
        const response = await fetch(`${SPARK_API_BASE}/listings?_limit=5`, {
            headers: getSparkHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Fetched listings:", JSON.stringify(data, null, 2));
        return data.D.Results || [];
    } catch (error) {
        console.error('Error fetching test listings:', error);
        return [];
    }
}

async function testSparkAPI() {
    try {
        console.log('Testing Spark API connection...');
        console.log('Access Token Present:', !!process.env.SPARK_ACCESS_TOKEN);
        
        const response = await fetch(`${SPARK_API_BASE}/listings?_limit=1`, {
            headers: getSparkHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        console.log('API Connection Test Successful');
        return true;
    } catch (error) {
        console.error('API test failed:', error);
        return false;
    }
}

app.get('/', (req, res) => {
    res.send('<h1>Listing Status Monitor is Running 🚀</h1>');
});

app.post('/test-change', async (req, res) => {
    console.log("Received test-change request:", JSON.stringify(req.body, null, 2));
    
    const { listingId, type, oldStatus, newStatus, oldPrice, newPrice } = req.body;

    const webhookPayload = {
        Listing: { Id: listingId },
        NewsFeed: { Event: type, EventTimestamp: new Date().toISOString() }
    };

    if (type === 'StatusChange') {
        webhookPayload.OldStatus = oldStatus;
        webhookPayload.NewStatus = newStatus;
    } else if (type === 'PriceChange') {
        webhookPayload.OldPrice = oldPrice;
        webhookPayload.NewPrice = newPrice;
    }

    try {
        await handleListingChange(webhookPayload);
        res.json({ success: true });
    } catch (error) {
        console.error('Error processing test change:', error);
        res.status(500).json({ error: 'Failed to process change' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    const apiTest = await testSparkAPI();
    if (!apiTest) {
        console.error('API test failed - polling not started');
    }
});
