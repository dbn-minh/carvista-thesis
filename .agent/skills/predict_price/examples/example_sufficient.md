# Ví dụ 1 & 2: Đủ data — Regression thành công

---

## Example 1: variant_id=101, market_id=1 (USD), horizon=6 tháng

### Input
```json
{
  "variant_id": 101,
  "market_id": 1,
  "price_type": "avg_market",
  "horizon_months": 6
}
```

### DB Data: markets
```
market_id=1, currency_code="USD", name="United States"
```

### DB Data: variant_price_history (14 rows, lấy 12 gần nhất)
| # | captured_at | price |
|---|---|---|
| 1 | 2025-01-15 | 36200.00 |
| 2 | 2025-02-15 | 36050.00 |
| 3 | 2025-03-15 | 35900.00 |
| 4 | 2025-04-15 | 35750.00 |
| 5 | 2025-05-15 | 35600.00 |
| 6 | 2025-06-15 | 35450.00 |
| 7 | 2025-07-15 | 35300.00 |
| 8 | 2025-08-15 | 35100.00 |
| 9 | 2025-09-15 | 34900.00 |
| 10 | 2025-10-15 | 34700.00 |
| 11 | 2025-11-15 | 34600.00 |
| 12 | 2025-12-15 | 34500.00 |

> history_points = 14, nhưng chỉ lấy 12 gần nhất → window = 12

---

### Tính từng bước

#### x_i (tháng từ điểm đầu)
```
x_0 = 0, x_1 = 1.0, ..., x_11 = 11.0  (monthly data → ~30.44 ngày/bucket)
```

#### Linear Regression OLS
```
n = 12
x̄ = 5.5,  ȳ = 35,254.17

Σ(x_i - x̄)(y_i - ȳ) = -12,630
Σ(x_i - x̄)²         = 143

slope     = -12,630 / 143 = -88.32 USD/tháng
intercept = 35,254.17 - (-88.32 × 5.5) = 35,739.93
```

#### Volatility (stddev of returns)
```
returns = [(36050-36200)/36200, (35900-36050)/36050, ...]
        = [-0.00414, -0.00416, -0.00417, ...]  (11 returns)

mean_r    ≈ -0.00455
stddev_r  ≈ 0.0035  (volatility)
```

#### Predicted Price (horizon = 6)
```
x_last     = 11.0
x_forecast = 11.0 + 6 = 17.0

predicted_price = -88.32 × 17 + 35,739.93
                = -1,501.44 + 35,739.93
                = 34,238.49

predicted_price ≥ 0 → no clamp needed
```

#### Predicted Range
```
predicted_min = max(0, 34,238.49 × (1 - 0.0035)) = 34,118.60
predicted_max = 34,238.49 × (1 + 0.0035)          = 34,358.38
```

#### Confidence Score
```
point_score = min(14, 24) / 24 = 14/24 = 0.583
vol_score   = max(0, 1 - 0.0035 × 5) = 1 - 0.0175 = 0.9825

confidence_score = 0.6 × 0.583 + 0.4 × 0.9825
                 = 0.350 + 0.393 = 0.743
```

#### Rounding (USD → 2 decimals)
Tất cả đã ở dạng 2 decimals.

---

### Output JSON
```json
{
  "variant_id": 101,
  "market_id": 1,
  "currency": "USD",
  "price_type": "avg_market",
  "history_points": 14,
  "last_price": 34500.00,
  "horizon_months": 6,
  "predicted_price": 34238.49,
  "predicted_min": 34118.60,
  "predicted_max": 34358.38,
  "trend_slope": -88.32,
  "volatility": 0.0035,
  "confidence_score": 0.74,
  "notes": "Window limited to last 12 of 14 available points."
}
```

---

## Example 2: variant_id=202, market_id=2 (VND), horizon=12 tháng

### Input
```json
{
  "variant_id": 202,
  "market_id": 2,
  "price_type": "avg_listing",
  "horizon_months": 12
}
```

### DB Data: markets
```
market_id=2, currency_code="VND", name="Vietnam"
```

### DB Data: variant_price_history (10 rows, tất cả dùng vì <12)
| # | captured_at | price |
|---|---|---|
| 1 | 2024-09-01 | 900,000,000 |
| 2 | 2024-10-01 | 895,000,000 |
| 3 | 2024-11-01 | 892,000,000 |
| 4 | 2024-12-01 | 888,000,000 |
| 5 | 2025-01-01 | 885,000,000 |
| 6 | 2025-02-01 | 882,000,000 |
| 7 | 2025-03-01 | 880,000,000 |
| 8 | 2025-04-01 | 878,000,000 |
| 9 | 2025-05-01 | 876,000,000 |
| 10 | 2025-06-01 | 874,000,000 |

> history_points = 10, window = 10

---

### Tính nhanh
```
x: 0..9 (tháng), y: giá
x̄ = 4.5,  ȳ = 885,000,000

slope     ≈ -2,909,090.91 ₫/tháng  (giá giảm dần)
intercept ≈ 898,090,909.09

x_forecast = 9 + 12 = 21
predicted_price = -2,909,090.91 × 21 + 898,090,909.09
               = 836,372,727.27 → round VND → 836,373,000 ₫

returns (9 values): [-0.00556, -0.00335, -0.00449, ...]
volatility ≈ 0.0008

predicted_min = max(0, 836,373,000 × (1 - 0.0008)) = 835,704,024 → 835,704,000 ₫
predicted_max = 836,373,000 × (1 + 0.0008)         = 837,041,976 → 837,042,000 ₫

point_score = 10/24 = 0.417
vol_score   = 1 - 0.0008×5 = 0.996
confidence_score = 0.6×0.417 + 0.4×0.996 = 0.250 + 0.398 = 0.648
```

### Output JSON
```json
{
  "variant_id": 202,
  "market_id": 2,
  "currency": "VND",
  "price_type": "avg_listing",
  "history_points": 10,
  "last_price": 874000000,
  "horizon_months": 12,
  "predicted_price": 836373000,
  "predicted_min": 835704000,
  "predicted_max": 837042000,
  "trend_slope": -2909090.91,
  "volatility": 0.0008,
  "confidence_score": 0.65,
  "notes": ""
}
```
