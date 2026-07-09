// Shared exchange adapters. Each adapter knows how to turn a short coin symbol
// (e.g. "BTC") into that exchange's API symbol format and how to fetch price +
// % change since 00:00 UTC (the metric the whole extension is built around),
// for either the spot or the futures (USDT-margined perpetual) market.
const EXCHANGES = {
    binance: {
        label: 'Binance',
        toApiSymbol: (short) => `${short}USDT`,
        async fetchPrice(apiSymbol, marketType) {
            const base = marketType === 'futures'
                ? 'https://fapi.binance.com/fapi/v1/klines'
                : 'https://api.binance.com/api/v3/klines';
            const res = await fetch(`${base}?symbol=${apiSymbol}&interval=1d&limit=1`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!data[0]) throw new Error('No price in response');
            const openPrice = parseFloat(data[0][1]);
            const currentPrice = parseFloat(data[0][4]);
            return { price: currentPrice, change: ((currentPrice - openPrice) / openPrice) * 100 };
        }
    },
    okx: {
        label: 'OKX',
        toApiSymbol: (short, marketType) => marketType === 'futures' ? `${short}-USDT-SWAP` : `${short}-USDT`,
        async fetchPrice(apiSymbol) {
            const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${apiSymbol}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const d = json.data && json.data[0];
            if (!d) throw new Error('No price in response');
            const currentPrice = parseFloat(d.last);
            const openPrice = parseFloat(d.sodUtc0); // giá mở đầu ngày UTC 00:00
            return { price: currentPrice, change: ((currentPrice - openPrice) / openPrice) * 100 };
        }
    },
    bitget: {
        label: 'Bitget',
        toApiSymbol: (short) => `${short}USDT`,
        async fetchPrice(apiSymbol, marketType) {
            const url = marketType === 'futures'
                ? `https://api.bitget.com/api/v2/mix/market/ticker?symbol=${apiSymbol}&productType=USDT-FUTURES`
                : `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${apiSymbol}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const d = json.data && json.data[0];
            if (!d) throw new Error('No price in response');
            const currentPrice = parseFloat(d.lastPr);
            const change = parseFloat(d.changeUtc24h) * 100; // Bitget đã tính sẵn % đổi từ 00:00 UTC
            return { price: currentPrice, change };
        }
    }
};

const DEFAULT_EXCHANGE_ID = 'binance';
const DEFAULT_MARKET_TYPE = 'futures'; // hành vi gốc của extension chỉ dùng Binance Futures

function getExchange(exchangeId) {
    return EXCHANGES[exchangeId] || EXCHANGES[DEFAULT_EXCHANGE_ID];
}
