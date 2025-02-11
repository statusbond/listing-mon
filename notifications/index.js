const { 
    sendStatusChangeSlack, 
    sendPriceChangeSlack, 
    sendOpenHouseSlack 
} = require('./slack');

async function handleListingChange(notification) {
    console.log("Processing listing change:", JSON.stringify(notification, null, 2));
    
    if (!listingDetails) {
        console.error("Failed to fetch listing details, skipping Slack notification.");
        return;
    }

    if (notification.NewsFeed.Event === 'StatusChange') {
        console.log("Triggering sendStatusChange...");
        await sendStatusChange(
            listingDetails,
            notification.OldStatus,
            notification.NewStatus
        );
    }
}

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
    handleListingChange,
    sendStatusChange,
    sendPriceChange,
    sendOpenHouse
};
