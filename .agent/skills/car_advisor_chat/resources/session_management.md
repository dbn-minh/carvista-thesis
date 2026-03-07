# Session Management — car_advisor_chat Skill

Quy tắc quản lý session, context merge, và multi-turn conversation.

---

## Session Lifecycle

```
User sends message
    │
    ├─► session_id = null?
    │       └─► YES: INSERT ai_chat_sessions → get new session_id
    │
    └─► session_id provided?
            └─► Load session, verify exists
                    └─► NOT FOUND: báo lỗi "session_id không tồn tại"

Merge context: session.context_json + input.context (input wins on conflict)
Update session: last_active_at=NOW(), context_json=merged
Log user message
Process intent → generate answer
Log tool message (nếu có)
Log assistant message
Return output
```

---

## Context Schema

`context_json` lưu trạng thái hội thoại. Các fields được track:

```json
{
  "market_id": 1,
  "budget": 1000000000,
  "body_type": "SUV",
  "fuel_type": "Gasoline",
  "seats": 7,
  "usage_km_per_year": 15000,
  "last_searched_variants": [201, 202, 203],
  "last_compared_variants": [201, 202],
  "preferred_make": null,
  "ownership_years_preference": 5
}
```

| Field | Được set khi | Dùng cho |
|---|---|---|
| `market_id` | User đề cập thị trường / quốc gia | Price filter, TCO profile |
| `budget` | User đề cập ngân sách | Search filter |
| `body_type` | User đề cập loại xe | Search filter |
| `fuel_type` | User đề cập nhiên liệu | Search filter |
| `seats` | User đề cập số chỗ | Search filter |
| `usage_km_per_year` | User đề cập km/năm | TCO calculation |
| `last_searched_variants` | Sau khi search catalog | Compare suggestion |
| `last_compared_variants` | Sau khi compare | TCO / predict suggestion |
| `ownership_years_preference` | User đề cập số năm | TCO default |

---

## Context Merge Rules

```
merged = { ...session.context_json }

for each key in input.context:
  if input.context[key] != null:
    merged[key] = input.context[key]   // input wins
```

**Ví dụ:**
```
session.context = { market_id: 1, budget: 1000000000 }
input.context   = { budget: 800000000, fuel_type: "Electric" }

merged          = { market_id: 1, budget: 800000000, fuel_type: "Electric" }
```

Context mới nhất luôn thắng, không xóa thông tin cũ trừ khi bị override.

---

## Multi-turn Context Reuse

Khi user không cung cấp filter mới → dùng lại từ session context:

```
Turn 1: "SUV 7 chỗ dưới 1 tỷ VN"
  → session saves: { market_id:1, body_type:'SUV', seats:7, budget:1e9 }
  → last_searched_variants = [201, 202, 203]

Turn 2: "So sánh 2 xe đầu tiên"
  → intent = compare
  → variant_ids → dùng last_searched_variants[0..1] = [201, 202]
  → market_id → dùng từ session = 1
  → last_compared_variants = [201, 202]

Turn 3: "Tính TCO của xe rẻ hơn"
  → intent = tco
  → resolve "xe rẻ hơn" từ kết quả compare trước → variant_id = 202
  → market_id → từ session = 1
  → ownership_years → hỏi hoặc dùng preference
```

---

## Conversation History Format

Khi load history (Bước 1f), format để context window AI:

```
[user]: SUV 7 chỗ dưới 1 tỷ
[assistant]: Em tìm thấy 3 SUV phù hợp: (1) Toyota Fortuner... (2) Ford Everest...
[tool: compare_variants]: { "variant_ids": [201, 202], "market_id": 1 }
[assistant]: Kết quả so sánh Fortuner vs Everest: Fortuner có power cao hơn...
[user]: Tính TCO cho Fortuner
```

---

## Session Privacy Rules

- `user_id = null` → anonymous session, không liên kết user
- Không bao giờ trả `context_json` ra output API (chỉ dùng nội bộ)
- Session expire: không xóa tự động trong skill (do backend xử lý riêng)

---

## Error Cases

| Situation | Xử lý |
|---|---|
| `session_id` không tồn tại trong DB | Lỗi: `"session_id không tồn tại"` |
| `message` rỗng/null | Lỗi validation: `"message is required"` |
| DB unavailable khi INSERT session | Propagate error, không tạo session giả |
| `context_json` trong DB bị corrupt | Fallback: dùng `{}` + ghi warning vào notes |
