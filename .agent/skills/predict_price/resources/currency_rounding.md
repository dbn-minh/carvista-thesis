# Currency Rounding Rules — predict_price

Áp dụng cho: `last_price`, `predicted_price`, `predicted_min`, `predicted_max`.
`trend_slope` và `volatility` có quy tắc riêng.

---

## Quy tắc làm tròn giá

| currency_code | Làm tròn | Ví dụ input | Ví dụ output |
|---|---|---|---|
| `VND` | Đến 1,000 | 836,372,727 | 836,373,000 |
| `USD` | 2 decimals | 34,238.4913 | 34,238.49 |
| `EUR` | 2 decimals | 28,450.1267 | 28,450.13 |
| `GBP` | 2 decimals | 25,100.5599 | 25,100.56 |
| `JPY` | 0 decimals | 3,812,450.7 | 3,812,451 |
| Khác | 2 decimals | — | — |

---

## Quy tắc cho các field khác

| Field | Làm tròn |
|---|---|
| `trend_slope` | 2 decimals (đơn vị: currency/tháng) |
| `volatility` | 4 decimals |
| `confidence_score` | 2 decimals |

---

## Currency Symbol Mapping

| currency_code | Symbol |
|---|---|
| VND | ₫ |
| USD | $ |
| EUR | € |
| GBP | £ |
| JPY | ¥ |
| SGD | S$ |
| THB | ฿ |
| KRW | ₩ |
| Khác | currency_code string |

---

## Quy tắc áp dụng

1. **Làm tròn sau bước cuối cùng** — không làm tròn trung gian (tránh lỗi tích lũy)
2. **KHÔNG convert tỷ giá** — output giữ nguyên currency của market
3. **Clamp trước khi round** — max(0, value) rồi mới round

**VND:**
```
round(value / 1000) × 1000
836,372,727 → round(836372.727) × 1000 = 836,373 × 1000 = 836,373,000
```

**USD/EUR/GBP:**
```
round(value × 100) / 100
34238.4913 → round(3423849.13) / 100 = 3423849 / 100 = 34238.49
```

**JPY:**
```
round(value)
3812450.7 → 3812451
```
