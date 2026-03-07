# Regression Engine — predict_price

Chi tiết toán học của thuật toán dự báo.

---

## 1. Chọn Window Dữ liệu

```
N_window = min(history_points, 12)
points   = cuối N_window rows từ ORDER BY captured_at ASC
```

Giới hạn 12 điểm để giữ model "nhạy" với xu hướng gần đây nhất,
tránh ảnh hưởng bởi dữ liệu cũ quá xa.

---

## 2. Chuẩn hóa Trục Thời gian

```
captured_at_0 = captured_at của điểm đầu tiên trong window

x_i = (captured_at_i - captured_at_0_in_seconds) / (30.44 × 86400)
    = số tháng kể từ điểm đầu
```

> Dùng **30.44 ngày/tháng** (365.25 / 12) để xử lý tháng có độ dài khác nhau.

---

## 3. Ordinary Least Squares (OLS)

```
n     = N_window
x̄    = Σx_i / n
ȳ    = Σy_i / n

slope (β₁) = Σ[(x_i - x̄)(y_i - ȳ)]
             ─────────────────────────
               Σ[(x_i - x̄)²]

intercept (β₀) = ȳ - β₁ × x̄
```

Đơn vị `slope`: **currency/tháng**
- Âm = giá đang giảm
- Dương = giá đang tăng

---

## 4. Volatility — Stddev of Returns

```
returns_i = (y_i - y_(i-1)) / y_(i-1)   // i = 1 .. N_window-1
           = (price_t - price_(t-1)) / price_(t-1)

mean_r   = Σ returns_i / (N_window-1)

variance = Σ(returns_i - mean_r)² / (N_window - 2)   // sample variance (n-1)
volatility = sqrt(variance)
```

> **Edge cases:**
> - N_window = 1 → returns rỗng → `volatility = 0`
> - N_window = 2 → 1 return → `volatility = abs(returns_0 - mean_r)` = 0 (1 data point stddev = 0)

---

## 5. Predicted Price

```
x_last     = x của điểm cuối cùng trong window (tháng từ điểm đầu)
x_forecast = x_last + horizon_months

predicted_price = β₁ × x_forecast + β₀

// Clamp âm:
predicted_price = max(0, predicted_price)
```

Nếu clamp xảy ra → ghi notes: `"predicted_price clamped to 0 (regression extrapolation exceeded bounds)"`

---

## 6. Predicted Range

```
predicted_min = max(0, predicted_price × (1 - volatility))
predicted_max = predicted_price × (1 + volatility)
```

> Range thể hiện biên dao động **1 stddev of returns** xung quanh predicted_price.
> Khoảng này KHÔNG phải confidence interval thống kê chuẩn — nó là "practical range" dựa trên volatility lịch sử.

---

## 7. Confidence Score

```
// Component 1: point_score (0..1) — bao nhiêu data
point_score = min(history_points, 24) / 24

// Component 2: vol_score (0..1) — thị trường ổn định?
vol_score = max(0, 1 - volatility × 5)
// vol = 0%   → vol_score = 1.0  (rất ổn)
// vol = 10%  → vol_score = 0.5
// vol = 20%+ → vol_score = 0.0  (rất biến động)

confidence_score = clamp(0.6 × point_score + 0.4 × vol_score, 0, 1)
// làm tròn 2 decimals
```

### Thang giải thích:
| Score | Ý nghĩa |
|---|---|
| 0.8–1.0 | Rất tin cậy — nhiều điểm, ít biến động |
| 0.6–0.8 | Tin cậy tốt |
| 0.4–0.6 | Trung bình — xem kèm predicted range |
| 0.2–0.4 | Thấp — biến động lớn hoặc ít lịch sử |
| 0.0–0.2 | Rất thấp — kết quả mang tính tham khảo |

---

## 8. Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Xử lý |
|---|---|---|
| `slope = NaN` | Tất cả x_i giống nhau (cùng ngày) | Báo lỗi, không predict |
| `predicted_price < 0` | Trend giảm quá mạnh + horizon dài | Clamp về 0 + ghi notes |
| `volatility = Infinity` | Có price = 0 trong history | Ghi notes, set volatility = null |
