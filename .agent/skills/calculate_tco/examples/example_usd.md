# Ví dụ 2: Profile USD — Thị trường Quốc tế

## Input

```json
{
  "profile_id": 2,
  "base_price": 35000,
  "ownership_years": 5,
  "km_per_year": 20000
}
```

---

## DB Data giả định (để minh họa)

### tco_profiles row:
```
profile_id=2, market_id=1, name="US Standard 2024"
```

### markets row:
```
market_id=1, country_code="US", currency_code="USD", name="United States"
```

### tco_rules rows (sau khi dedup by cost_type, lấy mới nhất):
| cost_type | rule_kind | rate | fixed_amount | formula_json |
|---|---|---|---|---|
| registration_tax | fixed | NULL | 500.00 | NULL |
| vat | rate | 0.08 | NULL | NULL |
| import_duty | rate | 0.025 | NULL | NULL |
| insurance | rate | 0.015 | NULL | NULL |
| maintenance | formula | NULL | NULL | `{"formula":"per_km","rate":0.05}` |
| depreciation | formula | NULL | NULL | `{"formula":"declining_balance","rate":0.15}` |

---

## Tính toán từng bước

### registration_tax (fixed)
```
cost = $500.00 (one-time, year_1 only)
```

### vat (rate)
```
cost = 35,000 × 0.08 = $2,800.00 (one-time, year_1)
```

### import_duty (rate)
```
cost = 35,000 × 0.025 = $875.00 (one-time, year_1)
```

### insurance (rate × years)
```
annual = 35,000 × 0.015 = $525.00/năm
total  = 525 × 5 = $2,625.00
```

### maintenance (formula: per_km)
```
annual = 0.05 × 20,000 = $1,000.00/năm
total  = 1,000 × 5 = $5,000.00
```

### depreciation (formula: declining_balance, rate=0.15)
```
book_value at start of year N = base_price × (1 - rate)^(N-1)

year_1 loss = 35,000 × 0.15                         = $5,250.00
year_2 loss = 35,000 × 0.85 × 0.15                  = $4,462.50
year_3 loss = 35,000 × 0.85² × 0.15                 = $3,793.13
year_4 loss = 35,000 × 0.85³ × 0.15                 = $3,224.16
year_5 loss = 35,000 × 0.85⁴ × 0.15                 = $2,740.53

depreciation_total = 5250 + 4462.50 + 3793.13 + 3224.16 + 2740.53
                   = $19,470.32
```

### yearly_breakdown
```
one_time (year_1 only) = 500 + 2,800 + 875 = $4,175.00

annual_recurring_per_year:
  year_1: insurance=$525 + maintenance=$1,000 + dep=$5,250   = $6,775.00
  year_2: $525 + $1,000 + $4,462.50                          = $5,987.50
  year_3: $525 + $1,000 + $3,793.13                          = $5,318.13
  year_4: $525 + $1,000 + $3,224.16                          = $4,749.16
  year_5: $525 + $1,000 + $2,740.53                          = $4,265.53

year_1 = one_time + annual_1 = $4,175 + $6,775 = $10,950.00
year_2 = $5,987.50
year_3 = $5,318.13
year_4 = $4,749.16
year_5 = $4,265.53
```

### total_cost
```
$10,950.00 + $5,987.50 + $5,318.13 + $4,749.16 + $4,265.53 = $31,270.32
```

### yearly_cost_avg
```
$31,270.32 / 5 = $6,254.06
```

### Rounding (USD → 2 decimals)
Các số trên đã có 2 decimals → giữ nguyên.

---

## Output JSON

```json
{
  "profile_id": 2,
  "profile_name": "US Standard 2024",
  "market_id": 1,
  "market_name": "United States",
  "currency": "USD",
  "currency_symbol": "$",
  "base_price": 35000.00,
  "ownership_years": 5,
  "km_per_year": 20000,
  "costs": {
    "registration_tax": 500.00,
    "excise_tax": null,
    "vat": 2800.00,
    "import_duty": 875.00,
    "insurance_total": 2625.00,
    "maintenance_total": 5000.00,
    "depreciation_total": 19470.32,
    "other": null
  },
  "yearly_breakdown": {
    "year_1": 10950.00,
    "year_2": 5987.50,
    "year_3": 5318.13,
    "year_4": 4749.16,
    "year_5": 4265.53
  },
  "total_cost": 31270.32,
  "yearly_cost_avg": 6254.06,
  "rules_applied": [
    { "cost_type": "registration_tax", "rule_kind": "fixed", "rate": null, "fixed_amount": 500.00, "formula_json": null },
    { "cost_type": "vat", "rule_kind": "rate", "rate": 0.08, "fixed_amount": null, "formula_json": null },
    { "cost_type": "import_duty", "rule_kind": "rate", "rate": 0.025, "fixed_amount": null, "formula_json": null },
    { "cost_type": "insurance", "rule_kind": "rate", "rate": 0.015, "fixed_amount": null, "formula_json": null },
    { "cost_type": "maintenance", "rule_kind": "formula", "rate": null, "fixed_amount": null, "formula_json": {"formula": "per_km", "rate": 0.05} },
    { "cost_type": "depreciation", "rule_kind": "formula", "rate": null, "fixed_amount": null, "formula_json": {"formula": "declining_balance", "rate": 0.15} }
  ],
  "notes": "excise_tax, other: no rule found in DB for profile_id=2. Declining balance depreciation applied per year."
}
```

---

## Trường hợp edge case cần handle

### Nếu rate > 1 được lưu vào DB (ví dụ: rate = 8 thay vì 0.08)

```
Phát hiện: rate = 8 > 1
→ Treated as percent: rate = 8 / 100 = 0.08
→ notes: "vat rate 8 > 1 detected, treated as 0.08"
→ Kết quả không đổi: 35,000 × 0.08 = $2,800.00
```
