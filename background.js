let badgeRotationIndex = 0;

async function fetchPrice(symbol) {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return parseFloat(data.price);
}

async function fetchPriceAndUpdateBadge() {
    const symbols = await getSelectedSymbols();
    if (symbols.length === 0) {
        chrome.action.setBadgeText({ text: "" });
        return;
    }

    try {
        const results = await Promise.allSettled(
            symbols.map(async (symbol) => {
                const price = await fetchPrice(symbol);
                return { symbol, price };
            })
        );

        const coins = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

        if (coins.length === 0) {
            chrome.action.setBadgeText({ text: "ERR" });
            return;
        }

        // Rotating badge text through selected coins
        const rotatingCoin = coins[badgeRotationIndex % coins.length];
        badgeRotationIndex++;

        const formatted = rotatingCoin.price.toLocaleString("de-DE", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        });
        chrome.action.setBadgeText({ text: formatted.slice(0, 5) });
        chrome.action.setBadgeBackgroundColor({ color: "#228B22" });

        // Tooltip shows all coin prices
        const tooltipLines = coins.map(c => {
            const s = c.symbol.replace('USDT', '');
            const p = c.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return `${s}: $${p}`;
        });
        chrome.action.setTitle({ title: tooltipLines.join('\n') });

    } catch (err) {
        console.error('Background fetch error:', err);
        chrome.action.setBadgeText({ text: "ERR" });
    }
}

function getSelectedSymbols() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["selectedSymbols", "selectedSymbol"], (result) => {
            if (result.selectedSymbols && result.selectedSymbols.length > 0) {
                resolve(result.selectedSymbols);
            } else if (result.selectedSymbol) {
                resolve([result.selectedSymbol]);
            } else {
                resolve(["BTCUSDT"]);
            }
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
