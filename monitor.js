require('dotenv').config();
const express = require('express');
const { sendStatusChange, sendPriceChange, sendOpenHouse } = require('./notifications');

const app = express();
app.use(express.json());

const SPARK_API_BASE = "https://replication.sparkapi.com/v1";

const getSparkHeaders = () => ({
    'Authorization': `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    const apiTest = await testSparkAPI();
    if (!apiTest) {
        console.error('API test failed - polling not started');
    }
});
