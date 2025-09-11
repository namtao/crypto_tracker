document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById("coin-select");
    const priceDiv = document.getElementById("price");
    const updateTimeDiv = document.getElementById("update-time");

    if (!select || !priceDiv || !updateTimeDiv) {
        console.error('Missing DOM elements in popup.html');
        return;
    }

    let previousPrice = null;
    const spinnerHtml = '<span class="spinner"></span> Đang tải...';

    async function fetchPrice(symbol) {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.price) throw new Error('No price in response');
        return parseFloat(data.price);
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

    async function updatePriceAndStorage(symbol) {
        try {
            priceDiv.innerHTML = spinnerHtml;
            const currentPrice = await fetchPrice(symbol);
            const formattedPrice = formatPriceValue(currentPrice);

            // hiệu ứng lên/xuống
            priceDiv.classList.remove('price-up', 'price-down');
            if (previousPrice !== null) {
                if (currentPrice > previousPrice) priceDiv.classList.add('price-up');
                else if (currentPrice < previousPrice) priceDiv.classList.add('price-down');
            }

            priceDiv.textContent = `${formattedPrice} ${symbol.slice(-4)}`;
            previousPrice = currentPrice;

            chrome.storage.local.set({ selectedSymbol: symbol }, () => { /* optional callback */ });

            updateTimeDiv.textContent = 'Cập nhật lúc: ' + new Date().toLocaleTimeString('vi-VN');

            // xóa class animation sau 700ms để không giữ trạng thái
            setTimeout(() => priceDiv.classList.remove('price-up', 'price-down'), 700);
        } catch (err) {
            console.error('Lỗi lấy giá:', err);
            priceDiv.textContent = '❌ Lỗi tải dữ liệu';
            updateTimeDiv.textContent = 'Lỗi kết nối';
        }
    }

    select.addEventListener('change', (e) => {
        const symbol = e.target.value;
        previousPrice = null;
        updatePriceAndStorage(symbol);
    });

    chrome.storage.local.get(["selectedSymbol"], (result) => {
        const saved = result.selectedSymbol || "BTCUSDT";
        select.value = saved;
        updatePriceAndStorage(saved);
    });

    const intervalId = setInterval(() => {
        updatePriceAndStorage(select.value);
    }, 3000);

    window.addEventListener('unload', () => clearInterval(intervalId));
});
