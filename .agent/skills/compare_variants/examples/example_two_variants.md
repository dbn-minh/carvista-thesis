# Example 1: So sánh 2 Variants, có market_id

**Scenario:** User muốn so sánh Toyota Camry 2.5Q vs Honda Accord 1.5T trên thị trường Việt Nam.

---

## Input

```json
{
  "variant_ids": [101, 102],
  "market_id": 1,
  "price_type": "avg_market"
}
```

---

## Quá trình xử lý (AI thực hiện nội bộ)

### Bước 1: Validation ✅
- `variant_ids` có 2 phần tử → hợp lệ
- `market_id = 1` → sẽ fetch price
- `price_type = "avg_market"` (user cung cấp)

### Bước 2: Fetch Details
```sql
-- Variant 101
SELECT v.variant_id=101, model_year=2024, trim_name="2.5 Premium", body_type="Sedan",
       engine="2.5L 4-cyl", transmission="8AT", drivetrain="FWD", fuel_type="Gasoline",
       seats=5, doors=4, msrp_base=1150000000,
       model_name="Camry", make_name="Toyota"

-- Variant 102  
SELECT v.variant_id=102, model_year=2024, trim_name="1.5T Sport", body_type="Sedan",
       engine="1.5L Turbo 4-cyl", transmission="CVT", drivetrain="FWD", fuel_type="Gasoline",
       seats=5, doors=4, msrp_base=980000000,
       model_name="Accord", make_name="Honda"
```

### Bước 3: Fetch Specs
```
Variant 101 (variant_specs): power_hp=203, torque_nm=250, displacement_cc=2487,
  length_mm=4885, width_mm=1840, height_mm=1445, wheelbase_mm=2825, curb_weight_kg=1560
  (battery_kwh=null, range_km=null)

Variant 101 (variant_spec_kv):
  fuel_consumption_l100km=7.2, acceleration_0_100=8.1,
  cargo_volume_l=493, airbags=8, safety_rating="5-star ASEAN NCAP",
  warranty_years=3, warranty_km=100000

Variant 102 (variant_specs): power_hp=192, torque_nm=260, displacement_cc=1498,
  length_mm=4973, width_mm=1862, height_mm=1449, wheelbase_mm=2830, curb_weight_kg=1490
  (battery_kwh=null, range_km=null)

Variant 102 (variant_spec_kv):
  fuel_consumption_l100km=6.8, acceleration_0_100=7.9,
  cargo_volume_l=473, airbags=6, safety_rating=null,
  warranty_years=3, warranty_km=100000
```

### Bước 4: Fetch Price (market_id=1)
```
Variant 101: latest_price = 1200000000 (captured 2026-02-28)
Variant 102: latest_price = 1020000000 (captured 2026-02-25)
```

### Bước 5: Fetch Rating
```
Variant 101: avg_rating=4.3, review_count=47
Variant 102: avg_rating=4.1, review_count=31
```

### Bước 6: Pros/Cons (median power=197, median price=1110M, median fuel=7.0)

**Variant 101 (Toyota Camry):**
- Pros:
  - Power 203 hp — cao hơn mức trung bình 197 hp của nhóm
  - Rating 4.3/5 từ 47 reviews — cao hơn Accord 4.1
  - 5-star ASEAN NCAP — an toàn vượt trội
  - Khoang hành lý 493L — rộng hơn Accord 473L
- Cons:
  - Giá 1.2 tỷ — đắt hơn Accord 180 triệu
  - Tiêu thụ 7.2 L/100km — kém hiệu quả hơn Accord 6.8 L/100km

**Variant 102 (Honda Accord):**
- Pros:
  - Giá 1.02 tỷ — rẻ hơn Camry 180 triệu
  - Tiêu thụ 6.8 L/100km — tiết kiệm hơn Camry
  - Tăng tốc 7.9s (0-100km/h) — nhanh hơn Camry 8.1s
  - Torque 260 Nm — cao hơn Camry 250 Nm
- Cons:
  - Không có dữ liệu safety_rating để đánh giá an toàn
  - Rating 4.1 từ 31 reviews — thấp hơn Camry

### Bước 7: Scoring

**Variant 101:**
- rating_score = (4.3/5.0) × 40 = 34.4
- price_score = ((1200M - 1200M) / (1200M - 1020M)) × 35 = 0
- practicality_score = 0 (seats<7) + 5 (fuel data) + 5 (cargo) + 5 (safety) = 15
- **total = 34.4 + 0 + 15 = 49.4**

**Variant 102:**
- rating_score = (4.1/5.0) × 40 = 32.8
- price_score = ((1200M - 1020M) / (1200M - 1020M)) × 35 = 35
- practicality_score = 0 + 5 + 5 + 0 = 10
- **total = 32.8 + 35 + 10 = 77.8** ✅ Winner

---

## Output JSON

```json
{
  "items": [
    {
      "variant_id": 101,
      "make": "Toyota",
      "model": "Camry",
      "year": 2024,
      "trim": "2.5 Premium",
      "body_type": "Sedan",
      "fuel_type": "Gasoline",
      "specs": {
        "power_hp": 203,
        "torque_nm": 250,
        "displacement_cc": 2487,
        "length_mm": 4885,
        "width_mm": 1840,
        "height_mm": 1445,
        "wheelbase_mm": 2825,
        "curb_weight_kg": 1560,
        "battery_kwh": null,
        "range_km": null,
        "fuel_consumption_l100km": "7.2",
        "acceleration_0_100": "8.1",
        "cargo_volume_l": "493",
        "airbags": "8",
        "safety_rating": "5-star ASEAN NCAP",
        "warranty_years": "3",
        "warranty_km": "100000"
      },
      "latest_price": 1200000000,
      "msrp_base": 1150000000,
      "avg_rating": 4.3,
      "review_count": 47,
      "pros": [
        "Power 203 hp — cao hơn mức trung bình 197 hp của nhóm",
        "Rating 4.3/5 từ 47 reviews — cao hơn Honda Accord",
        "5-star ASEAN NCAP — an toàn vượt trội trong nhóm",
        "Khoang hành lý 493L — rộng hơn Honda Accord (473L)"
      ],
      "cons": [
        "Giá 1.2 tỷ VND — đắt nhất trong nhóm, cao hơn Accord 180 triệu",
        "Tiêu thụ 7.2 L/100km — kém hiệu quả hơn Honda Accord (6.8 L/100km)"
      ]
    },
    {
      "variant_id": 102,
      "make": "Honda",
      "model": "Accord",
      "year": 2024,
      "trim": "1.5T Sport",
      "body_type": "Sedan",
      "fuel_type": "Gasoline",
      "specs": {
        "power_hp": 192,
        "torque_nm": 260,
        "displacement_cc": 1498,
        "length_mm": 4973,
        "width_mm": 1862,
        "height_mm": 1449,
        "wheelbase_mm": 2830,
        "curb_weight_kg": 1490,
        "battery_kwh": null,
        "range_km": null,
        "fuel_consumption_l100km": "6.8",
        "acceleration_0_100": "7.9",
        "cargo_volume_l": "473",
        "airbags": "6",
        "safety_rating": null,
        "warranty_years": "3",
        "warranty_km": "100000"
      },
      "latest_price": 1020000000,
      "msrp_base": 980000000,
      "avg_rating": 4.1,
      "review_count": 31,
      "pros": [
        "Giá 1.02 tỷ VND — rẻ hơn Toyota Camry 180 triệu",
        "Tiêu thụ 6.8 L/100km — tiết kiệm nhiên liệu hơn Camry",
        "Tăng tốc 7.9s (0–100 km/h) — nhanh hơn Camry (8.1s)",
        "Torque 260 Nm — cao hơn Camry 250 Nm"
      ],
      "cons": [
        "Không có dữ liệu safety_rating trong DB — không thể đánh giá an toàn",
        "Rating 4.1/5 từ 31 reviews — thấp hơn Camry (4.3/5, 47 reviews)"
      ]
    }
  ],
  "comparison_table": {
    "make_model":              { "101": "Toyota Camry",     "102": "Honda Accord" },
    "year":                    { "101": 2024,               "102": 2024 },
    "trim":                    { "101": "2.5 Premium",      "102": "1.5T Sport" },
    "body_type":               { "101": "Sedan",            "102": "Sedan" },
    "fuel_type":               { "101": "Gasoline",         "102": "Gasoline" },
    "engine":                  { "101": "2.5L 4-cyl",      "102": "1.5L Turbo" },
    "transmission":            { "101": "8AT",              "102": "CVT" },
    "drivetrain":              { "101": "FWD",              "102": "FWD" },
    "seats":                   { "101": 5,                  "102": 5 },
    "power_hp":                { "101": 203,                "102": 192 },
    "torque_nm":               { "101": 250,                "102": 260 },
    "fuel_consumption_l100km": { "101": "7.2 L/100km",     "102": "6.8 L/100km" },
    "acceleration_0_100":      { "101": "8.1s",             "102": "7.9s" },
    "length_mm":               { "101": 4885,               "102": 4973 },
    "width_mm":                { "101": 1840,               "102": 1862 },
    "wheelbase_mm":            { "101": 2825,               "102": 2830 },
    "curb_weight_kg":          { "101": 1560,               "102": 1490 },
    "cargo_volume_l":          { "101": "493L",             "102": "473L" },
    "airbags":                 { "101": "8",                "102": "6" },
    "safety_rating":           { "101": "5-star ASEAN NCAP","102": null },
    "warranty":                { "101": "3yr/100,000km",    "102": "3yr/100,000km" },
    "latest_price":            { "101": 1200000000,         "102": 1020000000 },
    "msrp_base":               { "101": 1150000000,         "102": 980000000 },
    "avg_rating":              { "101": 4.3,                "102": 4.1 },
    "review_count":            { "101": 47,                 "102": 31 }
  },
  "recommended_variant_id": 102,
  "recommendation_reason": "Honda Accord đạt điểm tổng 77.8/100: giá 1.02 tỷ — rẻ nhất trong nhóm (+35 pts), rating 4.1★ từ 31 reviews (+32.8 pts), có đủ fuel và cargo data (+10 pts). Dù Camry có safety rating nổi bật hơn, Honda Accord cân bằng tốt giữa giá và hiệu năng thực tế.",
  "scores": {
    "101": 49.4,
    "102": 77.8
  },
  "notes": "market_id=1, price_type='avg_market'. Variant 102: safety_rating not available in variant_spec_kv."
}
```
