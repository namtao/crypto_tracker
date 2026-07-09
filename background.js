importScripts('coin-logos.js', 'exchanges.js', 'storage.js');

function formatBadgeChange(percent) {
    if (percent === 0) return "0";
    const sign = percent > 0 ? "+" : "-";
    const abs = Math.abs(percent);

    // Nếu tỉ lệ biến động trên 100%, chỉ hiện số làm tròn (VD: +150)
    if (abs >= 99.5) return sign + Math.round(abs);       // "+100"

    // Cố gắng rút gọn nhất có thể: "+1.2", "-5", để tránh badge quá to
    if (Number.isInteger(abs)) return sign + abs;         // "+5"
    return sign + abs.toFixed(1);                         // "+1.2" (tối đa 4 ký tự nhưng thường là 3-4 ký tự)
}

async function updateBadgeFromCoins(coins) {
    if (!coins.length) return;
    const stored = await chrome.storage.local.get("badgeRotationIndex");
    const currentIndex = (stored.badgeRotationIndex || 0) % coins.length;
    await chrome.storage.local.set({ badgeRotationIndex: currentIndex + 1 });
    const coin = coins[currentIndex];

    chrome.action.setBadgeText({ text: formatBadgeChange(coin.change) });

    // Đổi màu xanh nếu tăng, đỏ nếu giảm (làm màu bớt chói để chữ dễ đọc)
    const color = coin.change >= 0 ? "#1E9D5C" : "#E33D3D";
    chrome.action.setBadgeBackgroundColor({ color: color });

    const tooltipLines = coins.map(c => {
        const p = c.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const sign = c.change > 0 ? '+' : '';
        return `${c.symbol}: $${p} (${sign}${c.change.toFixed(2)}%)`;
    });
    chrome.action.setTitle({ title: tooltipLines.join('\n') });

    // Cập nhật icon từ logo cache (CoinGecko) hoặc fallback SVG
    const iconUrls = await getCoinLogoUrls([coin.symbol]);
    const iconUrl = iconUrls[coin.symbol.toUpperCase()];

    if (iconUrl.startsWith('data:')) {
        fallbackDrawIcon(coin.symbol);
        return;
    }

    try {
        const iconRes = await fetch(iconUrl);
        if (iconRes.ok) {
            const blob = await iconRes.blob();
            const bitmap = await createImageBitmap(blob);

            const canvas = new OffscreenCanvas(128, 128);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 128, 128);

            // Vẽ icon lấp đầy gần như toàn bộ không gian để to rõ ràng nhất có thể
            // Lệch cực ít về trái để né badge nhưng vẫn giữ được độ lớn.
            ctx.drawImage(bitmap, -6, -6, 134, 134);

            const imageData = ctx.getImageData(0, 0, 128, 128);
            chrome.action.setIcon({ imageData: imageData });
        } else {
            fallbackDrawIcon(coin.symbol);
        }
    } catch (err) {
        console.error("Icon fetch error", err);
        fallbackDrawIcon(coin.symbol);
    }
}

function fallbackDrawIcon(shortName) {
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#FF9900';
    ctx.beginPath();
    // Vẽ vòng tròn to hết cỡ lấp đầy ô canvas (bán kính 64, tâm 64,64)
    ctx.arc(64, 64, 64, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (shortName.length <= 3) ctx.font = 'bold 44px sans-serif';
    else if (shortName.length === 4) ctx.font = 'bold 34px sans-serif';
    else ctx.font = 'bold 24px sans-serif';

    // Đẩy text dịch lên trên 1 chút (y=50) để chừa góc dưới cho badge
    ctx.fillText(shortName.slice(0, 4).toUpperCase(), 64, 50);

    const imageData = ctx.getImageData(0, 0, 128, 128);
    chrome.action.setIcon({ imageData: imageData });
}

async function fetchPriceAndUpdateBadge() {
    const coins = await getTrackedCoins();
    if (coins.length === 0) {
        chrome.action.setBadgeText({ text: "" });
        return;
    }

    const exchange = getExchange(await getSelectedExchangeId());
    const marketType = await getSelectedMarketType();

    try {
        const results = await Promise.allSettled(
            coins.map(async (symbol) => {
                const data = await exchange.fetchPrice(exchange.toApiSymbol(symbol, marketType), marketType);
                return { symbol, price: data.price, change: data.change };
            })
        );

        const fetchedCoins = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

        if (fetchedCoins.length === 0) {
            chrome.action.setBadgeText({ text: "ERR" });
            return;
        }

        // Cache prices so popup can rotate badge every 5s without re-fetching
        await chrome.storage.local.set({ cachedPrices: fetchedCoins });
        updateBadgeFromCoins(fetchedCoins);

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
    } else if (msg.type === 'refreshPrices') {
        fetchPriceAndUpdateBadge();
    }
});

function ensureAlarm() {
    chrome.alarms.get("updatePrice", (alarm) => {
        if (!alarm) {
            chrome.alarms.create("updatePrice", { periodInMinutes: 1 });
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    fetchPriceAndUpdateBadge();
    ensureAlarm();
});

chrome.runtime.onStartup.addListener(() => {
    fetchPriceAndUpdateBadge();
    ensureAlarm();
});

// Fallback: Nếu Service Worker bị ngủ thì alarm sẽ gọi lại
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "updatePrice") {
        fetchPriceAndUpdateBadge();
    }
});

// Chạy vòng lặp cập nhật mỗi 10 giây (khi Service Worker đang hoạt động)
// Việc gọi hàm fetch() mỗi 10s sẽ giúp reset thời gian idle của Chrome,
// giữ cho Service Worker luôn sống và badge được cập nhật liên tục.
setInterval(() => {
    fetchPriceAndUpdateBadge();
}, 10000);
