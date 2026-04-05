# Catalog Batch 1 Analysis

## Scope

This document profiles `car_prices.csv` only. It does not import anything into the CarVista database and it does not modify any existing listings or catalog tables.

## Dataset Overview

- Total rows: **558,837**
- Total columns: **16**
- Columns: year, make, model, trim, body, transmission, vin, state, condition, odometer, color, interior, seller, mmr, sellingprice, saledate
- Year range: **1982** to **2015**

## Missingness by Column

| column | missing_count | missing_pct |
| --- | --- | --- |
| transmission | 65,352 | 11.69% |
| body | 13,195 | 2.36% |
| condition | 11,820 | 2.12% |
| trim | 10,651 | 1.91% |
| model | 10,399 | 1.86% |
| make | 10,301 | 1.84% |
| color | 749 | 0.13% |
| interior | 749 | 0.13% |
| odometer | 94 | 0.02% |
| mmr | 38 | 0.01% |
| sellingprice | 12 | 0.00% |
| saledate | 12 | 0.00% |
| vin | 4 | 0.00% |
| year | 0 | 0.00% |
| state | 0 | 0.00% |
| seller | 0 | 0.00% |

## High-Level Cardinality

| combination | unique_count |
| --- | --- |
| make + model | 1,019 |
| make + model + year | 5,576 |
| make + model + year + trim | 12,952 |
| normalized candidate variants kept for review | 10,500 |

## Top Raw Values

### Make

| make | count |
| --- | --- |
| Ford | 93,554 |
| Chevrolet | 60,197 |
| Nissan | 53,946 |
| Toyota | 39,871 |
| Dodge | 30,710 |
| Honda | 27,206 |
| Hyundai | 21,816 |
| BMW | 20,719 |
| Kia | 18,077 |
| Chrysler | 17,276 |
| Mercedes-Benz | 17,141 |
| Jeep | 15,372 |
| Infiniti | 15,305 |
| Volkswagen | 12,581 |
| Lexus | 11,861 |

### Model

| model | count |
| --- | --- |
| Altima | 19,349 |
| F-150 | 14,479 |
| Fusion | 12,946 |
| Camry | 12,545 |
| Escape | 11,861 |
| <NA> | 10,399 |
| Focus | 10,394 |
| Accord | 9,127 |
| 3 Series | 8,204 |
| Grand Caravan | 7,941 |
| Impala | 7,923 |
| Explorer | 7,707 |
| Civic | 7,433 |
| G Sedan | 7,417 |
| Corolla | 7,354 |

### Body

| body | count |
| --- | --- |
| Sedan | 199,437 |
| SUV | 119,292 |
| sedan | 41,906 |
| suv | 24,552 |
| Hatchback | 21,380 |
| Minivan | 21,363 |
| Coupe | 14,602 |
| Wagon | 13,630 |
| Crew Cab | 13,280 |
| <NA> | 13,195 |
| Convertible | 8,652 |
| SuperCrew | 7,423 |
| G Sedan | 5,999 |
| hatchback | 4,857 |
| SuperCab | 4,449 |

### Transmission

| transmission | count |
| --- | --- |
| automatic | 475,915 |
| <NA> | 65,352 |
| manual | 17,544 |
| sedan | 15 |
| Sedan | 11 |

## Duplicate Patterns

- Full-row duplicates: **0**
- Duplicate VIN rows (same VIN appears more than once): **8,536**
- Duplicate transactional rows on `year + make + model + trim + body + transmission`: **519,137**

Practical interpretation:

- The CSV is best treated as repeated used-car transactions, not as one row per catalog variant.
- Variant deduplication is therefore required before any future catalog import.

## Major Data Quality Issues

- `body` has 87 non-null raw labels, including model-specific labels like `G Sedan`, pickup cab labels, and casing variants.
- `transmission` is mostly usable (`automatic` / `manual`), but 26 rows are clearly shifted and contain body labels instead.
- 10,399 rows are missing at least one core identity field (`make`, `model`, or `year`).
- 2,511 normalized make/model/year/trim groups were left out of the candidate seed because they have fewer than 3 source rows.
- 22 rows have malformed VIN values, all caused by a column-shift pattern where `vin` became `automatic`.
- This is transaction data, not a clean OEM catalog. Duplicate patterns at the make/model/year/trim level are expected because many rows represent repeated sales of the same variant.

## Practical Takeaway

The dataset is strong enough for a first-pass catalog seed around make/model/year/trim plus body, transmission, and a provisional price signal. It is not sufficient for compare-ready specs without a second enrichment batch because it does not provide structured fields such as engine, drivetrain, fuel type, seating, or doors.
