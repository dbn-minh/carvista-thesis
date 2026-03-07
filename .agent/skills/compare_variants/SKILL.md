---
name: compare_variants
description: |
  So sánh 2–5 variants xe ô tô trong database CarVista.
  Fetch specs, pricing (nếu có market_id), ratings từ DB rồi sinh bảng so sánh,
  pros/cons thực tế (chỉ từ dữ liệu DB), và gợi ý chọn xe có lý do cụ thể.
  Kích hoạt khi user nói "so sánh xe", "compare variants", "xe nào tốt hơn",
  "so sánh [tên xe] với [tên xe]", "pros cons của các xe", hoặc cung cấp danh sách
  variant_ids cần so sánh.
  KHÔNG ĐƯỢC bịa specs/price/rating — thiếu data thì null + note.
---

# Goal

So sánh 2–5 car variants một cách khách quan, dựa 100% vào dữ liệu thực từ DB.
Output bao gồm: bảng so sánh specs, pros/cons cho từng variant, và recommendation
có chấm điểm (rating + price + practicality). Không suy đoán hay hallucinate.

---

# Instructions

## Bước 1: Validate Input

Nhận input với các field:

| Field | Type | Bắt buộc | Mặc định |
|---|---|---|---|
| `variant_ids` | array of BIGINT | ✅ | — |
| `market_id` | INT | ❌ | null |
| `price_type` | string | ❌ | `'avg_market'` |

**Validation rules:**
- `variant_ids` phải có 2–5 phần tử → nếu vi phạm: báo lỗi ngay.
- Các giá trị trong `variant_ids` phải là số nguyên dương.
- Nếu `market_id` null/không có → `latest_price` của mọi variant = `null`.
- Nếu `price_type` không có → dùng `'avg_market'`.

## Bước 2: Fetch Variant Details

Với **mỗi** `variant_id`, chạy SQL sau:

```sql
SELECT
  v.variant_id,
  v.model_year,
  v.trim_name,
  v.body_type,
  v.engine,
  v.transmission,
  v.drivetrain,
  v.fuel_type,
  v.seats,
  v.doors,
  v.msrp_base,
  mo.name     AS model_name,
  mo.segment,
  mk.name     AS make_name
FROM car_variants v
JOIN car_models mo ON mo.model_id = v.model_id
JOIN car_makes  mk ON mk.make_id  = mo.make_id
WHERE v.variant_id = :variant_id;
```

Nếu **variant_id không tìm thấy** → đưa variant đó vào `notes` là "not found",
bỏ qua trong so sánh. Nếu số còn lại < 2 → báo lỗi không đủ variant.

## Bước 3: Fetch Structured Specs

Với mỗi variant_id, chạy **2 query**:

### 3a. Structured specs từ `variant_specs`:

```sql
SELECT
  power_hp,
  torque_nm,
  displacement_cc,
  length_mm,
  width_mm,
  height_mm,
  wheelbase_mm,
  curb_weight_kg,
  battery_kwh,
  range_km
FROM variant_specs
WHERE variant_id = :variant_id;
```

Nếu không có row → tất cả spec fields = `null`.

### 3b. Key-value specs từ `variant_spec_kv` (whitelist):

```sql
SELECT spec_key, spec_value, unit
FROM variant_spec_kv
WHERE variant_id = :variant_id
  AND spec_key IN (
    'fuel_consumption_l100km',
    'fuel_consumption_kwh100km',
    'acceleration_0_100',
    'top_speed_kmh',
    'cargo_volume_l',
    'towing_capacity_kg',
    'ground_clearance_mm',
    'turning_radius_m',
    'warranty_years',
    'warranty_km',
    'charging_time_ac_h',
    'charging_time_dc_min',
    'airbags',
    'safety_rating',
    'safety_rating_body'
  );
```

Merge kết quả vào object `specs` của variant.

## Bước 4: Fetch Latest Price (nếu có market_id)

**Chỉ chạy khi `market_id` được cung cấp.** Với mỗi variant_id:

```sql
SELECT price
FROM variant_price_history
WHERE variant_id  = :variant_id
  AND market_id   = :market_id
  AND price_type  = :price_type
ORDER BY captured_at DESC
LIMIT 1;
```

- Nếu có kết quả → `latest_price = price`.
- Nếu không có row → `latest_price = null`, thêm note:
  `"No price data for variant :variant_id in market :market_id"`.
- Nếu `market_id` null → `latest_price = null` cho mọi variant (không chạy query).

## Bước 5: Fetch Rating & Review Count

Với mỗi variant_id:

```sql
SELECT
  AVG(rating)  AS avg_rating,
  COUNT(*)     AS review_count
FROM car_reviews
WHERE variant_id = :variant_id;
```

- Nếu `COUNT(*) = 0` → `avg_rating = null`, `review_count = 0`.
- Làm tròn `avg_rating` đến 1 chữ số thập phân.

## Bước 6: Generate Pros & Cons

**⚠️ CHỈ ĐƯỢC dùng dữ liệu đã fetch ở bước 2–5. KHÔNG bịa.**

Với mỗi variant, sinh 3–5 pros và 3–5 cons dựa trên:

| Tiêu chí | Cách đánh giá |
|---|---|
| **Power** | `power_hp` cao hơn median của pool → pro; thấp hơn → con |
| **Torque** | `torque_nm` cao hơn median → pro |
| **Fuel efficiency** | `fuel_consumption_l100km` thấp hơn median → pro (hiệu quả hơn) |
| **EV range** | `range_km` cao → pro (chỉ áp dụng EV/hybrid) |
| **Price** | `latest_price` hoặc `msrp_base` thấp hơn median → pro (giá cạnh tranh hơn) |
| **Rating** | `avg_rating ≥ 4.0` → pro; `< 3.0` → con |
| **Practicality** | `seats ≥ 7` → pro (gia đình); `cargo_volume_l` cao → pro |
| **Safety** | `safety_rating` và `airbags` nếu có |
| **Missing data** | Thiếu data quan trọng → con: "Không có thông số [X] để đánh giá" |

**Quy tắc nghiêm ngặt:**
- Mỗi pro/con phải kèm con số cụ thể từ DB (ví dụ: "Power 180 hp — cao hơn mức trung bình 155 hp").
- Nếu field = `null` → không được đưa vào pros (có thể đưa vào cons nếu quan trọng).
- KHÔNG SO SÁNH với xe ngoài danh sách đang so sánh.

## Bước 7: Tính Recommendation Score

Chấm điểm cho mỗi variant theo thang 100:

```
score = (rating_score × 40) + (price_score × 35) + (practicality_score × 25)
```

**rating_score (0–40):**
- `avg_rating` null → 20 (neutral)
- `avg_rating` có → `(avg_rating / 5.0) × 40`

**price_score (0–35):**
- `latest_price` và `msrp_base` đều null → 17.5 (neutral)
- Dùng `latest_price` nếu có, fallback `msrp_base`
- Xe rẻ nhất → 35, xe đắt nhất → 0, linear interpolation

**practicality_score (0–25):**
- `seats ≥ 7` → +10
- `range_km` hoặc `fuel_consumption` có data → +5
- `cargo_volume_l` có data → +5
- `safety_rating` có data → +5
- Tổng cộng tối đa 25, tối thiểu 0

Variant có score cao nhất → `recommended_variant_id`.
Nếu tie → chọn variant có `avg_rating` cao hơn.

## Bước 8: Build Comparison Table

```
comparison_table = {
  "make_model":        { variant_id_1: "Toyota Camry",    variant_id_2: "Honda Accord" },
  "year":              { variant_id_1: 2024,              variant_id_2: 2024 },
  "trim":              { variant_id_1: "2.5 Premium",     variant_id_2: "1.5T Sport" },
  "body_type":         { ... },
  "fuel_type":         { ... },
  "engine":            { ... },
  "transmission":      { ... },
  "drivetrain":        { ... },
  "seats":             { ... },
  "power_hp":          { ... },
  "torque_nm":         { ... },
  "displacement_cc":   { ... },
  "fuel_consumption":  { ... },   ← l/100km hoặc kWh/100km tùy fuel_type
  "range_km":          { ... },   ← null nếu không phải EV/hybrid
  "length_mm":         { ... },
  "width_mm":          { ... },
  "height_mm":         { ... },
  "wheelbase_mm":      { ... },
  "curb_weight_kg":    { ... },
  "cargo_volume_l":    { ... },
  "safety_rating":     { ... },
  "airbags":           { ... },
  "warranty":          { ... },   ← "X years / Y km" nếu có
  "latest_price":      { ... },   ← null nếu không có market_id
  "msrp_base":         { ... },
  "avg_rating":        { ... },
  "review_count":      { ... }
}
```

**Keys nào tất cả variants đều null → bỏ key đó khỏi bảng** (giữ bảng gọn).

## Bước 9: Trả Output JSON chuẩn

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
        "fuel_consumption_l100km": 7.2,
        "seats": 5,
        "length_mm": 4885,
        "width_mm": 1840,
        "height_mm": 1445,
        "wheelbase_mm": 2825,
        "curb_weight_kg": 1560,
        "safety_rating": "5-star ASEAN NCAP",
        "airbags": "8",
        "warranty_years": "3",
        "warranty_km": "100000"
      },
      "latest_price": 1200000000,
      "msrp_base": 1150000000,
      "avg_rating": 4.3,
      "review_count": 47,
      "pros": [
        "Power 203 hp — cao hơn mức trung bình 185 hp của nhóm",
        "Rating 4.3/5 từ 47 reviews — cao nhất trong nhóm",
        "5-star ASEAN NCAP — mức an toàn hàng đầu"
      ],
      "cons": [
        "Giá 1.2 tỷ VND — cao nhất trong nhóm so sánh",
        "Tiêu thụ 7.2 l/100km — kém hiệu quả hơn mức trung bình 6.8 l/100km"
      ]
    }
  ],
  "comparison_table": {
    "make_model": { "101": "Toyota Camry", "102": "Honda Accord" },
    "power_hp":   { "101": 203,            "102": 188 }
  },
  "recommended_variant_id": 101,
  "recommendation_reason": "Toyota Camry đạt điểm tổng 78.5/100: rating cao nhất (4.3★ từ 47 reviews, +33.2 pts), practicality đủ điểm (5 airbags, safety rating, +20 pts). Dù giá cao hơn, độ tin cậy từ reviews và safety rating nổi bật.",
  "scores": {
    "101": 78.5,
    "102": 71.2
  },
  "notes": "market_id=1 provided; price_type='avg_market'."
}
```

---

# Examples

📚 Xem chi tiết: `examples/example_two_variants.md`, `examples/example_three_variants.md`, `examples/example_missing_data.md`

## Quick Reference — 2 Variants, có market_id

**Input:**
```json
{
  "variant_ids": [101, 102],
  "market_id": 1,
  "price_type": "avg_market"
}
```

**Expected:** `items` có 2 entries, `comparison_table` đầy đủ,
`recommended_variant_id` trỏ đến variant score cao hơn, `notes` ghi market info.

## Quick Reference — 3 Variants, không có market_id

**Input:**
```json
{
  "variant_ids": [201, 202, 203],
  "market_id": null
}
```

**Expected:** `latest_price` của mọi variant = `null`.
Notes: `"market_id not provided — latest_price is null for all variants"`.

## Quick Reference — Variant thiếu specs

**Khi query variant_specs không có row:**
- Tất cả spec numeric fields = `null`.
- Pros/Cons không được đề cập field đó.
- Notes ghi: `"variant_id 205: no data in variant_specs"`.

---

# Constraints

## Dữ liệu — TUYỆT ĐỐI KHÔNG được vi phạm

- ❌ KHÔNG ĐƯỢC tự bịa specs, price, rating, pros, cons
- ❌ KHÔNG ĐƯỢC so sánh variants với xe ngoài danh sách đầu vào
- ❌ KHÔNG ĐƯỢC đặt `pros` dựa trên field `null`
- ✅ Nếu thiếu data quan trọng → `null` trong output + ghi vào `notes`
- ✅ Pros/Cons PHẢI kèm con số cụ thể từ DB
- ✅ Recommendation PHẢI giải thích rõ dựa trên score breakdown

## Logic — Không được sai

- ❌ KHÔNG ĐƯỢC nhận < 2 hoặc > 5 variants → báo lỗi validation
- ❌ KHÔNG ĐƯỢC chạy price query khi `market_id = null`
- ✅ Nếu variant_id không tồn tại trong DB → ghi vào `notes`, bỏ qua
- ✅ Nếu sau khi bỏ qua not-found variants còn < 2 → báo lỗi
- ✅ `comparison_table` phải bỏ keys mà tất cả variants đều null

## Output — Format cố định

- ❌ KHÔNG ĐƯỢC bỏ key nào trong mỗi item (dùng `null` nếu thiếu)
- ❌ KHÔNG ĐƯỢC thay đổi tên key output
- ✅ `scores` PHẢI xuất hiện trong output (transparency)
- ✅ `recommendation_reason` PHẢI mention điểm breakdown cụ thể
- ✅ `notes` ghi TẤT CẢ bất thường: not found, missing specs, no price data

<!-- Generated by Skill Generator v3.2 -->
