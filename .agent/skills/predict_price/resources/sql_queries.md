# SQL Queries — predict_price Skill

Các câu SQL chuẩn. Thay `:params` bằng giá trị thực — KHÔNG dùng string concatenation.

---

## Query 1: Load Currency Code từ Market

```sql
SELECT currency_code
FROM markets
WHERE market_id = :market_id;
```

**Params:** `:market_id` (INT)  
**Expected:** 1 row. Nếu 0 row → lỗi `"market_id không tồn tại"`.

---

## Query 2: Load Price History

```sql
SELECT price, captured_at
FROM variant_price_history
WHERE variant_id  = :variant_id
  AND market_id   = :market_id
  AND price_type  = :price_type
ORDER BY captured_at ASC;
```

**Params:**
- `:variant_id` — BIGINT
- `:market_id` — INT
- `:price_type` — ENUM('msrp','avg_market','avg_listing')

**Xử lý kết quả:**
```javascript
const rows = await query(sql, { variant_id, market_id, price_type });
const history_points = rows.length;

if (history_points < 8) {
  // fail gracefully
}

// Lấy 12 điểm cuối (window)
const window = rows.slice(-12);
const last_price = rows[rows.length - 1]?.price ?? null;
```

---

## Query 3: (Optional) Verify variant exists

```sql
SELECT COUNT(*) AS cnt
FROM variant_price_history
WHERE variant_id = :variant_id;
```

Dùng để phân biệt "variant không tồn tại" vs "variant tồn tại nhưng không có data cho market+price_type này".

---

## Với Sequelize

```javascript
const { VariantPriceHistory, Market } = require('../models');

// Load market currency
const market = await Market.findByPk(market_id, {
  attributes: ['currency_code'],
  raw: true
});
if (!market) throw new Error('market_id không tồn tại');

// Load history
const history = await VariantPriceHistory.findAll({
  where: { variant_id, market_id, price_type },
  attributes: ['price', 'captured_at'],
  order: [['captured_at', 'ASC']],
  raw: true
});
```

---

## Notes

- `price_type` là ENUM — **không cho phép giá trị tùy ý**. Nếu user truyền sai → dùng `'avg_market'` và ghi notes
- `captured_at` phải ở dạng DATETIME để tính x_i (số tháng). Parse bằng Date object, không dùng string diff
- `price` là DECIMAL(14,2) — đọc về số JavaScript sẽ giữ precision đủ cho tính toán
