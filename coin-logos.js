// Logo lookup via CoinGecko public API (no key needed), cached in
// chrome.storage.local for 30 days since logos almost never change and the
// public API is rate-limited. Falls back to a generated letter-avatar SVG
// for symbols CoinGecko doesn't recognize or when the API call fails.
const LOGO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function buildFallbackLogo(shortSymbol) {
    const label = shortSymbol.slice(0, 3).toUpperCase();
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23FF9900'/><text x='50' y='50' font-size='30' text-anchor='middle' alignment-baseline='central' fill='white' font-weight='bold'>${label}</text></svg>`;
}

// Returns { SHORTSYMBOL: logoUrl } for every symbol in shortSymbols.
async function getCoinLogoUrls(shortSymbols) {
    const now = Date.now();
    const { logoCache } = await chrome.storage.local.get('logoCache');
    const cache = logoCache || {};

    const missing = shortSymbols.filter(s => {
        const entry = cache[s.toUpperCase()];
        return !entry || (now - entry.fetchedAt) > LOGO_CACHE_TTL_MS;
    });

    if (missing.length) {
        try {
            const query = missing.map(s => s.toLowerCase()).join(',');
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${query}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const imageBySymbol = {};
                // CoinGecko sorts by market cap desc; first hit per symbol wins.
                for (const coin of data) {
                    const sym = coin.symbol.toUpperCase();
                    if (!imageBySymbol[sym]) imageBySymbol[sym] = coin.image;
                }
                for (const s of missing) {
                    cache[s.toUpperCase()] = { url: imageBySymbol[s.toUpperCase()] || null, fetchedAt: now };
                }
                await chrome.storage.local.set({ logoCache: cache });
            }
        } catch (err) {
            console.error('CoinGecko logo fetch error', err);
        }
    }

    const result = {};
    for (const s of shortSymbols) {
        const entry = cache[s.toUpperCase()];
        result[s.toUpperCase()] = (entry && entry.url) || buildFallbackLogo(s);
    }
    return result;
}
