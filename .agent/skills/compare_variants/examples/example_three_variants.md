# Example 2: So sánh 3 Variants, KHÔNG có market_id

**Scenario:** User so sánh 3 SUV mà không chỉ định thị trường — chỉ dùng msrp_base để xếp hạng giá.

---

## Input

```json
{
  "variant_ids": [201, 202, 203],
  "market_id": null
}
```

---

## Điểm khác biệt với Example 1

| Điểm | Example 1 | Example 2 |
|---|---|---|
| `market_id` | 1 | null |
| `price_type` | avg_market | (không áp dụng) |
| `latest_price` | Có giá trị | **null** cho mọi variant |
| Fallback price | — | `msrp_base` dùng cho ranking |

---

## Quá trình xử lý (tóm tắt)

### Validation ✅
- 3 phần tử trong `variant_ids` → hợp lệ
- `market_id = null` → **BỎ QUA** query `variant_price_history`

### Fetch Details (giả định kết quả)
```
Variant 201: Toyota RAV4 2024 "2.5 Hybrid Premium", Hybrid, FWD, 5 seats, msrp=1380000000
Variant 202: Mazda CX-5 2024 "2.0 Premium",        Gasoline, FWD, 5 seats, msrp=1050000000
Variant 203: Hyundai Tucson 2024 "1.6T AWD",        Gasoline, AWD, 5 seats, msrp=1100000000
```

### Fetch Specs (tóm tắt)
```
Variant 201: power_hp=218, torque_nm=221, fuel_consumption_l100km=6.1,
             range_km=null (hybrid, không phải EV), cargo_volume_l=580,
             safety_rating="5-star Euro NCAP", airbags=7
Variant 202: power_hp=165, torque_nm=213, fuel_consumption_l100km=7.0,
             cargo_volume_l=442, safety_rating="5-star ASEAN NCAP", airbags=6
Variant 203: power_hp=180, torque_nm=265, fuel_consumption_l100km=8.5,
             cargo_volume_l=539, safety_rating=null, airbags=4
```

### Price (market_id=null)
```
latest_price = null ← cho MỌI variant
Fallback cho scoring: dùng msrp_base
```

### Rating
```
Variant 201: avg_rating=4.5, review_count=82
Variant 202: avg_rating=4.2, review_count=56   
Variant 203: avg_rating=3.8, review_count=24
```

### Scoring (price dùng msrp_base: median=1100M, min=1050M, max=1380M)

**Variant 201 (RAV4 Hybrid):**
- rating_score = (4.5/5.0)×40 = 36
- price_score = ((1380-1380)/(1380-1050))×35 = 0
- practicality_score = 0+5+5+5 = 15
- **total = 51.0**

**Variant 202 (CX-5):**
- rating_score = (4.2/5.0)×40 = 33.6
- price_score = ((1380-1050)/(1380-1050))×35 = 35
- practicality_score = 0+5+5+5 = 15
- **total = 83.6** ✅ Winner

**Variant 203 (Tucson AWD):**
- rating_score = (3.8/5.0)×40 = 30.4
- price_score = ((1380-1100)/(1380-1050))×35 = 29.7
- practicality_score = 0+5+5+0 = 10
- **total = 70.1**

---

## Output JSON (rút gọn — các fields quan trọng)

```json
{
  "items": [
    {
      "variant_id": 201,
      "make": "Toyota", "model": "RAV4", "year": 2024, "trim": "2.5 Hybrid Premium",
      "fuel_type": "Hybrid",
      "specs": { "power_hp": 218, "fuel_consumption_l100km": "6.1", "cargo_volume_l": "580" },
      "latest_price": null,
      "msrp_base": 1380000000,
      "avg_rating": 4.5, "review_count": 82,
      "pros": [
        "Power 218 hp — cao nhất trong nhóm (median 188 hp)",
        "Rating 4.5/5 từ 82 reviews — cao nhất và nhiều reviews nhất",
        "Tiêu thụ 6.1 L/100km — tiết kiệm nhất nhóm",
        "Khoang hành lý 580L — rộng nhất nhóm",
        "5-star Euro NCAP — tiêu chuẩn an toàn toàn cầu"
      ],
      "cons": [
        "Giá MSRP 1.38 tỷ — đắt nhất trong nhóm",
        "Không có thông tin giá thị trường (market_id không được cung cấp)"
      ]
    },
    {
      "variant_id": 202,
      "make": "Mazda", "model": "CX-5", "year": 2024, "trim": "2.0 Premium",
      "fuel_type": "Gasoline",
      "specs": { "power_hp": 165, "fuel_consumption_l100km": "7.0", "cargo_volume_l": "442" },
      "latest_price": null,
      "msrp_base": 1050000000,
      "avg_rating": 4.2, "review_count": 56,
      "pros": [
        "Giá MSRP 1.05 tỷ — rẻ nhất trong nhóm",
        "Rating 4.2/5 từ 56 reviews — đáng tin cậy",
        "5-star ASEAN NCAP — an toàn tiêu chuẩn khu vực"
      ],
      "cons": [
        "Power 165 hp — thấp nhất trong nhóm (median 188 hp)",
        "Khoang hành lý 442L — nhỏ nhất trong nhóm",
        "Tiêu thụ 7.0 L/100km — trung bình, cao hơn RAV4 Hybrid"
      ]
    },
    {
      "variant_id": 203,
      "make": "Hyundai", "model": "Tucson", "year": 2024, "trim": "1.6T AWD",
      "fuel_type": "Gasoline",
      "specs": { "power_hp": 180, "fuel_consumption_l100km": "8.5", "cargo_volume_l": "539" },
      "latest_price": null,
      "msrp_base": 1100000000,
      "avg_rating": 3.8, "review_count": 24,
      "pros": [
        "AWD — khả năng vận hành tốt hơn trong điều kiện địa hình",
        "Torque 265 Nm — cao nhất trong nhóm",
        "Khoang hành lý 539L — lớn thứ hai trong nhóm"
      ],
      "cons": [
        "Tiêu thụ 8.5 L/100km — kém hiệu quả nhất trong nhóm",
        "Rating 3.8/5 từ 24 reviews — thấp nhất, ít reviews nhất",
        "Không có dữ liệu safety_rating trong DB"
      ]
    }
  ],
  "comparison_table": {
    "make_model":              { "201": "Toyota RAV4",    "202": "Mazda CX-5",     "203": "Hyundai Tucson" },
    "year":                    { "201": 2024,             "202": 2024,             "203": 2024 },
    "fuel_type":               { "201": "Hybrid",         "202": "Gasoline",       "203": "Gasoline" },
    "drivetrain":              { "201": "FWD",            "202": "FWD",            "203": "AWD" },
    "power_hp":                { "201": 218,              "202": 165,              "203": 180 },
    "torque_nm":               { "201": 221,              "202": 213,              "203": 265 },
    "fuel_consumption_l100km": { "201": "6.1 L/100km",   "202": "7.0 L/100km",   "203": "8.5 L/100km" },
    "cargo_volume_l":          { "201": "580L",           "202": "442L",           "203": "539L" },
    "safety_rating":           { "201": "5-star Euro NCAP","202": "5-star ASEAN NCAP","203": null },
    "airbags":                 { "201": "7",              "202": "6",              "203": "4" },
    "latest_price":            { "201": null,             "202": null,             "203": null },
    "msrp_base":               { "201": 1380000000,       "202": 1050000000,       "203": 1100000000 },
    "avg_rating":              { "201": 4.5,              "202": 4.2,              "203": 3.8 },
    "review_count":            { "201": 82,               "202": 56,               "203": 24 }
  },
  "recommended_variant_id": 202,
  "recommendation_reason": "Mazda CX-5 đạt điểm tổng 83.6/100: giá MSRP 1.05 tỷ — rẻ nhất nhóm (+35 pts), rating 4.2★ từ 56 reviews (+33.6 pts), có đầy đủ safety và cargo data (+15 pts). Dù RAV4 Hybrid vượt trội về specs, mức giá cạnh tranh và rating ổn định của CX-5 phù hợp hơn cho đại đa số người dùng.",
  "scores": {
    "201": 51.0,
    "202": 83.6,
    "203": 70.1
  },
  "notes": "market_id not provided — latest_price is null for all variants. Price ranking based on msrp_base. Variant 203: safety_rating not available in variant_spec_kv."
}
```
