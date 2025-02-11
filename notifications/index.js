const { 
    sendStatusChangeSlack, 
    sendPriceChangeSlack, 
    sendOpenHouseSlack 
} = require('./slack');

async function handleListingChange(notification) {
    console.log("Processing listing change:", JSON.stringify(notification, null, 2));
    // Add the logic to handle different listing changes
}

module.exports = {
    handleListingChange
};

async function sendStatusChange(listingDetails, oldStatus, newStatus) {
    try {
        await sendStatusChangeSlack(listingDetails, oldStatus, newStatus);
    } catch (error) {
        console.error('Error sending Slack notification:', error);
    }
}

async function sendPriceChange(listingDetails, oldPrice, newPrice) {
    try {
        await sendPriceChangeSlack(listingDetails, oldPrice, newPrice);
    } catch (error) {
        console.error('Error sending Slack notification:', error);
    }
}

async function sendOpenHouse(listingDetails, openHouse) {
    try {
        await sendOpenHouseSlack(listingDetails, openHouse);
    } catch (error) {
        console.error('Error sending Slack notification:', error);
    }
}

module.exports = {
    sendStatusChange,
    sendPriceChange,
    sendOpenHouse
};
