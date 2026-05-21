document.addEventListener('DOMContentLoaded', () => {
    const coinCardsContainer = document.getElementById("coin-cards");
    const updateTimeDiv = document.getElementById("update-time");
    const addCoinInput = document.getElementById("add-coin-input");
    const addCoinBtn = document.getElementById("add-coin-btn");
    const addCoinError = document.getElementById("add-coin-error");

    if (!coinCardsContainer || !updateTimeDiv) {
        console.error('Missing DOM elements in popup.html');
        return;
    }

    // Map to store previous prices for each coin (for up/down animation)
    const previousPrices = {};

    // Known coin icons (fallback to 💰 for custom coins)
    const coinIcons = {
        BTC: '🟠', ETH: '🔷', HYPE: '🔗', BNB: '🟡',
        SOL: '🟣', XRP: '⚪', DOGE: '🐕', ADA: '🔵',
        AVAX: '🔺', DOT: '⚫', MATIC: '🟣', LINK: '🔵',
        UNI: '🦄', ATOM: '⚛️', FTM: '👻', NEAR: '🌐',
        APT: '🅰️', ARB: '🔵', OP: '🔴', SUI: '💧',
    };

    // Current tracked symbols
    let trackedSymbols = ["BTCUSDT", "ETHUSDT"];

    function getIcon(symbol) {
        const short = symbol.replace('USDT', '');
        return coinIcons[short] || '💰';
    }

    function getShortName(symbol) {
        return symbol.replace('USDT', '');
    }

    async function fetchPrice(symbol) {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.price) throw new Error('No price in response');
        return parseFloat(data.price);
    }

    async function fetchMultiplePrices(symbols) {
        return await Promise.allSettled(
            symbols.map(async (symbol) => {
                const price = await fetchPrice(symbol);
                return { symbol, price };
            })
        );
    }

    function formatPriceValue(price) {
        if (price >= 1000) {
            return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else if (price >= 1) {
            return price.toFixed(4);
        } else {
            return price.toFixed(8);
        }
    }

    function renderCoinCards(results) {
        coinCardsContainer.innerHTML = '';

        if (results.length === 0) {
            coinCardsContainer.innerHTML = '<div class="no-coins">Thêm coin bằng ô nhập phía dưới</div>';
            return;
        }

        results.forEach((result, index) => {
            const card = document.createElement('div');
            card.className = 'coin-card';

            if (result.status === 'fulfilled') {
                const { symbol, price } = result.value;
                const icon = getIcon(symbol);
                const short = getShortName(symbol);
                const formattedPrice = formatPriceValue(price);

                // Determine price direction
                let directionClass = '';
                let arrow = '';
                if (previousPrices[symbol] !== undefined) {
                    if (price > previousPrices[symbol]) {
                        directionClass = 'card-up';
                        arrow = ' ▲';
                    } else if (price < previousPrices[symbol]) {
                        directionClass = 'card-down';
                        arrow = ' ▼';
                    }
                }
                previousPrices[symbol] = price;

                if (directionClass) {
                    card.classList.add(directionClass);
                }

                card.innerHTML = `
                    <button class="remove-coin-btn" data-symbol="${symbol}" title="Xóa ${short}">✕</button>
                    <div class="coin-card-header">
                        <span class="coin-icon">${icon}</span>
                        <span class="coin-name">${short}</span>
                    </div>
                    <div class="coin-price">${formattedPrice}${arrow}</div>
                    <div class="coin-pair">USDT</div>
                `;
            } else {
                // Failed to fetch - still show card with symbol info
                const symbol = trackedSymbols[index];
                const short = symbol ? getShortName(symbol) : 'ERR';
                const icon = symbol ? getIcon(symbol) : '❌';

                card.innerHTML = `
                    <button class="remove-coin-btn" data-symbol="${symbol}" title="Xóa ${short}">✕</button>
                    <div class="coin-card-header">
                        <span class="coin-icon">${icon}</span>
                        <span class="coin-name">${short}</span>
                    </div>
                    <div class="coin-price">Lỗi tải</div>
                    <div class="coin-pair">USDT</div>
                `;
                card.classList.add('coin-card-error');
            }

            coinCardsContainer.appendChild(card);
        });

        // Attach remove button listeners
        coinCardsContainer.querySelectorAll('.remove-coin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const symbol = btn.dataset.symbol;
                removeCoin(symbol);
            });
        });

        // Remove animation classes after 700ms
        setTimeout(() => {
            coinCardsContainer.querySelectorAll('.card-up, .card-down').forEach(el => {
                el.classList.remove('card-up', 'card-down');
            });
        }, 700);
    }

    function removeCoin(symbol) {
        trackedSymbols = trackedSymbols.filter(s => s !== symbol);
        delete previousPrices[symbol];
        saveAndRefresh();
    }

    async function addCoin(input) {
        const raw = input.trim().toUpperCase();
        if (!raw) return;

        // Normalize: if user typed "BTC", convert to "BTCUSDT"
        const symbol = raw.endsWith('USDT') ? raw : raw + 'USDT';

        // Check if already tracked
        if (trackedSymbols.includes(symbol)) {
            showError(`${getShortName(symbol)} đã có trong danh sách`);
            return;
        }

        // Validate by trying to fetch price
        addCoinBtn.disabled = true;
        addCoinBtn.textContent = '…';
        try {
            await fetchPrice(symbol);
            trackedSymbols.push(symbol);
            addCoinInput.value = '';
            clearError();
            saveAndRefresh();
        } catch (err) {
            showError(`Không tìm thấy "${raw}" trên Binance Futures`);
        } finally {
            addCoinBtn.disabled = false;
            addCoinBtn.textContent = '＋';
        }
    }

    function showError(msg) {
        addCoinError.textContent = msg;
        addCoinError.style.display = 'block';
        setTimeout(() => clearError(), 3000);
    }

    function clearError() {
        addCoinError.textContent = '';
        addCoinError.style.display = 'none';
    }

    function saveAndRefresh() {
        chrome.storage.local.set({ selectedSymbols: trackedSymbols });
        updateAllPrices();
    }

    async function updateAllPrices() {
        if (trackedSymbols.length === 0) {
            coinCardsContainer.innerHTML = '<div class="no-coins">Thêm coin bằng ô nhập phía dưới</div>';
            updateTimeDiv.textContent = 'Chưa có dữ liệu';
            return;
        }

        const results = await fetchMultiplePrices(trackedSymbols);
        renderCoinCards(results);
        updateTimeDiv.textContent = 'Cập nhật lúc: ' + new Date().toLocaleTimeString('vi-VN');
    }

    // Add coin button click
    addCoinBtn.addEventListener('click', () => addCoin(addCoinInput.value));

    // Add coin on Enter key
    addCoinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addCoin(addCoinInput.value);
        }
    });

    // Restore saved selections from storage
    chrome.storage.local.get(["selectedSymbols", "selectedSymbol"], (result) => {
        if (result.selectedSymbols && result.selectedSymbols.length > 0) {
            trackedSymbols = result.selectedSymbols;
        } else if (result.selectedSymbol) {
            trackedSymbols = [result.selectedSymbol];
        } else {
            trackedSymbols = ["BTCUSDT", "ETHUSDT"];
        }

        updateAllPrices();
    });

    // Auto-refresh every 3 seconds
    const intervalId = setInterval(() => {
        updateAllPrices();
    }, 3000);

    window.addEventListener('unload', () => clearInterval(intervalId));
});
