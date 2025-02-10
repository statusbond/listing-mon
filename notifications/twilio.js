const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function sendSMS(message) {
    try {
        await client.messages.create({
            body: message,
            to: process.env.NOTIFICATION_PHONE_NUMBER,
            from: process.env.TWILIO_FROM_NUMBER
        });
        console.log('Successfully sent SMS');
    } catch (error) {
        console.error('Twilio error:', error);
        throw error;
    }
}

async function sendStatusChangeSMS(listingDetails, oldStatus, newStatus) {
    const message = `🏠 STATUS CHANGE
${listingDetails.address}, ${listingDetails.city}
${oldStatus} → ${newStatus}
$${listingDetails.price.toLocaleString()}
Agent: ${listingDetails.agent}
Phone: ${listingDetails.agentCell || 'N/A'}`;

    await sendSMS(message);
}

async function sendPriceChangeSMS(listingDetails, oldPrice, newPrice) {
    const priceChange = newPrice - oldPrice;
    const changePercent = ((priceChange / oldPrice) * 100).toFixed(1);
    
    const message = `💰 PRICE UPDATE
${listingDetails.address}, ${listingDetails.city}
$${oldPrice.toLocaleString()} → $${newPrice.toLocaleString()}
(${changePercent}%, ${priceChange > 0 ? '+' : ''}$${priceChange.toLocaleString()})
Agent: ${listingDetails.agent}
Phone: ${listingDetails.agentCell || 'N/A'}`;

    await sendSMS(message);
}

async function sendOpenHouseSMS(listingDetails, openHouse) {
    const message = `📅 OPEN HOUSE
${listingDetails.address}, ${listingDetails.city}
${openHouse.Date}, ${openHouse.StartTime}-${openHouse.EndTime}
$${listingDetails.price.toLocaleString()} | ${listingDetails.beds}bd ${listingDetails.baths}ba
Agent: ${listingDetails.agent}
Phone: ${listingDetails.agentCell || 'N/A'}`;

    await sendSMS(message);
}

module.exports = {
    sendStatusChangeSMS,
    sendPriceChangeSMS,
    sendOpenHouseSMS
};
