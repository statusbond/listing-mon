require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

// Sample listings for testing
const sampleListings = [
    {
        Id: "20060412165917817933000000",
        StandardFields: {
            ListingKey: "20060412165917817933000000",
            UnparsedAddress: "611 8th St S",
            City: "Fargo",
            StateOrProvince: "ND",
            PostalCode: "58103",
            ListPrice: 1079900,
            BedsTotal: 8,
            BathsTotal: 8,
            BuildingAreaTotal: 7275,
            ListAgentFullName: "Joe Agent",
            ListAgentCellPhone: "123-456-7890",
            ListAgentEmail: "joe@joeagent.com",
            ListingStatus: "Active",
            StatusChangeTimestamp: new Date().toISOString(),
            DaysOnMarket: 45,
            Photos: [
                {
                    Uri300: "https://photos.sparkplatform.com/example.jpg"
                }
            ]
        }
    }
];

// Utility function to format price
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    }).format(price);
}

// Utility function to format time
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

// Send Slack message function
async function sendSlackMessage(messageBlocks) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!slackWebhookUrl) {
        console.error('Slack webhook URL is not set');
        return;
    }

    try {
        const response = await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                blocks: messageBlocks
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Slack response error:', { 
                status: response.status, 
                statusText: response.statusText, 
                errorBody 
            });
            throw new Error(`Failed to send to Slack: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error sending to Slack:', error);
    }
}

// Send status change notification
async function sendStatusChangeNotification(listing) {
    const fields = listing.StandardFields;
    
    const messageBlocks = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "🏠 Listing Status Change Alert!"
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Address:* ${fields.UnparsedAddress}, ${fields.City}, ${fields.StateOrProvince} ${fields.PostalCode}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*New Status:* ${fields.ListingStatus} < Previous Status`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Time:* ${formatTime(fields.StatusChangeTimestamp)}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Specs:* ${fields.BedsTotal} beds | ${fields.BathsTotal} baths | ${fields.BuildingAreaTotal.toLocaleString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} sqft`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Days on Market:* ${fields.DaysOnMarket}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Price:* ${formatPrice(fields.ListPrice)}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Agent:* ${fields.ListAgentFullName}\n${fields.ListAgentCellPhone}\n${fields.ListAgentEmail || 'N/A'}`
            }
        }
    ];

    await sendSlackMessage(messageBlocks);
}

// Send price change notification
async function sendPriceChangeNotification(listing, oldPrice) {
    const fields = listing.StandardFields;
    const priceChange = ((fields.ListPrice - oldPrice) / oldPrice * 100).toFixed(1);
    
    const messageBlocks = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "💰 Price Change Alert!"
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Address:* ${fields.UnparsedAddress}, ${fields.City}, ${fields.StateOrProvince} ${fields.PostalCode}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*New Price:* ${formatPrice(fields.ListPrice)} < ${formatPrice(oldPrice)} (${priceChange}%)`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Time:* ${formatTime(fields.StatusChangeTimestamp)}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Specs:* ${fields.BedsTotal} beds | ${fields.BathsTotal} baths | ${fields.BuildingAreaTotal.toLocaleString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} sqft`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Days on Market:* ${fields.DaysOnMarket}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Status:* ${fields.ListingStatus}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Agent:* ${fields.ListAgentFullName}\n${fields.ListAgentCellPhone}\n${fields.ListAgentEmail || 'N/A'}`
            }
        }
    ];

    await sendSlackMessage(messageBlocks);
}

// Handle listing change
async function handleListingChange(listing) {
    try {
        // For testing, we'll use a simple comparison method
        const existingListing = sampleListings.find(l => l.Id === listing.Id);
        
        if (!existingListing) {
            // New listing
            sampleListings.push(listing);
            await sendStatusChangeNotification(listing);
            return;
        }

        // Check for status change
        if (existingListing.StandardFields.ListingStatus !== listing.StandardFields.ListingStatus) {
            await sendStatusChangeNotification(listing);
            existingListing.StandardFields.ListingStatus = listing.StandardFields.ListingStatus;
        }

        // Check for price change
        if (existingListing.StandardFields.ListPrice !== listing.StandardFields.ListPrice) {
            await sendPriceChangeNotification(listing, existingListing.StandardFields.ListPrice);
            existingListing.StandardFields.ListPrice = listing.StandardFields.ListPrice;
        }
    } catch (error) {
        console.error('Error processing listing change:', error);
    }
}

// Test interface routes
app.get('/test-interface', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>Listing Status Monitor - Test Interface</h1>
                <button onclick="testStatusChange()">Change to Pending</button>
                <button onclick="testPriceReduction()">Reduce Price 5%</button>
                <script>
                    async function testStatusChange() {
                        const response = await fetch('/test-change', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ type: 'status' })
                        });
                        const result = await response.text();
                        alert(result);
                    }
                    
                    async function testPriceReduction() {
                        const response = await fetch('/test-change', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ type: 'price' })
                        });
                        const result = await response.text();
                        alert(result);
                    }
                </script>
            </body>
        </html>
    `);
});

app.post('/test-change', async (req, res) => {
    try {
        const { type } = req.body;
        const listing = JSON.parse(JSON.stringify(sampleListings[0])); // Deep clone
        
        if (type === 'status') {
            listing.StandardFields.ListingStatus = 'Pending';
            listing.StandardFields.StatusChangeTimestamp = new Date().toISOString();
            await handleListingChange(listing);
            res.send('Status changed to Pending');
        } else if (type === 'price') {
            listing.StandardFields.ListPrice *= 0.95; // 5% reduction
            listing.StandardFields.StatusChangeTimestamp = new Date().toISOString();
            await handleListingChange(listing);
            res.send('Price reduced by 5%');
        } else {
            res.status(400).send('Invalid change type');
        }
    } catch (error) {
        console.error('Error in test change:', error);
        res.status(500).send('Error processing test change');
    }
});

// Spark webhook registration (placeholder)
async function registerSparkWebhook() {
    // This would be implemented with actual Spark API credentials
    console.log('Attempting to register Spark webhook');
    try {
        // Placeholder for actual webhook registration
        console.log('Webhook registration placeholder');
    } catch (error) {
        console.error('Error registering webhook:', error);
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await registerSparkWebhook();
});
