# Scoring Formula — compare_variants Skill

Chi tiết công thức tính điểm để chọn recommended variant.

---

## Tổng quan

```
total_score = (rating_score × 40) + (price_score × 35) + (practicality_score × 25)
```

Thang điểm: **0 – 100**.

---

## 1. Rating Score (0 – 40 điểm)

| Điều kiện | Điểm |
|---|---|
| `avg_rating` = null (không có reviews) | 20 (neutral, không phạt) |
| `avg_rating` có giá trị | `(avg_rating / 5.0) × 40` |

**Ví dụ:**
- `avg_rating = 4.5` → `(4.5 / 5.0) × 40 = 36 pts`
- `avg_rating = 3.0` → `(3.0 / 5.0) × 40 = 24 pts`
- `avg_rating = null` → `20 pts`

---

## 2. Price Score (0 – 35 điểm)

**Ưu tiên:** Dùng `latest_price` nếu có, fallback sang `msrp_base`.

**Khi tất cả prices đều null:**
→ `price_score = 17.5` cho mọi variant (neutral).

**Khi có ít nhất 1 price:**

```
price_score = ((max_price - variant_price) / (max_price - min_price)) × 35
```

*Xe rẻ nhất trong nhóm → 35 điểm. Xe đắt nhất → 0 điểm.*

**Edge case — Tất cả xe cùng giá:**
→ `price_score = 17.5` cho mọi variant.

**Mixed null/non-null:**
- Variant có price → dùng giá thực.
- Variant không có price → loại khỏi price ranking, `price_score = 17.5`.

**Ví dụ (3 variants):**
- Giá: A=800M, B=950M, C=1050M
- `price_score_A = (1050 - 800) / (1050 - 800) × 35 = 35 pts`
- `price_score_B = (1050 - 950) / (1050 - 800) × 35 = 14 pts`
- `price_score_C = (1050 - 1050) / (1050 - 800) × 35 = 0 pts`

---

## 3. Practicality Score (0 – 25 điểm)

Cộng điểm theo tiêu chí có/không:

| Tiêu chí | Điều kiện | Điểm |
|---|---|---|
| **Family seats** | `seats ≥ 7` | +10 |
| **Powertrain data** | `range_km != null` OR (`fuel_consumption_l100km != null` OR `fuel_consumption_kwh100km != null`) | +5 |
| **Cargo data** | `cargo_volume_l != null` | +5 |
| **Safety data** | `safety_rating != null` | +5 |

Tổng cộng tối đa: **25 điểm**. Tối thiểu: **0 điểm**.

**Lưu ý:**
- `seats` lấy từ `car_variants.seats`.
- Các specs lấy từ `variant_spec_kv` hoặc `variant_specs`.

---

## 4. Xử lý Tie-break

Nếu 2 variants có cùng `total_score` (làm tròn đến 1 decimal):
1. Chọn variant có `avg_rating` cao hơn.
2. Nếu `avg_rating` cũng bằng nhau → chọn variant có `review_count` nhiều hơn.
3. Nếu vẫn tie → chọn variant_id nhỏ hơn (deterministic).

---

## 5. Output `scores` field

```json
"scores": {
  "101": 78.5,
  "102": 65.2,
  "103": 71.0
}
```

Làm tròn đến **1 chữ số thập phân**.

---

## 6. `recommendation_reason` Template

```
[make model] đạt điểm tổng [X]/100:
rating [Y]★ từ [N] reviews (+[rating_pts] pts),
giá [price] — [rẻ nhất/thứ N] trong nhóm (+[price_pts] pts),
[practicality details] (+[prac_pts] pts).
[Lý do thuyết phục 1 câu.]
```

**Ví dụ:**
> "Toyota Camry đạt điểm tổng 78.5/100: rating 4.3★ từ 47 reviews (+34.4 pts), giá 1.2 tỷ — cao nhất trong nhóm (+0 pts), có safety rating ASEAN NCAP và cargo data (+15 pts). Dù giá cao, sức hút từ reviews thực tế và tiêu chuẩn an toàn nổi trội."
