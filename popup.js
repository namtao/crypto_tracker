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

    // Current tracked symbols
    let trackedSymbols = ["BTCUSDT", "ETHUSDT"];

    function getShortName(symbol) {
        return symbol.replace('USDT', '');
    }

    async function fetchPrice(symbol) {
        // klines interval=1d bắt đầu từ 00:00 UTC (tức 7h sáng giờ VN)
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1d&limit=1`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data[0] || !data[0][4]) throw new Error('No price in response');
        
        const openPrice = parseFloat(data[0][1]); // Giá mở cửa lúc 7h sáng
        const currentPrice = parseFloat(data[0][4]); // Giá hiện tại
        const change = ((currentPrice - openPrice) / openPrice) * 100;
        
        return { price: currentPrice, change: change };
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
                const currentPrice = price.price;
                const change = price.change;
                const short = getShortName(symbol);
                
                const iconUrl = getCoinLogoUrl(short);

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
                
                const changeColor = change >= 0 ? '#228B22' : '#DC143C';
                const changeSign = change > 0 ? '+' : '';

                // Tránh lỗi CSP bằng cách bỏ onerror inline và gắn sự kiện bằng addEventListener
                const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23FF9900'/><text x='50' y='50' font-size='30' text-anchor='middle' alignment-baseline='central' fill='white' font-weight='bold'>${short.slice(0,3)}</text></svg>`;

                card.innerHTML = `
                    <button class="remove-coin-btn" data-symbol="${symbol}" title="Xóa ${short}">✕</button>
                    <div class="coin-card-header">
                        <img src="${iconUrl}" class="coin-icon" alt="${short}" style="width: 24px; height: 24px; border-radius: 50%; vertical-align: middle;">
                        <span class="coin-name">${short}</span>
                    </div>
                    <div class="coin-price">${formattedPrice}</div>
                    <div class="coin-pair">
                        USDT <span style="color: ${changeColor}; font-weight: bold; margin-left: 4px;">${changeSign}${change.toFixed(2)}%</span>
                    </div>
                `;
                
                const imgEl = card.querySelector('img.coin-icon');
                if (imgEl) {
                    imgEl.addEventListener('error', function() {
                        this.src = fallbackSvg;
                    }, { once: true });
                }
            } else {
                // Failed to fetch - still show card with symbol info
                const symbol = trackedSymbols[index];
                const short = symbol ? getShortName(symbol) : 'ERR';
                
                const iconUrl = getCoinLogoUrl(short);
                const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23DC143C'/><text x='50' y='50' font-size='30' text-anchor='middle' alignment-baseline='central' fill='white' font-weight='bold'>ERR</text></svg>`;

                card.innerHTML = `
                    <button class="remove-coin-btn" data-symbol="${symbol}" title="Xóa ${short}">✕</button>
                    <div class="coin-card-header">
                        <img src="${iconUrl}" class="coin-icon" alt="${short}" style="width: 24px; height: 24px; border-radius: 50%; vertical-align: middle;">
                        <span class="coin-name">${short}</span>
                    </div>
                    <div class="coin-price">Lỗi tải</div>
                    <div class="coin-pair">USDT</div>
                `;
                card.classList.add('coin-card-error');
                
                const imgEl = card.querySelector('img.coin-icon');
                if (imgEl) {
                    imgEl.addEventListener('error', function() {
                        this.src = fallbackSvg;
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
