async function fetchPriceAndUpdateBadge() {
    const symbol = await getSelectedSymbol();
    try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const price = parseFloat(data.price);

        const formatted = price.toLocaleString("de-DE", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        });

        const badgeText = formatted.slice(0, 5);
        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: "#228B22" });
    } catch (err) {
        console.error('Background fetch error:', err);
        chrome.action.setBadgeText({ text: "ERR" });
    }
}

function getSelectedSymbol() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["selectedSymbol"], (result) => {
            resolve(result.selectedSymbol || "BTCUSDT");
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    fetchPriceAndUpdateBadge();
    chrome.alarms.create("updatePrice", { periodInMinutes: 0.05 });
});

chrome.runtime.onStartup.addListener(() => {
    fetchPriceAndUpdateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "updatePrice") {
        fetchPriceAndUpdateBadge();
    }
});
