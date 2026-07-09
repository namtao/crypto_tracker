# Crypto Price Tracker

Chrome extension theo dõi giá cryptocurrency theo thời gian thực, hiển thị badge trên icon và popup danh sách coin tuỳ chọn.

## Tính năng

- Theo dõi nhiều coin cùng lúc, thêm/xoá trực tiếp trong popup.
- Chọn nguồn giá: **Binance**, **OKX**, hoặc **Bitget**.
- Chọn loại thị trường: **Spot** hoặc **Futures**.
- % thay đổi giá tính từ 00:00 UTC.
- Badge icon xoay vòng hiển thị % thay đổi của từng coin, đổi màu xanh/đỏ theo tăng/giảm.
- Logo coin lấy từ [CoinGecko](https://www.coingecko.com/en/api) (cache 30 ngày).

## Cài đặt (chế độ Developer)

1. Mở Chrome, vào `chrome://extensions`.
2. Bật **Developer mode** (góc trên phải).
3. Chọn **Load unpacked**, trỏ tới thư mục project này.
4. Extension xuất hiện trên toolbar, click icon để mở popup.

## Nguồn dữ liệu

- Giá: API public (không cần key) của Binance, OKX, Bitget.
- Logo: API public của CoinGecko.