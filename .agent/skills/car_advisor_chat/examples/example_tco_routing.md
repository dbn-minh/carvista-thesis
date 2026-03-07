# Example 3: Routing sang calculate_tco

**Scenario:** User hỏi tổng chi phí sở hữu xe 700 triệu tại VN trong 5 năm.

---

## Input

```json
{
  "session_id": null,
  "user_id": null,
  "message": "Tính TCO xe giá 700 triệu ở VN 5 năm",
  "context": {}
}
```

---

## Quá trình xử lý

### Bước 1: Session mới
- session_id=null → INSERT ai_chat_sessions → `session_id = 600`
- user_id=null → anonymous session
- merged_context = `{}`

### Bước 2: Intent Detection
- "tính TCO" → keyword match trực tiếp
- "5 năm" → `ownership_years = 5`
- "700 triệu" → `base_price = 700,000,000`
- "ở VN" → market_id=1
- **intent = `tco`**

### Bước 3: Prerequisite check
- ✅ `base_price = 700,000,000` (parse từ "700 triệu")
- ✅ market_id = 1 (parse từ "ở VN")
- ✅ `ownership_years = 5`
- ✅ Đủ thông tin → không cần hỏi lại

### Bước 4d: Resolve profile_id

```sql
SELECT profile_id, name FROM tco_profiles WHERE market_id = 1 ORDER BY profile_id ASC LIMIT 1;
-- → profile_id = 1 (Vietnam Standard Profile)
```

**Chuẩn bị payload cho calculate_tco:**
```json
{
  "profile_id": 1,
  "base_price": 700000000,
  "ownership_years": 5,
  "km_per_year": null
}
```

**Log tool:**
```sql
INSERT INTO ai_chat_messages (session_id, role, tool_name, tool_payload, content, created_at)
VALUES (600, 'tool', 'calculate_tco', '{"profile_id":1,"base_price":700000000,...}', NULL, NOW());
```

**Kết quả từ calculate_tco** (giả định):
```json
{
  "currency": "VND",
  "costs": {
    "registration_tax": 49000000,
    "excise_tax": 70000000,
    "vat": 63000000,
    "insurance_total": 35000000,
    "maintenance_total": 42000000,
    "depreciation_total": 280000000
  },
  "total_cost": 1239000000,
  "yearly_cost_avg": 247800000
}
```

### Bước 5: Generate Answer (tóm tắt conversational)

> "Với xe giá **700 triệu VND**, tính TCO 5 năm theo profile thuế phí Việt Nam:
>
> **Chi phí một lần (mua xe):**
> - Thuế đăng ký: **49 triệu** | Thuế tiêu thụ đặc biệt: **70 triệu** | VAT: **63 triệu**
> - Tổng thuế phí ban đầu: ~182 triệu
>
> **Chi phí hàng năm (5 năm):**
> - Bảo hiểm: **35 triệu** | Bảo dưỡng: **42 triệu** | Khấu hao: **280 triệu**
>
> **Tổng 5 năm: ~1.24 tỷ VND** (~248 triệu/năm)
>
> Nghĩa là xe 700 triệu, sau 5 năm anh thực ra chi khoảng 1.24 tỷ gồm tất cả chi phí.
> Anh muốn em so sánh TCO này với xe có giá khác không?"

---

## Output JSON

```json
{
  "session_id": 600,
  "answer": "Với xe giá 700 triệu VND, tính TCO 5 năm theo profile thuế phí Việt Nam...",
  "intent": "tco",
  "suggested_actions": [
    {
      "type": "calculate_tco",
      "label": "So sánh TCO xe 900 triệu / 5 năm",
      "payload": { "profile_id": 1, "base_price": 900000000, "ownership_years": 5 }
    },
    {
      "type": "calculate_tco",
      "label": "TCO 700 triệu trong 3 năm",
      "payload": { "profile_id": 1, "base_price": 700000000, "ownership_years": 3 }
    }
  ],
  "follow_up_questions": [
    "Anh muốn so sánh với xe giá khác không?",
    "Anh đi khoảng bao nhiêu km/năm? Em có thể tính chính xác hơn phần bảo dưỡng."
  ],
  "facts_used": [
    { "source": "tco_profiles", "id": 1 },
    { "source": "tco_rules", "profile_id": 1 }
  ]
}
```

---

## Edge Case: Thiếu thông tin → Hỏi lại

**Nếu user chỉ nói:** `"tính TCO cho tôi"`

```
Thiếu: base_price, ownership_years, market
intent = clarification_needed
```

**Answer:**
> "Để tính tổng chi phí sở hữu xe, em cần thêm vài thông tin:
>
> 1. **Giá xe** anh dự định mua khoảng bao nhiêu?
> 2. **Thị trường / quốc gia** (để áp đúng thuế phí)?
> 3. **Số năm** anh dự định giữ xe?"

**Output:**
```json
{
  "session_id": 601,
  "answer": "Để tính tổng chi phí sở hữu xe, em cần thêm vài thông tin...",
  "intent": "clarification_needed",
  "suggested_actions": [],
  "follow_up_questions": [
    "Giá xe dự kiến bao nhiêu?",
    "Anh ở thị trường nào (VN, US...)?",
    "Anh định giữ xe bao nhiêu năm?"
  ],
  "facts_used": []
}
```
