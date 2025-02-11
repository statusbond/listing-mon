async function sendSlackMessage(message) {
    console.log("Attempting to send Slack message:", JSON.stringify(message, null, 2));

    const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Slack response error:", {
            status: response.status,
            statusText: response.statusText,
            errorBody: errorText
        });
        throw new Error(`Failed to send to Slack: ${response.status} ${response.statusText}`);
    }

    console.log("Successfully sent message to Slack");
}

async function sendStatusChangeSlack(listingDetails, oldStatus, newStatus) {
    const message = {
        text: `🏠 Listing Status Change Alert! ${listingDetails.address} changed from ${oldStatus} to ${newStatus}.`
    };
    await sendSlackMessage(message);
}

async function sendPriceChangeSlack(listingDetails, oldPrice, newPrice) {
    const priceChange = newPrice - oldPrice;
    const changePercent = ((priceChange / oldPrice) * 100).toFixed(1);
    const changeDirection = priceChange > 0 ? "⬆️ Price Increase" : "⬇️ Price Reduction";
    
    const message = {
        text: `${changeDirection}! ${listingDetails.address} price changed from $${oldPrice.toLocaleString()} to $${newPrice.toLocaleString()} (${changePercent}%).`
    };
    await sendSlackMessage(message);
}

async function sendOpenHouseSlack(listingDetails, openHouse) {
    const message = {
        text: `📅 Open House Alert! ${listingDetails.address} has an open house on ${openHouse.Date} from ${openHouse.StartTime} to ${openHouse.EndTime}.`
    };
    await sendSlackMessage(message);
}

module.exports = {
    sendStatusChangeSlack,
    sendPriceChangeSlack,
    sendOpenHouseSlack
};
