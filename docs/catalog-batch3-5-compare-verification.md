# Catalog Batch 3.5 Compare Verification

This document verifies that the Batch 3 catalog import is present in the database, that representative vehicles are queryable through the catalog search flow, and that Compare now resolves only DB-backed catalog variants.

## 1. Post-Batch-3 Catalog State

Verified from the local development database on `2026-04-04`:

- `car_makes = 20`
- `car_models = 57`
- `car_variants = 173`
- `variant_images = 150`
- `compare-ready variants = 168`

Representative imported vehicles confirmed in `car_variants`:

- `Chevrolet Traverse`
  - `2014 LT`
  - `2012 LS`
  - `2012 LT`
- `Chevrolet Silverado 1500`
  - `2014 LT`
  - `2013 LT`
  - `2011 LT`
- `BMW X5`
  - `2024 xDrive40i`
  - `2024 xDrive50e`
  - `2013 xDrive35i`
  - `2012 xDrive35d`
  - `2012 xDrive35i Premium`
- `Toyota Corolla`
  - `2014 LE`
  - `2013 LE`
  - `2012 LE`
- `Honda Civic`
  - `2024 e:HEV RS`
  - `2023 RS`
  - `2013 LX`
  - `2012 EX`
  - `2012 LX`
- `Nissan Leaf`
  - `2013 S`
  - `2013 SV`
  - `2012 SL`

Conclusion: the Batch 3 import is present and large enough for Compare to work with real DB-backed catalog records.

## 2. Root Cause of the Compare Mismatch

The compare mismatch was caused by two issues working together:

1. The catalog search route only matched `q` against separate columns:
   - `make`
   - `model`
   - `trim`

   It did **not** match combined phrases like:

   - `2014 Chevrolet Traverse`
   - `2014 Chevrolet Silverado 1500`
   - `2012 Honda Civic LX`

   That meant valid DB-backed vehicles could still return zero results from free-text compare resolution.

2. The compare page used free-text query resolution that was too eager and too vague:
   - it tried to auto-pick a “best” candidate from text mode
   - it did not clearly separate:
     - exact supported match
     - multiple trim matches
     - unsupported vehicle/year

This produced the confusing state where the input looked filled, but the page still could not compare reliably.

## 3. Changes Made in Batch 3.5

### Backend

Updated:

- `src/routes/catalog.routes.js`

Change:

- `q` search now matches combined strings built from:
  - `model_year`
  - `make`
  - `model`
  - `trim`
- Compare now has a closed DB-backed filter using `compareReady=true`
- only variants that satisfy the compare-ready rule are returned to Compare selectors

Current compare-ready rule:

- `body_type` exists and is not `other`
- `fuel_type` exists and is not `other`
- `transmission` exists
- and either:
  - `fuel_type = ev`
  - or the variant has both:
    - `drivetrain`
    - `engine` or `variant_specs.displacement_cc`

This allows catalog search to resolve realistic compare strings such as:

- `2014 Chevrolet Traverse`
- `2014 Chevrolet Silverado 1500`
- `2024 BMW X5 xDrive40i`
- `2012 Honda Civic LX`

### Frontend

Updated:

- `cars-com-clone/src/app/compare/page.tsx`

Changes:

- query-param compare resolution now distinguishes:
  - `exact`
  - `multiple`
  - `unsupported`
  - `empty`
- compare search panels now query only `compareReady=true`
- exact single-match queries auto-select the canonical `variant_id`
- multiple supported matches now require the user to choose the exact trim
- unsupported queries now show an honest DB-backed unsupported state
- compare search panels now show clearer helper notes:
  - supported variants found
  - choose the exact trim
  - no supported catalog variant found

## 4. Representative Query Verification

The local backend route was tested directly after the Batch 3.5 search changes.

### Exact match resolves automatically

Query:

- `2014 Chevrolet Traverse`

Result:

- `1` row
- resolved variant:
  - `variant_id=47`
  - `2014 Chevrolet Traverse LT`

Query:

- `2014 Chevrolet Silverado 1500`

Result:

- `1` row
- resolved variant:
  - `variant_id=42`
  - `2014 Chevrolet Silverado 1500 LT`

Query:

- `2024 BMW X5 xDrive40i`

Result:

- `1` row
- resolved variant:
  - `variant_id=13`
  - `2024 BMW X5 xDrive40i`

Query:

- `2012 Honda Civic LX`

Result:

- `1` row
- resolved variant:
  - `variant_id=81`
  - `2012 Honda Civic LX`

### Multiple matches now require trim disambiguation

Query:

- `2012 Chevrolet Traverse`

Result:

- `2` rows
- supported options:
  - `2012 Chevrolet Traverse LS`
  - `2012 Chevrolet Traverse LT`

Expected compare behavior now:

- do not auto-pick
- prompt the user to choose the exact trim

Query:

- `2013 Nissan Leaf`

Result:

- `2` rows
- supported options:
  - `2013 Nissan Leaf S`
  - `2013 Nissan Leaf SV`

Expected compare behavior now:

- do not auto-pick
- prompt the user to choose the exact trim

### Unsupported year/model stays unsupported honestly

Query:

- `2021 Chevrolet Traverse`

Result:

- `0` rows

Expected compare behavior now:

- show that the vehicle is not currently available as a compare-ready catalog variant
- do not pretend Compare can proceed

### Existing catalog row that is intentionally hidden from Compare

Query:

- `2013 Chevrolet Silverado 1500`

Result with `compareReady=true`:

- `0` rows

Why:

- the variant exists in `car_variants`
- but its current imported catalog row still has `fuel_type = other`
- that means it is intentionally excluded from Compare until the catalog data is compare-ready

This is the desired product behavior for a closed DB-backed compare workflow.

## 5. Compare Engine Verification

The compare engine was verified directly against real DB-backed `variant_id` pairs.

### Case A

- `2014 Chevrolet Traverse LT` (`variant_id=47`)
- `2014 Chevrolet Silverado 1500 LT` (`variant_id=42`)

Result:

- comparison returned `2` items
- structured compare completed successfully

### Case B

- `2012 Nissan Leaf SL` (`variant_id=129`)
- `2012 Honda Civic LX` (`variant_id=81`)

Result:

- comparison returned `2` items
- structured compare completed successfully

Conclusion: once the page resolves canonical `variant_id` values, the compare backend works correctly.

## 6. Entry-Point Validation

### Compare page direct selection

Validated with catalog search + exact match queries above.

Status:

- working for exact DB-backed matches
- now asks for trim selection when multiple variants exist

### Listing detail compare

Verified from:

- `cars-com-clone/src/app/listings/[id]/page.tsx`

Behavior:

- listing detail launches compare using:
  - `variantId`
  - `listingId`

This is already canonical and does not depend on vague free-text.

### Saved Cars compare

Verified from:

- `cars-com-clone/src/app/garage/page.tsx`

Behavior:

- Saved Cars launches compare using:
  - `leftListingId`
  - `rightListingId`

This remains canonical and DB-backed.

Local DB note:

- there were no current `saved_listings` rows available in the local dataset to run a live click-path test without mutating user data
- the flow remains structurally correct because it routes through listing IDs rather than text matching

## 7. Validation Summary

Required scenarios and current outcome:

1. Compare two supported variants selected from compare page
   - validated
   - exact-match queries now resolve to canonical `variant_id`
2. Compare one model with multiple trims
   - validated
   - user now gets supported trim choices instead of silent auto-pick
3. Compare from listing detail using known IDs
   - validated by code path
   - canonical `variantId` + `listingId`
4. Compare from saved cars using known IDs
   - validated by code path
   - canonical `leftListingId/rightListingId`
5. Query-param text mode with exact match
   - validated
   - example: `2014 Chevrolet Traverse`
6. Query-param text mode with multiple matches
   - validated
   - example: `2012 Chevrolet Traverse`
7. Query-param text mode with no match
   - validated
   - example: `2021 Chevrolet Traverse`

## 8. Safety Confirmation

Batch 3.5 did not modify seller-side listing data.

Still unchanged:

- `listings = 69`
- `listing_images = 231`

No seller-created listing content or listing images were modified in this batch.
