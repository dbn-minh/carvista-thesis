# Spec Whitelist — compare_variants Skill

Danh sách `spec_key` được phép fetch từ `variant_spec_kv`. Chỉ fetch những key trong list này.

---

## Whitelist (15 keys)

| spec_key | Đơn vị | Mô tả | Dùng cho Pros/Cons? |
|---|---|---|---|
| `fuel_consumption_l100km` | L/100km | Tiêu hao nhiên liệu (ICE/hybrid) | ✅ Có |
| `fuel_consumption_kwh100km` | kWh/100km | Tiêu hao điện (EV) | ✅ Có |
| `acceleration_0_100` | giây | Tăng tốc 0–100 km/h | ✅ Có |
| `top_speed_kmh` | km/h | Tốc độ tối đa | Tùy context |
| `cargo_volume_l` | lít | Thể tích khoang hành lý | ✅ Có |
| `towing_capacity_kg` | kg | Tải trọng kéo tối đa | ✅ Có (SUV/pickup) |
| `ground_clearance_mm` | mm | Khoảng sáng gầm xe | Tùy context |
| `turning_radius_m` | m | Bán kính quay vòng | Tùy context |
| `warranty_years` | năm | Thời hạn bảo hành tính năm | ✅ Có |
| `warranty_km` | km | Thời hạn bảo hành tính km | ✅ Có |
| `charging_time_ac_h` | giờ | Thời gian sạc AC (EV) | ✅ Có (EV) |
| `charging_time_dc_min` | phút | Thời gian sạc DC fast (EV) | ✅ Có (EV) |
| `airbags` | số lượng | Số túi khí | ✅ Có |
| `safety_rating` | text | Kết quả đánh giá an toàn (5-star...) | ✅ Có |
| `safety_rating_body` | text | Tổ chức đánh giá (ASEAN NCAP, Euro NCAP...) | ✅ Kết hợp với safety_rating |

---

## Lý do chỉ dùng whitelist

- **Giữ output gọn:** `variant_spec_kv` có thể có hàng chục keys — chỉ lấy những gì hữu ích cho so sánh người dùng.
- **Tránh noise:** Keys như màu sắc, số lượng tồn kho không liên quan đến so sánh kỹ thuật.
- **Consistency:** Cùng set keys cho mọi variant → bảng so sánh nhất quán.

---

## Cách merge vào `specs` object

Sau khi fetch, merge key-value rows vào object `specs` của từng variant:

```
specs = {
  // Từ variant_specs (structured):
  power_hp: 203,
  torque_nm: 250,
  displacement_cc: 2487,
  length_mm: 4885,
  ...
  // Từ variant_spec_kv (whitelist):
  fuel_consumption_l100km: "7.2",
  acceleration_0_100: "8.5",
  airbags: "8",
  safety_rating: "5-star ASEAN NCAP"
}
```

> **Lưu ý:** Giá trị từ `variant_spec_kv` là `string`. Khi dùng để so sánh số học
> (ví dụ tính median) → parse sang `float`, xử lý lỗi parse.

---

## Spec keys đặc thù theo fuel_type

| fuel_type | Keys ưu tiên hiển thị |
|---|---|
| Gasoline / Diesel | `fuel_consumption_l100km`, `acceleration_0_100` |
| Electric (EV) | `fuel_consumption_kwh100km`, `charging_time_ac_h`, `charging_time_dc_min` |
| Hybrid | `fuel_consumption_l100km`, `fuel_consumption_kwh100km` (nếu có) |

> **Lưu ý trong comparison_table:** Key `fuel_consumption` nên hiển thị giá trị phù hợp
> với `fuel_type` của từng variant, hoặc hiển thị cả hai nếu mix.
