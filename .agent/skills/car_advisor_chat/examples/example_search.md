# Example 1: Tìm xe theo ngân sách

**Scenario:** User mới vào chatbox, tìm SUV 7 chỗ ở thị trường Việt Nam dưới 1 tỷ.

---

## Input

```json
{
  "session_id": null,
  "user_id": 42,
  "message": "SUV 7 chỗ dưới 1 tỷ ở VN",
  "context": { "market_id": 1 }
}
```

---

## Quá trình xử lý

### Bước 1: Session Management
- `session_id = null` → **Tạo session mới**
- INSERT ai_chat_sessions → `session_id = 500`
- merged_context = `{ market_id: 1, budget: null }` (budget chưa explicit)
- Log user message → message_id=1001

### Bước 2: Intent Detection
- "SUV" → body_type candidate
- "7 chỗ" → seats ≥ 7
- "dưới 1 tỷ" → budget ≤ 1,000,000,000
- "ở VN" → market_id=1 (đã có trong context)
- **intent = `search_catalog`**

### Bước 3: Extract filters
```
body_type = 'SUV'
min_seats = 7
budget_max = 1000000000
market_id = 1
```

### Bước 4a: Catalog Search (với market price filter)

```sql
-- Kết quả (giả định):
-- variant_id=201: Toyota Fortuner 2024 2.4MT, 7 chỗ, market_price=890M, rating=4.2/47 reviews
-- variant_id=205: Mitsubishi Pajero Sport 2024 MT, 7 chỗ, market_price=960M, rating=4.0/23 reviews
-- variant_id=210: Hyundai SantaFe 2024 MT, 7 chỗ, market_price=1000M, rating=4.3/31 reviews
```

### Update session context
```json
{
  "market_id": 1,
  "body_type": "SUV",
  "seats": 7,
  "budget": 1000000000,
  "last_searched_variants": [201, 205, 210]
}
```

### Bước 5: Generate Answer

**facts_used:**
- `car_variants.variant_id`: 201, 205, 210
- `variant_price_history` (market_id=1)
- `car_reviews` (avg_rating)

**Answer:**
> "Dưới 1 tỷ ở thị trường VN, em tìm được 3 SUV 7 chỗ đáng xem xét:
>
> 1. **Toyota Fortuner 2024 2.4MT** — 890 triệu, ⭐ 4.2 (47 reviews)
>    Ưu điểm: thương hiệu tin cậy, bền bỉ, phụ tùng dễ tìm.
>
> 2. **Hyundai SantaFe 2024 MT** — 1.0 tỷ (top ngân sách), ⭐ 4.3 (31 reviews)
>    Rating cao nhất trong nhóm, thiết kế hiện đại hơn.
>
> 3. **Mitsubishi Pajero Sport 2024 MT** — 960 triệu, ⭐ 4.0 (23 reviews)
>    Gầm cao, phù hợp đường dài / local terrain.
>
> Anh muốn em so sánh chi tiết 2 xe nào không? Hay anh có thêm tiêu chí gì (nhiên liệu, mục đích sử dụng)?"

---

## Output JSON

```json
{
  "session_id": 500,
  "answer": "Dưới 1 tỷ ở thị trường VN, em tìm được 3 SUV 7 chỗ...",
  "intent": "search_catalog",
  "suggested_actions": [
    {
      "type": "compare_variants",
      "label": "So sánh Fortuner vs SantaFe 2024",
      "payload": { "variant_ids": [201, 210], "market_id": 1 }
    },
    {
      "type": "calculate_tco",
      "label": "Tính tổng chi phí 5 năm Toyota Fortuner",
      "payload": { "profile_id": 1, "base_price": 890000000, "ownership_years": 5 }
    }
  ],
  "follow_up_questions": [
    "Anh muốn so sánh chi tiết 2 xe nào không?",
    "Anh chủ yếu đi trong thành phố hay đường dài / off-road?"
  ],
  "facts_used": [
    { "source": "car_variants", "id": 201 },
    { "source": "car_variants", "id": 205 },
    { "source": "car_variants", "id": 210 },
    { "source": "variant_price_history", "variant_id": 201, "market_id": 1 },
    { "source": "variant_price_history", "variant_id": 205, "market_id": 1 },
    { "source": "variant_price_history", "variant_id": 210, "market_id": 1 },
    { "source": "car_reviews", "variant_id": 201 },
    { "source": "car_reviews", "variant_id": 205 },
    { "source": "car_reviews", "variant_id": 210 }
  ]
}
```
