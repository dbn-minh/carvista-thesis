# Ví dụ 3: Thiếu data — Fail Gracefully

## Case: history_points < 8 → predicted_* = null

### Input
```json
{
  "variant_id": 999,
  "market_id": 2,
  "price_type": "avg_market",
  "horizon_months": 6
}
```

---

### DB Data

**markets:** `market_id=2, currency_code="USD"`

**variant_price_history:** Chỉ có **3 rows**:
| # | captured_at | price |
|---|---|---|
| 1 | 2025-04-01 | 31000.00 |
| 2 | 2025-05-01 | 30900.00 |
| 3 | 2025-06-01 | 31100.00 |

---

### Xử lý

```
history_points = 3
history_points < 8 → KHÔNG tính regression
→ Dừng tại Bước 3, trả null cho tất cả predicted_*
```

**Không được:**
- ❌ Bịa ra trend_slope từ 3 điểm
- ❌ Dùng kiến thức LLM về giá xe
- ❌ Lấy giá từ nguồn khác

---

### Output JSON

```json
{
  "variant_id": 999,
  "market_id": 2,
  "currency": "USD",
  "price_type": "avg_market",
  "history_points": 3,
  "last_price": 31100.00,
  "horizon_months": 6,
  "predicted_price": null,
  "predicted_min": null,
  "predicted_max": null,
  "trend_slope": null,
  "volatility": null,
  "confidence_score": 0,
  "notes": "insufficient_history: only 3 points found, minimum 8 required."
}
```

> `last_price` vẫn trả về (điểm gần nhất từ DB) — hữu ích để user biết giá hiện tại.  
> `confidence_score = 0` — không tin cậy gì cả.

---

## Case phụ: variant_id không có row nào

```json
{
  "variant_id": 888,
  "market_id": 1,
  "price_type": "avg_market",
  "horizon_months": 6
}
```

→ history_points = 0, last_price = null

```json
{
  "variant_id": 888,
  "market_id": 1,
  "currency": "USD",
  "price_type": "avg_market",
  "history_points": 0,
  "last_price": null,
  "horizon_months": 6,
  "predicted_price": null,
  "predicted_min": null,
  "predicted_max": null,
  "trend_slope": null,
  "volatility": null,
  "confidence_score": 0,
  "notes": "insufficient_history: only 0 points found, minimum 8 required. No price data exists for this variant+market+price_type combination."
}
```

---

## Tóm tắt điều kiện fail

| history_points | Hành động |
|---|---|
| 0 | null + "insufficient_history: only 0 points..." |
| 1–7 | null + "insufficient_history: only N points..." |
| ≥ 8 | Tính regression bình thường |
