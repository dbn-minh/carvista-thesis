# SQL Queries — calculate_tco Skill

Các câu SQL chuẩn dùng trong skill. Không được sửa logic — chỉ thay thế `:params`.

---

## Query 1: Load Profile + Market

```sql
SELECT
  p.profile_id,
  p.market_id,
  p.name         AS profile_name,
  m.name         AS market_name,
  m.currency_code
FROM tco_profiles p
JOIN markets m ON m.market_id = p.market_id
WHERE p.profile_id = :profile_id;
```

**Params:**
- `:profile_id` — INT, bắt buộc

**Expected:** 1 row. Nếu 0 row → báo lỗi `"profile_id không tồn tại"`.

---

## Query 2: Load Rules (có dedup built-in)

```sql
SELECT
  cost_type,
  rule_kind,
  rate,
  fixed_amount,
  formula_json,
  applies_to,
  created_at
FROM tco_rules
WHERE profile_id = :profile_id
ORDER BY cost_type, created_at DESC;
```

**Params:**
- `:profile_id` — INT, bắt buộc

**Dedup logic (ở application layer):**
```
Nhóm theo cost_type → lấy row đầu tiên (= created_at mới nhất)
```

**Với Sequelize:**
```javascript
const rules = await TcoRule.findAll({
  where: { profile_id },
  order: [['cost_type', 'ASC'], ['created_at', 'DESC']],
  raw: true
});

// Dedup: lấy row mới nhất mỗi cost_type
const dedupedRules = {};
for (const rule of rules) {
  if (!dedupedRules[rule.cost_type]) {
    dedupedRules[rule.cost_type] = rule;
  }
}
```

---

## Query 3: (Optional) Check profile existence

```sql
SELECT COUNT(*) AS cnt
FROM tco_profiles
WHERE profile_id = :profile_id;
```

Dùng để validate trước khi chạy Query 1 nếu cần.

---

## Notes

- Tất cả query đều dùng parameterized placeholders (`:profile_id`) — KHÔNG string concatenate
- `formula_json` trả về dạng JSON object từ MySQL — parse tự động qua Sequelize
- `rate` và `fixed_amount` có thể là `NULL` — xử lý null ở application layer
