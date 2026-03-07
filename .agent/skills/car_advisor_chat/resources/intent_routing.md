# Intent Routing — car_advisor_chat Skill

Decision tree và rules cho Intent Detection (Bước 2 của SKILL.md).

---

## Decision Tree

```
User message
    │
    ├─► Chứa 2+ tên xe / "so sánh" / "compare" / "vs"?
    │       └─► YES → intent = compare
    │
    ├─► Chứa "dự đoán giá" / "giá tháng sau" / "giá sắp tới" / "forecast"?
    │       └─► YES → intent = predict_price
    │
    ├─► Chứa "TCO" / "tổng chi phí" / "chi phí sở hữu" / "X năm tốn bao nhiêu"?
    │       └─► YES → intent = tco
    │
    ├─► Chứa "tìm xe" / "gợi ý xe" / "xe nào" / budget + loại xe?
    │   Hoặc mô tả nhu cầu (body_type / fuel / seats / budget)?
    │       └─► YES → intent = search_catalog
    │
    ├─► Chứa "mua xe cũ" / "bán xe" / "giá thị trường" / "listing"?
    │       └─► YES → intent = buy_sell_guidance
    │
    ├─► Có đủ context để trả lời không?
    │       └─► NO → intent = clarification_needed
    │
    └─► Còn lại → intent = general_qa
```

---

## Trigger Keyword Map

### Intent: `compare`

| Keyword / Pattern | Ví dụ |
|---|---|
| "so sánh" | "so sánh Camry và Accord" |
| "compare" | "compare RAV4 vs CX-5" |
| "xe nào tốt hơn" | "Camry hay Accord tốt hơn?" |
| "pros cons" | "pros cons của Camry và Accord" |
| "vs", "với" (kèm 2 tên xe) | "Toyota Yaris vs Vios" |
| Danh sách ≥2 tên xe/model | "giữa CR-V, CX-5, Tucson thì..." |

**Prerequisite check (trước khi route):**
- Cần ≥2 variant **resolved** (có variant_id từ DB).
- Nếu chỉ resolve được 1 → hỏi: "Anh muốn so sánh [xe A] với xe nào?"
- Nếu 0 resolved → hỏi: "Anh muốn so sánh những xe nào cụ thể?"

---

### Intent: `predict_price`

| Keyword / Pattern | Ví dụ |
|---|---|
| "dự đoán giá" | "dự đoán giá Camry 2024" |
| "giá tháng sau/năm sau" | "giá Accord tháng sau" |
| "forecast giá" | "forecast giá xe điện VinFast" |
| "giá sẽ tăng/giảm" | "giá CX-5 sẽ giảm không?" |
| "giá tương lai" | "giá tương lai của RAV4" |

**Prerequisite check:**
- Cần: `variant_id` (resolved) + `market_id`.
- Thiếu `market_id` → hỏi: "Anh muốn dự đoán giá ở thị trường nào?"
- Thiếu xe cụ thể → hỏi: "Anh muốn dự đoán giá xe nào?"
- Parse `horizon_months` từ "6 tháng", "1 năm" = 12 months → default 6 nếu không có.

---

### Intent: `tco`

| Keyword / Pattern | Ví dụ |
|---|---|
| "TCO", "tổng chi phí" | "tính TCO xe này" |
| "chi phí sở hữu" | "chi phí sở hữu 5 năm" |
| "X năm tốn bao nhiêu" | "mua xe 800 triệu 5 năm tốn bao nhiêu?" |
| "thuế phí", "bảo hiểm", "bảo dưỡng" (kết hợp) | "bảo hiểm bảo dưỡng tốn bao nhiêu?" |
| "ownership cost" | "ownership cost of this car" |

**Prerequisite check:**
- Cần: `base_price` + market context (→ `profile_id`).
- Parse `base_price` từ: "xe 800 triệu" = 800,000,000, "xe 35k USD" = 35,000.
- Parse `ownership_years` từ: "5 năm" = 5, default 5 nếu không đề cập.
- Thiếu `base_price` → hỏi: "Giá xe anh định mua khoảng bao nhiêu?"
- Thiếu market → hỏi: "Anh ở thị trường nào để em tính đúng thuế phí?"

---

### Intent: `search_catalog`

| Keyword / Pattern | Ví dụ |
|---|---|
| Loại xe + budget | "SUV dưới 1 tỷ" |
| Số chỗ + loại xe | "xe 7 chỗ" |
| Nhiên liệu + nhu cầu | "xe điện đi làm" |
| "gợi ý xe", "xe nào phù hợp" | "gợi ý xe gia đình" |
| "nên mua xe gì" | "nên mua xe gì 700 triệu?" |
| Mô tả use case | "xe đi phố, ít xăng, 5 chỗ" |

**Filter extraction:**
```
budget    ← "dưới X triệu/tỷ", "khoảng X", "tầm X"
body_type ← "SUV", "sedan", "hatchback", "pickup", "MPV", "crossover"
fuel_type ← "xăng", "điện", "hybrid", "dầu" / "gasoline","electric","hybrid","diesel"
seats     ← "7 chỗ" → seats≥7, "5 chỗ" → seats=5
market_id ← từ context, hoặc detect "ở VN" → market_id=1
```

---

### Intent: `clarification_needed`

Kích hoạt khi message quá mơ hồ:
- "Xe tốt" (không có filter nào)
- "Tư vấn cho tôi" (không có nhu cầu cụ thể)
- "Nên mua xe gì?" (không có budget, body_type, hay gì cả)

**Chiến lược hỏi lại — tối đa 3 câu, ưu tiên:**
1. Budget (quan trọng nhất)
2. Mục đích sử dụng (gia đình / đi làm / du lịch / off-road)
3. Nhiên liệu / số chỗ

---

## Context Persistence

Context được merge và lưu vào session. Một khi user đã cung cấp:
- `market_id` → có thể dùng cho các lượt sau trong cùng session
- `budget` → ghi nhớ từ lượt trước
- `fuel_type` → dùng làm default cho tìm kiếm tiếp theo

**Ví dụ multi-turn:**
```
Turn 1: "SUV 7 chỗ ở VN dưới 1 tỷ" → session saves: market_id=1, budget=1B, body_type=SUV, seats=7
Turn 2: "So sánh 2 xe đầu tiên" → dùng lại market_id=1 từ session
Turn 3: "Tính TCO của Fortuner" → dùng market_id=1, hỏi bổ sung base_price
```
