# Ví dụ 1: Profile VND — Thị trường Việt Nam

## Input

```json
{
  "profile_id": 1,
  "base_price": 1000000000,
  "ownership_years": 3,
  "km_per_year": null
}
```

> `km_per_year` = null → dùng mặc định **15,000 km/năm**

---

## DB Data giả định (để minh họa)

### tco_profiles row:
```
profile_id=1, market_id=10, name="Vietnam Standard 2024"
```

### markets row:
```
market_id=10, country_code="VN", currency_code="VND", name="Vietnam"
```

### tco_rules rows (sau khi dedup):
| cost_type | rule_kind | rate | fixed_amount | formula_json |
|---|---|---|---|---|
| registration_tax | rate | 0.125 | NULL | NULL |
| vat | rate | 0.10 | NULL | NULL |
| insurance | rate | 0.005 | NULL | NULL |
| maintenance | formula | NULL | NULL | `{"formula":"per_km","rate":0.08}` |
| depreciation | formula | NULL | NULL | `{"formula":"straight_line","rate":0.20}` |

---

## Tính toán từng bước

### registration_tax (rate)
```
cost = 1,000,000,000 × 0.125 = 125,000,000 ₫
→ One-time, chỉ tính year_1
```

### vat (rate)
```
cost = 1,000,000,000 × 0.10 = 100,000,000 ₫
→ One-time, chỉ tính year_1
```

### insurance (rate × years)
```
annual = 1,000,000,000 × 0.005 = 5,000,000 ₫/năm
total  = 5,000,000 × 3 = 15,000,000 ₫
```

### maintenance (formula: per_km)
```
annual = 0.08 × 15,000 = 1,200,000 ₫/năm
total  = 1,200,000 × 3 = 3,600,000 ₫
```

### depreciation (formula: straight_line)
```
annual = 1,000,000,000 × 0.20 = 200,000,000 ₫/năm
total  = 200,000,000 × 3 = 600,000,000 ₫
```

### yearly_breakdown
```
annual_recurring = insurance/yr + maintenance/yr + depreciation/yr
                 = 5,000,000 + 1,200,000 + 200,000,000
                 = 206,200,000 ₫

year_1 = one_time + annual = (125,000,000 + 100,000,000) + 206,200,000
       = 431,200,000 ₫

year_2 = year_3 = 206,200,000 ₫
```

### total_cost
```
431,200,000 + 206,200,000 + 206,200,000 = 843,600,000 ₫
```

### yearly_cost_avg
```
843,600,000 / 3 = 281,200,000 ₫
```

### Rounding (VND → làm tròn đến 1,000)
Tất cả số trên đã tròn đến 1,000 → không thay đổi.

---

## Output JSON

```json
{
  "profile_id": 1,
  "profile_name": "Vietnam Standard 2024",
  "market_id": 10,
  "market_name": "Vietnam",
  "currency": "VND",
  "currency_symbol": "₫",
  "base_price": 1000000000,
  "ownership_years": 3,
  "km_per_year": 15000,
  "costs": {
    "registration_tax": 125000000,
    "excise_tax": null,
    "vat": 100000000,
    "import_duty": null,
    "insurance_total": 15000000,
    "maintenance_total": 3600000,
    "depreciation_total": 600000000,
    "other": null
  },
  "yearly_breakdown": {
    "year_1": 431200000,
    "year_2": 206200000,
    "year_3": 206200000
  },
  "total_cost": 843600000,
  "yearly_cost_avg": 281200000,
  "rules_applied": [
    { "cost_type": "registration_tax", "rule_kind": "rate", "rate": 0.125, "fixed_amount": null, "formula_json": null },
    { "cost_type": "vat", "rule_kind": "rate", "rate": 0.10, "fixed_amount": null, "formula_json": null },
    { "cost_type": "insurance", "rule_kind": "rate", "rate": 0.005, "fixed_amount": null, "formula_json": null },
    { "cost_type": "maintenance", "rule_kind": "formula", "rate": null, "fixed_amount": null, "formula_json": {"formula": "per_km", "rate": 0.08} },
    { "cost_type": "depreciation", "rule_kind": "formula", "rate": null, "fixed_amount": null, "formula_json": {"formula": "straight_line", "rate": 0.20} }
  ],
  "notes": "km_per_year not provided, defaulted to 15000. excise_tax, import_duty, other: no rule found in DB for profile_id=1."
}
```
