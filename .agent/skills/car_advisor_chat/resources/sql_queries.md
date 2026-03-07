# SQL Queries — car_advisor_chat Skill

Toàn bộ SQL được dùng trong skill, tổ chức theo bước.

---

## Session Operations (Bước 1)

### Tạo session mới

```sql
INSERT INTO ai_chat_sessions (user_id, last_active_at, context_json)
VALUES (:user_id, NOW(), :context_json);
-- Lấy: LAST_INSERT_ID() → session_id mới
```

`context_json` là JSON string của object context đã merge.
`user_id` có thể là NULL (anonymous session).

### Load session hiện có

```sql
SELECT session_id, user_id, context_json, last_active_at
FROM ai_chat_sessions
WHERE session_id = :session_id;
```

### Update session context & last_active

```sql
UPDATE ai_chat_sessions
SET last_active_at = NOW(),
    context_json = :merged_context_json
WHERE session_id = :session_id;
```

### Log user message

```sql
INSERT INTO ai_chat_messages (session_id, role, content, created_at)
VALUES (:session_id, 'user', :message, NOW());
```

### Load conversation history (10 turns gần nhất)

```sql
SELECT role, content, tool_name, tool_payload, created_at
FROM ai_chat_messages
WHERE session_id = :session_id
ORDER BY created_at DESC
LIMIT 20;
-- Reverse order in application code for chronological display
```

### Log tool call

```sql
INSERT INTO ai_chat_messages
  (session_id, role, tool_name, tool_payload, content, created_at)
VALUES
  (:session_id, 'tool', :tool_name, :tool_payload_json, NULL, NOW());
```

`tool_payload_json` = JSON string của payload đã gửi cho skill con.

### Log assistant response

```sql
INSERT INTO ai_chat_messages (session_id, role, content, created_at)
VALUES (:session_id, 'assistant', :answer, NOW());
```

---

## Entity Resolution (Bước 3)

### Tìm variant_id từ tên xe

```sql
SELECT
  v.variant_id,
  v.model_year,
  v.trim_name,
  mo.name AS model_name,
  mk.name AS make_name,
  v.body_type,
  v.fuel_type
FROM car_variants v
JOIN car_models mo ON mo.model_id = v.model_id
JOIN car_makes  mk ON mk.make_id  = mo.make_id
WHERE (
    mk.name LIKE CONCAT('%', :make_keyword, '%')
    OR mo.name LIKE CONCAT('%', :model_keyword, '%')
  )
  AND (:year IS NULL OR v.model_year = :year)
ORDER BY v.model_year DESC, v.variant_id ASC
LIMIT 5;
```

**Parsing keywords từ text:**
- "Toyota Camry 2024" → make_keyword='Toyota', model_keyword='Camry', year=2024
- "Camry 2.5Q" → model_keyword='Camry', keyword có thể match trim_name
- "Accord" → model_keyword='Accord', year=NULL

---

## Catalog Search (Bước 4a)

### Search cơ bản (không có market price filter)

```sql
SELECT
  v.variant_id,
  mk.name   AS make,
  mo.name   AS model,
  v.model_year,
  v.trim_name,
  v.body_type,
  v.fuel_type,
  v.seats,
  v.msrp_base,
  vs.power_hp,
  vs.torque_nm,
  ROUND(AVG(cr.rating), 1) AS avg_rating,
  COUNT(cr.car_review_id)  AS review_count
FROM car_variants v
JOIN car_models mo ON mo.model_id = v.model_id
JOIN car_makes  mk ON mk.make_id  = mo.make_id
LEFT JOIN variant_specs vs ON vs.variant_id = v.variant_id
LEFT JOIN car_reviews cr   ON cr.variant_id  = v.variant_id
WHERE 1=1
  AND (:body_type   IS NULL OR v.body_type = :body_type)
  AND (:fuel_type   IS NULL OR v.fuel_type = :fuel_type)
  AND (:min_seats   IS NULL OR v.seats >= :min_seats)
  AND (:budget_max  IS NULL OR v.msrp_base <= :budget_max)
GROUP BY v.variant_id, mk.name, mo.name, v.model_year, v.trim_name,
         v.body_type, v.fuel_type, v.seats, v.msrp_base, vs.power_hp, vs.torque_nm
ORDER BY avg_rating DESC, v.msrp_base ASC
LIMIT 5;
```

### Search có market price filter

```sql
SELECT
  v.variant_id,
  mk.name AS make, mo.name AS model,
  v.model_year, v.trim_name, v.body_type, v.fuel_type, v.seats, v.msrp_base,
  vs.power_hp, vs.torque_nm,
  ROUND(AVG(cr.rating), 1) AS avg_rating,
  COUNT(cr.car_review_id)  AS review_count,
  lp.market_price
FROM car_variants v
JOIN car_models mo ON mo.model_id = v.model_id
JOIN car_makes  mk ON mk.make_id  = mo.make_id
LEFT JOIN variant_specs vs ON vs.variant_id = v.variant_id
LEFT JOIN car_reviews cr   ON cr.variant_id  = v.variant_id
LEFT JOIN (
  SELECT vph.variant_id, vph.price AS market_price
  FROM variant_price_history vph
  INNER JOIN (
    SELECT variant_id, MAX(captured_at) AS max_ts
    FROM variant_price_history
    WHERE market_id = :market_id AND price_type = 'avg_market'
    GROUP BY variant_id
  ) latest ON latest.variant_id = vph.variant_id AND latest.max_ts = vph.captured_at
  WHERE vph.market_id = :market_id AND vph.price_type = 'avg_market'
) lp ON lp.variant_id = v.variant_id
WHERE 1=1
  AND (:body_type IS NULL OR v.body_type = :body_type)
  AND (:fuel_type IS NULL OR v.fuel_type = :fuel_type)
  AND (:min_seats IS NULL OR v.seats >= :min_seats)
  AND (
    :budget_max IS NULL
    OR COALESCE(lp.market_price, v.msrp_base) <= :budget_max
  )
GROUP BY v.variant_id, mk.name, mo.name, v.model_year, v.trim_name,
         v.body_type, v.fuel_type, v.seats, v.msrp_base, vs.power_hp, vs.torque_nm, lp.market_price
ORDER BY avg_rating DESC, COALESCE(lp.market_price, v.msrp_base) ASC
LIMIT 5;
```

---

## TCO Profile Lookup (Bước 4d)

```sql
SELECT profile_id, name
FROM tco_profiles
WHERE market_id = :market_id
ORDER BY profile_id ASC
LIMIT 1;
```

Nếu có nhiều profiles cho cùng market → lấy profile_id nhỏ nhất (default profile).
Nếu không có → trả `profile_id = null`, hỏi user chỉ định.
