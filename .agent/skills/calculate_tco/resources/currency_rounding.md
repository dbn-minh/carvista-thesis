# Currency Rounding Rules

Bảng quy tắc làm tròn số theo `currency_code` từ bảng `markets`.

---

## Quy tắc làm tròn

| currency_code | Độ chính xác | Ví dụ input | Ví dụ output |
|---|---|---|---|
| `VND` | Làm tròn đến 1,000 | 125,567,450 | 125,567,000 |
| `USD` | 2 chữ số thập phân | 1234.5678 | 1,234.57 |
| `EUR` | 2 chữ số thập phân | 1234.5678 | 1,234.57 |
| `GBP` | 2 chữ số thập phân | 1234.5678 | 1,234.57 |
| `JPY` | 0 chữ số thập phân | 12345.67 | 12,346 |
| Khác | 2 chữ số thập phân | 1234.5678 | 1,234.57 |

---

## Currency Symbol Mapping (Deterministic)

| currency_code | symbol |
|---|---|
| VND | ₫ |
| USD | $ |
| EUR | € |
| GBP | £ |
| JPY | ¥ |
| KRW | ₩ |
| THB | ฿ |
| SGD | S$ |
| Khác | currency_code (plain text) |

---

## Quy tắc áp dụng

1. **Làm tròn sau khi tính xong** — không làm tròn trung gian (tránh lỗi tích lũy)
2. **Làm tròn tất cả cost fields** trong `costs`, `yearly_breakdown`, `total_cost`, `yearly_cost_avg`, `base_price`
3. **KHÔNG convert tỷ giá** — output giữ nguyên currency của `markets.currency_code`
4. **VND rounding:** Dùng `Math.round(value / 1000) * 1000`
5. **JPY rounding:** Dùng `Math.round(value)`
6. **USD/EUR/GBP rounding:** Dùng `Math.round(value * 100) / 100`

---

## Ví dụ VND

```
Input cost:  125,567,450 ₫
Step 1: 125,567,450 / 1000 = 125,567.45
Step 2: round(125,567.45) = 125,567
Step 3: 125,567 × 1000   = 125,567,000 ₫
Output: 125,567,000 ₫
```

## Ví dụ USD

```
Input cost:  6,254.064
Step 1: 6,254.064 × 100 = 625,406.4
Step 2: round(625,406.4) = 625,406
Step 3: 625,406 / 100   = 6,254.06
Output: $6,254.06
```
