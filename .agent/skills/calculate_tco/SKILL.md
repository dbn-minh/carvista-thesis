---
name: calculate_tco
description: |
  Tính Total Cost of Ownership (TCO) cho xe ô tô dựa trên profile_id từ database CarVista.
  Đọc tco_profiles + tco_rules từ MySQL, áp dụng công thức deterministic, trả về JSON chuẩn.
  Kích hoạt khi user nói "tính TCO", "tính tổng chi phí sở hữu", "calculate TCO",
  "chi phí sở hữu xe", "TCO profile", hoặc cung cấp profile_id + base_price + ownership_years.
  KHÔNG ĐƯỢC hallucinate dữ liệu — chỉ dùng rule từ DB.
---

# Goal

Tính Total Cost of Ownership (TCO) hoàn toàn deterministic từ dữ liệu DB thực.
Với cùng input → luôn cho cùng output. Không tự thêm rule, không đoán tỷ giá.

---

# Instructions

## Bước 1: Validate Input

Nhận input JSON với các field:

| Field | Type | Bắt buộc | Mặc định |
|---|---|---|---|
| `profile_id` | INT | ✅ | — |
| `base_price` | number | ✅ | — |
| `ownership_years` | int (1–10) | ✅ | — |
| `km_per_year` | int | ❌ | **15000** |

Nếu thiếu `profile_id`, `base_price`, hoặc `ownership_years` → báo lỗi ngay.
Nếu `ownership_years` ngoài [1, 10] → báo lỗi.
Nếu `km_per_year` null/không có → dùng 15000.

## Bước 2: Load Profile + Market

Chạy SQL sau (thay `:profile_id` bằng giá trị thực):

```sql
SELECT
  p.profile_id,
  p.market_id,
  p.name         AS profile_name,
  m.name         AS market_name,
  m.currency_code
FROM tco_profiles p
JOIN markets m ON m.market_id = p.market_id
WHERE p.profile_id = :profile_id;
```

Nếu không tìm thấy profile → trả lỗi: `"profile_id không tồn tại trong DB"`.

## Bước 3: Load Rules

```sql
SELECT
  cost_type,
  rule_kind,
  rate,
  fixed_amount,
  formula_json,
  applies_to,
  created_at
FROM tco_rules
WHERE profile_id = :profile_id
ORDER BY cost_type, created_at DESC;
```

**Xử lý trùng lặp:** Nếu nhiều dòng cùng `cost_type` → **chỉ lấy dòng đầu tiên** (created_at mới nhất) cho mỗi cost_type.

## Bước 4: Tính Cost theo Rule — Engine Deterministic

### 4a. `rule_kind = 'rate'`

```
cost = base_price × rate
```

**Tolerant parse:** Nếu `rate > 1` (ví dụ 10, 20) → coi là phần trăm → tự động chia 100.
Ghi vào `notes`: `"rate {X} > 1 detected, treated as {X/100}"`.

### 4b. `rule_kind = 'fixed'`

```
cost = fixed_amount  (không nhân gì thêm)
```

### 4c. `rule_kind = 'formula'` — Đọc `formula_json`

| formula | Cách tính | Annual | Total |
|---|---|---|---|
| `"per_km"` | Bảo dưỡng theo km | `rate × km_per_year` | `annual × ownership_years` |
| `"straight_line"` | Khấu hao tuyến tính | `base_price × rate` | `annual × ownership_years` |
| `"declining_balance"` | Khấu hao số dư giảm dần | year_n = `base_price × (1 - rate)^n - base_price × (1 - rate)^(n-1)` | `Σ(n=1..years) loss_n` |

**Nếu thiếu field trong `formula_json`** → set cost_type đó = `null`, thêm note.

### 4d. Mapping cost_type → output field

| cost_type DB | Output field |
|---|---|
| `registration_tax` | `costs.registration_tax` |
| `excise_tax` | `costs.excise_tax` |
| `vat` | `costs.vat` |
| `import_duty` | `costs.import_duty` |
| `insurance` | `costs.insurance_total` (× years) |
| `maintenance` | `costs.maintenance_total` (là total) |
| `depreciation` | `costs.depreciation_total` (là total) |
| `other` | `costs.other` |

**Lưu ý:** `insurance` với `rule_kind='rate'` áp dụng mỗi năm → nhân `ownership_years`.
Nếu `insurance` là `fixed` → cũng nhân `ownership_years` (phí hàng năm).

## Bước 5: Rounding theo currency_code

| currency_code | Làm tròn |
|---|---|
| VND | Làm tròn đến 1,000 (ví dụ 125,567,000 → 125,567,000) |
| USD / EUR / GBP | 2 chữ số thập phân |
| JPY | 0 chữ số thập phân (làm tròn nguyên) |
| Khác | 2 chữ số thập phân |

**KHÔNG convert tỷ giá giữa các đơn vị.**

## Bước 6: Tính Yearly Breakdown

```
year_N_cost = one_time_costs (chỉ tính ở year_1) + annual_recurring_costs
```

- **One-time (chỉ year_1):** `registration_tax`, `excise_tax`, `vat`, `import_duty`
- **Annual recurring:** `insurance` (mỗi năm), `maintenance`/năm, `depreciation`/năm

```
yearly_breakdown = {
  "year_1": one_time + annual,
  "year_2": annual,
  ...
  "year_N": annual
}
```

## Bước 7: Tính Tổng và Output

```
total_cost = Σ(year_1..year_N) từ yearly_breakdown
yearly_cost_avg = total_cost / ownership_years
```

### Mapping currency_symbol (deterministic):

| currency_code | symbol |
|---|---|
| VND | ₫ |
| USD | $ |
| EUR | € |
| GBP | £ |
| JPY | ¥ |
| Khác | currency_code string |

## Bước 8: Trả Output JSON chuẩn

```json
{
  "profile_id": <int>,
  "profile_name": <string>,
  "market_id": <int>,
  "market_name": <string>,
  "currency": <currency_code>,
  "currency_symbol": <symbol>,
  "base_price": <rounded>,
  "ownership_years": <int>,
  "km_per_year": <int>,
  "costs": {
    "registration_tax": <number|null>,
    "excise_tax": <number|null>,
    "vat": <number|null>,
    "import_duty": <number|null>,
    "insurance_total": <number|null>,
    "maintenance_total": <number|null>,
    "depreciation_total": <number|null>,
    "other": <number|null>
  },
  "yearly_breakdown": {
    "year_1": <number>,
    "year_2": <number>,
    ...
  },
  "total_cost": <number>,
  "yearly_cost_avg": <number>,
  "rules_applied": [
    {
      "cost_type": <string>,
      "rule_kind": <string>,
      "rate": <number|null>,
      "fixed_amount": <number|null>,
      "formula_json": <object|null>
    }
  ],
  "notes": <string>
}
```

---

# Examples

📚 Xem chi tiết: `examples/example_vnd.md`, `examples/example_usd.md`

## Quick Reference — VND (profile_id=1)

**Input:**
```json
{
  "profile_id": 1,
  "base_price": 1000000000,
  "ownership_years": 3,
  "km_per_year": null
}
```

**Sketch output** (km_per_year default = 15000):  
→ Tất cả cost theo VND, làm tròn đến 1,000.

## Quick Reference — USD (profile_id=2)

**Input:**
```json
{
  "profile_id": 2,
  "base_price": 35000,
  "ownership_years": 5,
  "km_per_year": 20000
}
```

→ Tất cả cost theo USD, làm tròn 2 decimals.

---

# Constraints

## Dữ liệu — TUYỆT ĐỐI KHÔNG được vi phạm

- ❌ KHÔNG ĐƯỢC tự bịa rate/tax/rule nếu DB không có dòng tương ứng
- ❌ KHÔNG ĐƯỢC tự suy đoán tỷ giá hoặc convert currency
- ❌ KHÔNG ĐƯỢC áp dụng rule cho `applies_to` không match loại xe (nếu có thông tin vehicle_type)
- ✅ Nếu thiếu rule cho cost_type → output cost_type đó = `null` + ghi rõ trong `notes`
- ✅ Output phải deterministic: cùng input DB snapshot → cùng output

## Logic — Không được sai

- ❌ KHÔNG ĐƯỢC lấy nhiều hơn 1 dòng cho cùng cost_type (lấy mới nhất)
- ❌ KHÔNG ĐƯỢC nhầm `rate` và `fixed_amount`
- ❌ KHÔNG ĐƯỢC quên nhân insurance × years
- ✅ Phải áp dụng tolerant parse cho rate > 1 và ghi notes
- ✅ Phải validate input trước khi chạy SQL

## Output — Format cố định

- ❌ KHÔNG ĐƯỢC bỏ key nào trong output JSON (dùng `null` nếu không có giá trị)
- ❌ KHÔNG ĐƯỢC thay đổi tên key output
- ✅ `rules_applied` phải liệt kê ĐÚNG các rule đã được dùng (không phải tất cả rule)
- ✅ `notes` phải ghi rõ mọi trường hợp bất thường

<!-- Generated by Skill Generator v3.2 -->
