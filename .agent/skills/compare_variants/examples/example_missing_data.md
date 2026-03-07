# Example 3: Missing Data Cases

**Scenario:** Các trường hợp thiếu dữ liệu thường gặp và cách xử lý đúng.

---

## Case 3a: Variant_specs hoàn toàn không có row

**Tình huống:** `variant_id = 205` không tồn tại trong bảng `variant_specs`.

**Xử lý:**
```
variant_specs query → 0 rows returned

→ Tất cả structured spec fields = null:
  { power_hp: null, torque_nm: null, displacement_cc: null,
    length_mm: null, width_mm: null, height_mm: null,
    wheelbase_mm: null, curb_weight_kg: null,
    battery_kwh: null, range_km: null }

→ Ghi vào notes: "variant_id 205: no data in variant_specs"
```

**Ảnh hưởng đến Pros/Cons:**
```
❌ KHÔNG được viết pros về power, torque, dimensions (null)
✅ Có thể viết cons: "Không có thông số kỹ thuật cơ bản (power, torque) trong DB"
```

**Ảnh hưởng đến comparison_table:**
```
power_hp:  { "204": 150, "205": null }
torque_nm: { "204": 200, "205": null }
```

---

## Case 3b: Không có price_history cho variant trong market

**Tình huống:** `variant_id = 206`, `market_id = 3`, nhưng không có row nào trong `variant_price_history`.

**Xử lý:**
```sql
SELECT price FROM variant_price_history
WHERE variant_id=206 AND market_id=3 AND price_type='avg_market'
ORDER BY captured_at DESC LIMIT 1;
-- → 0 rows returned
```

```
→ latest_price = null
→ Ghi vào notes: "No price data for variant 206 in market 3 (price_type='avg_market')"
```

**Ảnh hưởng đến scoring (price_score):**
```
Variant 206: latest_price = null, msrp_base = 850000000

Mixed case: variant 205 có latest_price=900000000, variant 206 không có

→ Variant 206 dùng msrp_base=850000000 để ranking price
→ Hoặc nếu không muốn trộn: variant 206 price_score = 17.5 (neutral)
→ Ghi rõ trong notes cách xử lý
```

> ⚠️ **Lưu ý implementation:** Bước 7 trong SKILL.md hướng dẫn rõ: khi mixed null/non-null,
> variant không có price → `price_score = 17.5`. Ghi vào notes.

---

## Case 3c: Không có reviews

**Tình huống:** `variant_id = 207` chưa có review nào.

**Xử lý:**
```sql
SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count
FROM car_reviews WHERE variant_id=207;
-- → avg_rating=NULL, review_count=0
```

```
→ avg_rating = null
→ review_count = 0
→ rating_score = 20 (neutral, không phạt)
→ KHÔNG được viết pros về rating
→ Có thể viết cons: "Chưa có review trong hệ thống (0 reviews)"
```

---

## Case 3d: Variant_id không tồn tại trong car_variants

**Tình huống:** Input `variant_ids = [101, 999]` — variant 999 không có trong DB.

**Xử lý:**
```sql
SELECT ... FROM car_variants WHERE variant_id=999;
-- → 0 rows returned
```

```
→ Ghi vào notes: "variant_id 999: not found in car_variants, excluded from comparison"
→ Tiếp tục với [101] còn lại

Kiểm tra: còn lại 1 variant < 2 required
→ Trả lỗi: "Insufficient valid variants: only 1 found after excluding not-found IDs.
            Minimum 2 required for comparison."
```

**Output khi lỗi:**
```json
{
  "error": "Insufficient valid variants",
  "detail": "variant_ids [101, 999] provided. variant_id 999 not found in car_variants. Only 1 valid variant remains — minimum 2 required.",
  "items": null,
  "comparison_table": null,
  "recommended_variant_id": null,
  "recommendation_reason": null,
  "scores": null,
  "notes": "variant_id 999: not found in car_variants."
}
```

---

## Case 3e: Tất cả specs null nhưng vẫn có basic info

**Tình huống:** Variant 208 có đủ thông tin trong `car_variants` nhưng không có gì trong `variant_specs` hoặc `variant_spec_kv`.

**Scoring vẫn chạy được vì:**
- `seats` lấy từ `car_variants` (không phải variant_specs)
- `rating_score` từ car_reviews
- `price_score` từ msrp_base

**Output item:**
```json
{
  "variant_id": 208,
  "make": "SomeCompany",
  "model": "X1",
  "year": 2023,
  "trim": "Base",
  "body_type": "SUV",
  "fuel_type": "Gasoline",
  "specs": {
    "power_hp": null,
    "torque_nm": null,
    "displacement_cc": null,
    "length_mm": null,
    "width_mm": null,
    "height_mm": null,
    "wheelbase_mm": null,
    "curb_weight_kg": null,
    "battery_kwh": null,
    "range_km": null
  },
  "latest_price": null,
  "msrp_base": 750000000,
  "avg_rating": 3.9,
  "review_count": 8,
  "pros": [
    "Giá MSRP 750 triệu — rẻ nhất trong nhóm so sánh"
  ],
  "cons": [
    "Không có thông số kỹ thuật trong DB (power, torque, dimensions đều null)",
    "Chỉ có 8 reviews — ít dữ liệu để đánh giá độ tin cậy"
  ]
}
```

Và `comparison_table` cho variant này:
```json
"power_hp": { "207": 180, "208": null },
"torque_nm": { "207": 230, "208": null }
```

> **Rule từ SKILL.md:** Keys mà TẤT CẢ variants đều null sẽ bị bỏ khỏi comparison_table.
> Nếu chỉ một số null thì vẫn giữ key, dùng null cho variant không có data.
