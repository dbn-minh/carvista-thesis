---
name: predict_price
description: |
  Dự đoán giá tương lai cho một xe (variant) trong một thị trường cụ thể
  dựa trên lịch sử giá từ database CarVista.
  Dùng linear regression trên variant_price_history, trả về predicted_price + khoảng dao động.
  Kích hoạt khi user nói "dự đoán giá", "predict price", "giá xe sắp tới",
  "forecast giá", "giá tháng sau", hoặc cung cấp variant_id + market_id + horizon.
  KHÔNG ĐƯỢC hallucinate — chỉ dùng dữ liệu từ DB. Fail gracefully khi thiếu data.
---

# Goal

Forecast giá xe deterministic từ lịch sử giá DB thực.
Cùng DB snapshot + input → luôn cho cùng output. Không tự bịa giá, không lấy data ngoài DB.
Khi không đủ data → trả null + note rõ, không đoán mò.

---

# Instructions

## Bước 1: Validate Input

| Field | Type | Bắt buộc | Mặc định |
|---|---|---|---|
| `variant_id` | BIGINT | ✅ | — |
| `market_id` | INT | ✅ | — |
| `price_type` | ENUM('msrp','avg_market','avg_listing') | ❌ | `'avg_market'` |
| `horizon_months` | int (1–24) | ❌ | `6` |

Nếu thiếu `variant_id` hoặc `market_id` → báo lỗi.
Nếu `horizon_months` ngoài [1, 24] → báo lỗi.
Nếu `price_type` không hợp lệ → dùng default `'avg_market'`, ghi notes.

## Bước 2: Load Price History

```sql
SELECT price, captured_at
FROM variant_price_history
WHERE variant_id  = :variant_id
  AND market_id   = :market_id
  AND price_type  = :price_type
ORDER BY captured_at ASC;
```

Kèm: load `currency_code` từ markets:
```sql
SELECT currency_code
FROM markets
WHERE market_id = :market_id;
```

Nếu market không tồn tại → lỗi `"market_id không tồn tại"`.

## Bước 3: Kiểm tra số lượng points

```
history_points = COUNT(rows từ query trên)
```

**Nếu `history_points < 8`:**
```json
{
  "predicted_price": null,
  "predicted_min": null,
  "predicted_max": null,
  "trend_slope": null,
  "volatility": null,
  "confidence_score": 0,
  "notes": "insufficient_history: only {N} points found, minimum 8 required."
}
```
→ **Dừng tại đây, không tính tiếp.**

## Bước 4: Tính Linear Regression (Baseline Forecast)

### 4a. Chọn window dữ liệu

```
N_window = min(history_points, 12)   // lấy 12 điểm gần nhất
points   = last N_window rows (by captured_at)
```

### 4b. Chuẩn hóa thời gian

```
x_i = số tháng từ điểm đầu tiên trong window đến điểm i
      = (captured_at_i - captured_at_0) / 30.44  // 30.44 ngày/tháng TB
y_i = price tại điểm i
```

### 4c. Linear Regression (Ordinary Least Squares)

```
n     = N_window
x̄    = mean(x)
ȳ    = mean(y)

slope = Σ[(x_i - x̄)(y_i - ȳ)] / Σ[(x_i - x̄)²]
intercept = ȳ - slope × x̄
```

### 4d. Tính Volatility (stddev of returns)

```
returns_i = (y_i - y_(i-1)) / y_(i-1)   // cho i từ 1..N_window-1
volatility = stddev(returns)              // population stddev

stddev = sqrt( Σ(r_i - mean_r)² / (n-1) )
```

Nếu `N_window = 1` → `volatility = 0`.

### 4e. Tính Predicted Point

```
x_forecast  = x_last + horizon_months
              // x_last = x của điểm cuối trong window
predicted_price = slope × x_forecast + intercept
```

Clamp: `predicted_price = max(0, predicted_price)`

### 4f. Tính Predicted Range

```
predicted_min = max(0, predicted_price × (1 - volatility))
predicted_max = predicted_price × (1 + volatility)
```

### 4g. Tính Confidence Score (0–1)

```
// Nhiều points + volatility thấp => confidence cao
point_score = min(history_points, 24) / 24     // max at 24 points
vol_score   = max(0, 1 - volatility * 5)       // 0 nếu vol >= 20%

confidence_score = (point_score × 0.6) + (vol_score × 0.4)
confidence_score = clamp(confidence_score, 0, 1)
// làm tròn 2 decimals
```

## Bước 5: Rounding theo currency_code

| currency_code | Làm tròn |
|---|---|
| VND | Đến 1,000 |
| USD / EUR / GBP | 2 decimals |
| JPY | 0 decimals |
| Khác | 2 decimals |

Áp dụng cho: `last_price`, `predicted_price`, `predicted_min`, `predicted_max`.
**Không convert tỷ giá.**

## Bước 6: Trả Output JSON

```json
{
  "variant_id": <bigint>,
  "market_id": <int>,
  "currency": <currency_code>,
  "price_type": <string>,
  "history_points": <int>,
  "last_price": <number|null>,
  "horizon_months": <int>,
  "predicted_price": <number|null>,
  "predicted_min": <number|null>,
  "predicted_max": <number|null>,
  "trend_slope": <number|null>,
  "volatility": <number|null>,
  "confidence_score": <0..1>,
  "notes": <string>
}
```

`trend_slope` = slope tính được (đơn vị: currency/tháng), làm tròn 2 decimals.
`volatility` = stddev of returns, làm tròn 4 decimals.

---

# Examples

📚 Xem chi tiết:
- `examples/example_sufficient.md` — 2 ví dụ đủ data (VND + USD + 6M/12M horizon)
- `examples/example_insufficient.md` — Ví dụ thiếu data (<8 points, fail gracefully)

## Quick Reference — Case đủ data (avg_market, 6 tháng)

**Input:**
```json
{ "variant_id": 101, "market_id": 1, "price_type": "avg_market", "horizon_months": 6 }
```
→ Lấy lịch sử, compute regression, trả predicted_price + range + confidence.

## Quick Reference — Case thiếu data

**Input:**
```json
{ "variant_id": 999, "market_id": 2, "price_type": "avg_market", "horizon_months": 6 }
```
→ `history_points = 3` → `predicted_price = null`, `notes = "insufficient_history: only 3 points found, minimum 8 required."`

---

# Constraints

## Dữ liệu — TUYỆT ĐỐI KHÔNG vi phạm

- ❌ KHÔNG ĐƯỢC tự bịa giá hay rate nếu DB thiếu data
- ❌ KHÔNG ĐƯỢC lấy giá từ nguồn ngoài DB (internet, LLM knowledge...)
- ❌ KHÔNG ĐƯỢC convert tỷ giá giữa currencies
- ✅ `history_points < 8` → trả null fields + `"insufficient_history"` note ngay, không tính
- ✅ Output phải deterministic: cùng DB snapshot + input → cùng output

## Logic — Giữ đúng thuật toán

- ❌ KHÔNG ĐƯỢC dùng window > 12 points cho regression (dù có nhiều hơn)
- ❌ KHÔNG ĐƯỢC để predicted_price, predicted_min âm (clamp >= 0)
- ✅ Phải dùng population stddev (chia n-1) cho volatility
- ✅ x_i tính bằng tháng dùng 30.44 ngày/tháng (không dùng số nguyên tháng)
- ✅ `confidence_score` phải nằm trong [0, 1]

## Output — Format cố định

- ❌ KHÔNG ĐƯỢC bỏ key nào trong output JSON (dùng `null` nếu không có)
- ❌ KHÔNG ĐƯỢC đổi tên key
- ✅ `notes` phải mô tả mọi bất thường: insufficient data, price_type fallback, clamp events

<!-- Generated by Skill Generator v3.2 -->
