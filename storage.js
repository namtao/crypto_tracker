// Shared chrome.storage.local access for tracked coins + selected exchange.
// Migrates the older "selectedSymbols"/"selectedSymbol" (full pair, Binance-only)
// schema to the exchange-agnostic "trackedCoins" (short symbols) schema.
const DEFAULT_TRACKED_COINS = ['BTC', 'ETH'];

async function migrateLegacyTrackedCoins() {
    const { trackedCoins, selectedSymbols, selectedSymbol } = await chrome.storage.local.get(
        ['trackedCoins', 'selectedSymbols', 'selectedSymbol']
    );
    if (trackedCoins && trackedCoins.length) return trackedCoins;

    let migrated = null;
    if (selectedSymbols && selectedSymbols.length) {
        migrated = selectedSymbols.map(s => s.replace('USDT', ''));
    } else if (selectedSymbol) {
        migrated = [selectedSymbol.replace('USDT', '')];
    }

    if (migrated) {
        await chrome.storage.local.set({ trackedCoins: migrated });
        return migrated;
    }
    return null;
}

async function getTrackedCoins() {
    const migrated = await migrateLegacyTrackedCoins();
    return migrated && migrated.length ? migrated : DEFAULT_TRACKED_COINS;
}

async function setTrackedCoins(coins) {
    await chrome.storage.local.set({ trackedCoins: coins });
}

async function getSelectedExchangeId() {
    const { selectedExchange } = await chrome.storage.local.get('selectedExchange');
    return selectedExchange || DEFAULT_EXCHANGE_ID;
}

async function setSelectedExchangeId(exchangeId) {
    await chrome.storage.local.set({ selectedExchange: exchangeId });
}

async function getSelectedMarketType() {
    const { selectedMarketType } = await chrome.storage.local.get('selectedMarketType');
    return selectedMarketType || DEFAULT_MARKET_TYPE;
}

async function setSelectedMarketType(marketType) {
    await chrome.storage.local.set({ selectedMarketType: marketType });
}
