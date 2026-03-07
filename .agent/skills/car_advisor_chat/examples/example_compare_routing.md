# Example 2: Routing sang compare_variants

**Scenario:** Tiếp tục session 500, user yêu cầu so sánh Camry và Accord.

---

## Input

```json
{
  "session_id": 500,
  "message": "So sánh Camry 2022 và Accord 2022"
}
```

---

## Quá trình xử lý

### Bước 1: Load session 500
- session_id=500 tồn tại ✅
- session.context_json → `{ market_id: 1, body_type: "SUV", seats: 7, budget: 1000000000 }`
- input.context = {} → merged_context = session context (không đổi)
- Load history: 2 messages trước (user: "SUV 7 chỗ...", assistant: "Em tìm được...")

### Bước 2: Intent Detection
- "So sánh" → signal compare
- "Camry 2022" + "Accord 2022" → 2 xe cụ thể
- **intent = `compare`**

### Bước 3: Entity Resolution

**Resolve "Camry 2022":**
```sql
SELECT v.variant_id, v.model_year, v.trim_name, mo.name, mk.name
FROM car_variants v JOIN car_models mo ... JOIN car_makes mk ...
WHERE mo.name LIKE '%Camry%' AND v.model_year = 2022
ORDER BY v.model_year DESC LIMIT 5;
-- → 2 rows: variant_id=101 (2.0G), variant_id=102 (2.5Q)
```

→ 2 matches → hỏi user? **Nhưng** user chỉ nói "Camry 2022" chung chung
→ Chọn trim phổ biến nhất / cao nhất: variant_id=102 (2.5Q — cao cấp hơn)
→ Ghi vào notes: "Chọn Camry 2022 2.5Q, nếu anh muốn phiên bản khác hãy chỉ định."

**Resolve "Accord 2022":**
```sql
-- → 1 row: variant_id=150 (Honda Accord 2022 1.5T)
```
→ 1 match → dùng luôn variant_id=150.

### Bước 4b: Route sang compare_variants

**Payload:**
```json
{
  "variant_ids": [102, 150],
  "market_id": 1,
  "price_type": "avg_market"
}
```

**Log tool call:**
```sql
INSERT INTO ai_chat_messages (session_id, role, tool_name, tool_payload, content, created_at)
VALUES (500, 'tool', 'compare_variants', '{"variant_ids":[102,150],"market_id":1,...}', NULL, NOW());
```

**Kết quả từ compare_variants** (tóm tắt):
- Camry 2.5Q: power=203hp, fuel=7.2L/100km, price=1.2B, rating=4.3★
- Accord 1.5T: power=192hp, fuel=6.8L/100km, price=1.02B, rating=4.1★
- recommended: Accord (score 77.8 vs 49.4 — giá cạnh tranh hơn)

### Bước 5: Generate Answer (conversational, KHÔNG dump JSON)

> "Em vừa so sánh **Toyota Camry 2022 2.5Q** và **Honda Accord 2022 1.5T** trên thị trường VN:
>
> **Hiệu năng:**
> - Camry mạnh hơn chút: 203 hp vs 192 hp
> - Nhưng Accord tiết kiệm hơn: 6.8 L/100km so với Camry 7.2 L/100km
>
> **Giá (thị trường VN):**
> - Camry 2.5Q: **1.2 tỷ** | Accord 1.5T: **1.02 tỷ** (rẻ hơn 180 triệu)
>
> **Review cộng đồng:**
> - Camry: 4.3★ (47 reviews) | Accord: 4.1★ (31 reviews)
>
> **Gợi ý của em:** Nếu anh ưu tiên giá và tiết kiệm nhiên liệu → **Accord** phù hợp hơn. Nếu cần sức mạnh và brand prestige hơn → **Camry**.
>
> Anh có muốn tính tổng chi phí sở hữu 5 năm của 1 trong 2 xe không?"

### Update session context
```json
{
  "market_id": 1,
  "last_compared_variants": [102, 150]
}
```

---

## Output JSON

```json
{
  "session_id": 500,
  "answer": "Em vừa so sánh Toyota Camry 2022 2.5Q và Honda Accord 2022 1.5T...",
  "intent": "compare",
  "suggested_actions": [
    {
      "type": "calculate_tco",
      "label": "Tính TCO 5 năm Toyota Camry 2.5Q",
      "payload": { "profile_id": 1, "base_price": 1200000000, "ownership_years": 5 }
    },
    {
      "type": "calculate_tco",
      "label": "Tính TCO 5 năm Honda Accord 1.5T",
      "payload": { "profile_id": 1, "base_price": 1020000000, "ownership_years": 5 }
    },
    {
      "type": "predict_price",
      "label": "Dự đoán giá Accord 1.5T 6 tháng tới",
      "payload": { "variant_id": 150, "market_id": 1, "horizon_months": 6 }
    }
  ],
  "follow_up_questions": [
    "Anh muốn tính tổng chi phí sở hữu 5 năm của xe nào không?",
    "Anh có muốn xem dự đoán biến động giá 6 tháng tới không?"
  ],
  "facts_used": [
    { "source": "car_variants", "id": 102 },
    { "source": "car_variants", "id": 150 },
    { "source": "variant_specs", "id": 102 },
    { "source": "variant_specs", "id": 150 },
    { "source": "variant_price_history", "variant_id": 102, "market_id": 1 },
    { "source": "variant_price_history", "variant_id": 150, "market_id": 1 },
    { "source": "car_reviews", "variant_id": 102 },
    { "source": "car_reviews", "variant_id": 150 }
  ]
}
```

---

## Notes về Entity Resolution

> Khi resolve "Camry 2022" → 2 trims → skill tự chọn trim cao nhất.
> Nếu user muốn cụ thể hơn, answer có thể mention:
> "Em chọn phiên bản Camry 2.5Q (cao nhất). Nếu anh muốn so sánh phiên bản 2.0G thì cho em biết nhé."
