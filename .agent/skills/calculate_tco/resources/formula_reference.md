# Formula Reference — TCO Calculation Engine

Tài liệu này mô tả chi tiết cách tính mỗi loại `rule_kind` trong bảng `tco_rules`.

---

## 1. `rule_kind = 'rate'`

**Công thức cơ bản:**
```
cost = base_price × rate
```

**Tolerant Parse (rate > 1):**
```
IF rate > 1 THEN
  effective_rate = rate / 100
  APPEND notes: "rate {rate} > 1 detected, treated as {effective_rate}"
ELSE
  effective_rate = rate
END

cost = base_price × effective_rate
```

**Áp dụng cho cost_type:**
- `registration_tax` → one-time (year_1 only)
- `vat` → one-time (year_1 only)
- `import_duty` → one-time (year_1 only)
- `excise_tax` → one-time (year_1 only)
- `insurance` → annual × ownership_years

---

## 2. `rule_kind = 'fixed'`

**Công thức:**
```
cost = fixed_amount
```

**Áp dụng cho cost_type:**
- `registration_tax` → one-time
- `insurance` (nếu fixed) → nhân × ownership_years (phí hàng năm)
- Các loại khác → theo ngữ cảnh (one-time nếu là thuế/phí đăng ký)

---

## 3. `rule_kind = 'formula'`

Đọc `formula_json` và thực thi theo `formula` field.

### 3a. `"formula": "per_km"` — Bảo dưỡng theo km

```json
{"formula": "per_km", "rate": 0.08}
```

```
cost_per_km  = rate
annual_cost  = rate × km_per_year
total_cost   = annual_cost × ownership_years
```

**Output:**
- `maintenance_total` = total_cost
- Yearly: mỗi năm đều = annual_cost

---

### 3b. `"formula": "straight_line"` — Khấu hao tuyến tính

```json
{"formula": "straight_line", "rate": 0.20}
```

```
depreciation_per_year = base_price × rate
depreciation_total    = depreciation_per_year × ownership_years
```

**Output:**
- `depreciation_total` = depreciation_total
- Yearly: mỗi năm đều = depreciation_per_year

---

### 3c. `"formula": "declining_balance"` — Khấu hao số dư giảm dần

```json
{"formula": "declining_balance", "rate": 0.15}
```

```
FOR n = 1 TO ownership_years:
  book_value_start = base_price × (1 - rate)^(n-1)
  loss_n           = book_value_start × rate
  depreciation_year_n = loss_n

depreciation_total = Σ loss_n (n from 1 to ownership_years)
```

**Công thức tắt:**
```
depreciation_total = base_price × (1 - (1-rate)^ownership_years)
```

**Output:**
- `depreciation_total`
- Yearly: mỗi năm khác nhau (giảm dần)

---

## 4. Error Handling

| Tình huống | Xử lý |
|---|---|
| `formula_json` null | cost_type = null, ghi notes |
| `formula_json` thiếu field `formula` | cost_type = null, ghi notes |
| `formula_json` thiếu field `rate` | cost_type = null, ghi notes |
| `rate` null với `rule_kind='rate'` | cost_type = null, ghi notes |
| `fixed_amount` null với `rule_kind='fixed'` | cost_type = null, ghi notes |
| formula không nhận biết được | cost_type = null, ghi notes |

---

## 5. Thứ tự ưu tiên khi có nhiều rule cùng cost_type

```sql
-- Chỉ lấy dòng có created_at mới nhất
ORDER BY cost_type, created_at DESC
-- → Row đầu tiên sau group by cost_type
```

Điều này đảm bảo rule mới nhất override rule cũ.
