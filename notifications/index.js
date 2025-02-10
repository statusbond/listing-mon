const { 
    sendStatusChangeSlack, 
    sendPriceChangeSlack, 
    sendOpenHouseSlack 
} = require('./slack');

const { 
    sendStatusChangeSMS, 
    sendPriceChangeSMS, 
    sendOpenHouseSMS 
} = require('./twilio');

async function sendStatusChange(listingDetails, oldStatus, newStatus) {
    try {
        await Promise.all([
            sendStatusChangeSlack(listingDetails, oldStatus, newStatus),
            sendStatusChangeSMS(listingDetails, oldStatus, newStatus)
        ]);
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}

async function sendPriceChange(listingDetails, oldPrice, newPrice) {
    try {
        await Promise.all([
            sendPriceChangeSlack(listingDetails, oldPrice, newPrice),
            sendPriceChangeSMS(listingDetails, oldPrice, newPrice)
        ]);
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}

async function sendOpenHouse(listingDetails, openHouse) {
    try {
        await Promise.all([
            sendOpenHouseSlack(listingDetails, openHouse),
            sendOpenHouseSMS(listingDetails, openHouse)
        ]);
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}

module.exports = {
    sendStatusChange,
    sendPriceChange,
    sendOpenHouse
};
