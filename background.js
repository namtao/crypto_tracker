async function fetchPrice(symbol) {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return parseFloat(data.price);
}

function formatBadgePrice(price) {
    if (price >= 10000) return (price / 1000).toFixed(1);            // "100.0"
    if (price >= 1000)  { const s = String(Math.round(price)); return s[0] + '.' + s.slice(1); } // "3.000"
    if (price >= 100)   return price.toFixed(1);                     // "150.4"
    if (price >= 10)    return price.toFixed(2);                     // "32.45"
    if (price >= 1)     return price.toFixed(3);                     // "3.456"
    return price.toFixed(4).slice(0, 5);                             // "0.123"
}

async function updateBadgeFromCoins(coins) {
    if (!coins.length) return;
    const stored = await chrome.storage.local.get("badgeRotationIndex");
    const currentIndex = (stored.badgeRotationIndex || 0) % coins.length;
    await chrome.storage.local.set({ badgeRotationIndex: currentIndex + 1 });
    const coin = coins[currentIndex];
    chrome.action.setBadgeText({ text: formatBadgePrice(coin.price) });
    chrome.action.setBadgeBackgroundColor({ color: "#228B22" });
    const tooltipLines = coins.map(c => {
        const s = c.symbol.replace('USDT', '');
        const p = c.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${s}: $${p}`;
    });
    chrome.action.setTitle({ title: tooltipLines.join('\n') });
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

        // Cache prices so popup can rotate badge every 5s without re-fetching
        await chrome.storage.local.set({ cachedPrices: coins });
        updateBadgeFromCoins(coins);

    } catch (err) {
        console.error('Background fetch error:', err);
        chrome.action.setBadgeText({ text: "ERR" });
    }
}

// Popup asks background to rotate badge using cached prices
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'rotateBadge') {
        chrome.storage.local.get('cachedPrices', ({ cachedPrices }) => {
            if (cachedPrices && cachedPrices.length) updateBadgeFromCoins(cachedPrices);
        });
    }
});

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

function ensureAlarm() {
    chrome.alarms.get("updatePrice", (alarm) => {
        if (!alarm) {
            chrome.alarms.create("updatePrice", { periodInMinutes: 0.5 });
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    fetchPriceAndUpdateBadge();
    chrome.alarms.create("updatePrice", { periodInMinutes: 0.5 });
});

chrome.runtime.onStartup.addListener(() => {
    fetchPriceAndUpdateBadge();
    ensureAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "updatePrice") {
        fetchPriceAndUpdateBadge();
    }
});
