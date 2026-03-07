# SQL Queries — compare_variants Skill

Toàn bộ SQL queries được dùng trong skill, tổ chức theo bước.

---

## Bước 2: Fetch Variant Details

```sql
-- Chạy cho mỗi variant_id
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

**Notes:**
- Nếu không có row → variant "not found", ghi vào notes, bỏ qua.
- Chạy từng variant để dễ xử lý lỗi riêng lẻ.

---

## Bước 3a: Fetch Structured Specs

```sql
-- Chạy cho mỗi variant_id
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

**Notes:**
- Nếu không có row → tất cả fields trên = `null`.
- Ghi vào notes: `"variant_id X: no data in variant_specs"`.

---

## Bước 3b: Fetch KV Specs (Whitelist)

```sql
-- Chạy cho mỗi variant_id
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

**Notes:**
- Kết quả trả về dạng rows → merge thành object `{ spec_key: spec_value }`.
- Xem `spec_whitelist.md` để biết lý do chọn lọc các keys này.

---

## Bước 4: Fetch Latest Price

```sql
-- Chỉ chạy khi market_id != null
-- Chạy cho mỗi variant_id
SELECT price
FROM variant_price_history
WHERE variant_id  = :variant_id
  AND market_id   = :market_id
  AND price_type  = :price_type
ORDER BY captured_at DESC
LIMIT 1;
```

**Notes:**
- Nếu `market_id` là null → **bỏ qua hoàn toàn query này** cho mọi variant.
- Nếu không có row → `latest_price = null` + ghi notes.

---

## Bước 5: Fetch Rating & Review Count

```sql
-- Chạy cho mỗi variant_id
SELECT
  AVG(rating)  AS avg_rating,
  COUNT(*)     AS review_count
FROM car_reviews
WHERE variant_id = :variant_id;
```

**Notes:**
- MySQL luôn trả về 1 row từ aggregation (có thể NULL).
- Nếu `COUNT(*) = 0` → `avg_rating = null`, `review_count = 0`.
- Làm tròn `avg_rating` đến 1 chữ số thập phân (`ROUND(AVG(rating), 1)`).

---

## Batch Query Alternative (tối ưu hiệu năng)

Thay vì chạy N queries riêng, có thể batch:

```sql
-- Batch fetch details (thay :ids bằng danh sách, ví dụ: 101, 102, 103)
SELECT
  v.variant_id,
  v.model_year, v.trim_name, v.body_type, v.engine,
  v.transmission, v.drivetrain, v.fuel_type, v.seats, v.doors, v.msrp_base,
  mo.name AS model_name, mo.segment,
  mk.name AS make_name
FROM car_variants v
JOIN car_models mo ON mo.model_id = v.model_id
JOIN car_makes  mk ON mk.make_id  = mo.make_id
WHERE v.variant_id IN (:ids);

-- Batch fetch specs
SELECT variant_id, power_hp, torque_nm, displacement_cc,
       length_mm, width_mm, height_mm, wheelbase_mm, curb_weight_kg,
       battery_kwh, range_km
FROM variant_specs
WHERE variant_id IN (:ids);

-- Batch fetch rating
SELECT variant_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
FROM car_reviews
WHERE variant_id IN (:ids)
GROUP BY variant_id;
```

> ⚠️ Khi dùng batch: phải JOIN/merge kết quả vào từng variant_id sau khi fetch.
> Các variant_id không xuất hiện trong kết quả = not found.
