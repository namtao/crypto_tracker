document.addEventListener('DOMContentLoaded', () => {
    const coinCardsContainer = document.getElementById("coin-cards");
    const updateTimeDiv = document.getElementById("update-time");
    const addCoinInput = document.getElementById("add-coin-input");
    const addCoinBtn = document.getElementById("add-coin-btn");
    const addCoinError = document.getElementById("add-coin-error");
    const exchangeCheckboxes = document.querySelectorAll('.exchange-checkbox-input');
    const marketTypeCheckboxes = document.querySelectorAll('.market-type-checkbox-input');

    if (!coinCardsContainer || !updateTimeDiv) {
        console.error('Missing DOM elements in popup.html');
        return;
    }

    // Map to store previous prices for each coin (for up/down animation)
    const previousPrices = {};

    // Current tracked coins (short symbols, e.g. "BTC"), selected exchange + market type
    let trackedCoins = ['BTC', 'ETH'];
    let exchangeId = DEFAULT_EXCHANGE_ID;
    let marketType = DEFAULT_MARKET_TYPE;

    async function fetchPrice(shortSymbol) {
        const exchange = getExchange(exchangeId);
        return await exchange.fetchPrice(exchange.toApiSymbol(shortSymbol, marketType), marketType);
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

    function renderCoinCards(results, logoUrls) {
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
                const currentPrice = price.price;
                const change = price.change;
                const iconUrl = logoUrls[symbol.toUpperCase()];

                const formattedPrice = formatPriceValue(currentPrice);

                // Determine price direction
                let directionClass = '';
                if (previousPrices[symbol] !== undefined) {
                    if (currentPrice > previousPrices[symbol]) {
                        directionClass = 'card-up';
                    } else if (currentPrice < previousPrices[symbol]) {
                        directionClass = 'card-down';
                    }
                }
                previousPrices[symbol] = currentPrice;

                if (directionClass) {
                    card.classList.add(directionClass);
                }
                card.classList.add(change >= 0 ? 'coin-trend-up' : 'coin-trend-down');

                const changeSign = change > 0 ? '+' : '';

                card.innerHTML = `
                    <button class="remove-coin-btn" data-symbol="${symbol}" title="Xóa ${symbol}">✕</button>
                    <div class="coin-row">
                        <div class="coin-info">
                            <img src="${iconUrl}" class="coin-icon" alt="${symbol}">
                            <span class="coin-name">${symbol}</span>
                        </div>
                        <div class="coin-values">
                            <div class="coin-price">${formattedPrice}</div>
                            <div class="coin-pair">${changeSign}${change.toFixed(2)}%</div>
                        </div>
                    </div>
                `;

                const imgEl = card.querySelector('img.coin-icon');
                if (imgEl) {
                    imgEl.addEventListener('error', function () {
                        this.src = buildFallbackLogo(symbol);
                    }, { once: true });
                }
            } else {
                // Failed to fetch - still show card with symbol info
                const symbol = trackedCoins[index] || 'ERR';
                const iconUrl = logoUrls[symbol.toUpperCase()] || buildFallbackLogo(symbol);

                card.innerHTML = `
                    <button class="remove-coin-btn" data-symbol="${symbol}" title="Xóa ${symbol}">✕</button>
                    <div class="coin-row">
                        <div class="coin-info">
                            <img src="${iconUrl}" class="coin-icon" alt="${symbol}">
                            <span class="coin-name">${symbol}</span>
                        </div>
                        <div class="coin-values">
                            <div class="coin-price">Lỗi tải</div>
                        </div>
                    </div>
                `;
                card.classList.add('coin-card-error');

                const imgEl = card.querySelector('img.coin-icon');
                if (imgEl) {
                    imgEl.addEventListener('error', function () {
                        this.src = buildFallbackLogo(symbol);
                    }, { once: true });
                }
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
        trackedCoins = trackedCoins.filter(s => s !== symbol);
        delete previousPrices[symbol];
        saveAndRefresh();
    }

    async function addCoin(input) {
        const raw = input.trim().toUpperCase();
        if (!raw) return;

        // Normalize: if user typed "BTCUSDT", keep just the short symbol "BTC"
        const symbol = raw.endsWith('USDT') ? raw.slice(0, -4) : raw;
        if (!symbol) return;

        // Check if already tracked
        if (trackedCoins.includes(symbol)) {
            showError(`${symbol} đã có trong danh sách`);
            return;
        }

        // Validate by trying to fetch price on the currently selected exchange
        addCoinBtn.disabled = true;
        addCoinBtn.textContent = '…';
        try {
            await fetchPrice(symbol);
            trackedCoins.push(symbol);
            addCoinInput.value = '';
            clearError();
            saveAndRefresh();
        } catch (err) {
            const marketLabel = marketType === 'futures' ? 'Futures' : 'Spot';
            showError(`Không tìm thấy "${raw}" trên ${getExchange(exchangeId).label} (${marketLabel})`);
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
        setTrackedCoins(trackedCoins);
        updateAllPrices();
    }

    async function updateAllPrices() {
        if (trackedCoins.length === 0) {
            coinCardsContainer.innerHTML = '<div class="no-coins">Thêm coin bằng ô nhập phía dưới</div>';
            updateTimeDiv.textContent = 'Chưa có dữ liệu';
            return;
        }

        const [results, logoUrls] = await Promise.all([
            fetchMultiplePrices(trackedCoins),
            getCoinLogoUrls(trackedCoins)
        ]);
        renderCoinCards(results, logoUrls);
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

    // Only one checkbox per group can be active at a time (radio behavior via checkboxes).
    // Trying to uncheck the active one snaps it back checked - there's always exactly one selection.
    function setupExclusiveCheckboxGroup(checkboxes, onSelect) {
        function setActive(value) {
            checkboxes.forEach(cb => { cb.checked = (cb.value === value); });
        }
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) {
                    cb.checked = true;
                    return;
                }
                setActive(cb.value);
                onSelect(cb.value);
            });
        });
        return setActive;
    }

    // Switching exchange or market type re-fetches every tracked coin from the
    // new source and tells the background badge to do the same.
    const setActiveExchangeCheckbox = setupExclusiveCheckboxGroup(exchangeCheckboxes, (value) => {
        exchangeId = value;
        setSelectedExchangeId(exchangeId);
        chrome.runtime.sendMessage({ type: 'refreshPrices' });
        updateAllPrices();
    });

    const setActiveMarketTypeCheckbox = setupExclusiveCheckboxGroup(marketTypeCheckboxes, (value) => {
        marketType = value;
        setSelectedMarketType(marketType);
        chrome.runtime.sendMessage({ type: 'refreshPrices' });
        updateAllPrices();
    });

    // Restore saved coins + exchange + market type from storage, then start polling
    (async () => {
        trackedCoins = await getTrackedCoins();
        exchangeId = await getSelectedExchangeId();
        marketType = await getSelectedMarketType();
        setActiveExchangeCheckbox(exchangeId);
        setActiveMarketTypeCheckbox(marketType);

        updateAllPrices();
    })();

    // Auto-refresh prices every 3 seconds
    const priceIntervalId = setInterval(updateAllPrices, 3000);

    // Rotate badge every 5 seconds while popup is open
    // (background alarm minimum is 30s; popup drives 5s rotation when visible)
    const badgeIntervalId = setInterval(() => {
        chrome.runtime.sendMessage({ type: 'rotateBadge' });
    }, 5000);

    window.addEventListener('unload', () => {
        clearInterval(priceIntervalId);
        clearInterval(badgeIntervalId);
    });
});
