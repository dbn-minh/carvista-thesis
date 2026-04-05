# Catalog Batch 2 Enrichment

## Scope

Batch 2 enriched the curated 150 selected variants from Batch 1 **offline only**. No database tables were modified and no import script was run.

## Structured External Sources Used

- NHTSA vPIC VIN Decode API: https://vpic.nhtsa.dot.gov/api/
- EPA FuelEconomy.gov vehicle web services / downloadable vehicle dataset: https://www.fueleconomy.gov/feg/ws/

## What Each Source Contributed

- **NHTSA vPIC**: fuel type, engine displacement, cylinders, horsepower, drivetrain, doors, body class, transmission style when available.
- **EPA FuelEconomy**: city/highway/combined MPG, drive cross-check, transmission detail cross-check, fuel cross-check, vehicle class refinement.

## Matching Logic

1. Load the 150 `selection_status=selected` rows from Batch 1.
2. Decode each `source_vin_sample` with NHTSA vPIC using the selected `model_year`.
3. Download the official EPA vehicle dataset and filter it to the selected years and makes.
4. Score EPA candidates using year, make, model/base model similarity, engine displacement, cylinders, drivetrain, transmission, and fuel alignment.
5. Keep the EPA match only when the score is strong enough and clearly ahead of alternative candidates.

## Confidence Rules

- `high`: VIN decode aligns on make/year/model family and EPA has a clear structured match.
- `medium`: VIN decode aligns on make/year and mostly aligns on model family, but trim/package ambiguity remains.
- `low`: only partial structured alignment exists; usable for review, not safe for automatic import.
- `unresolved`: no safe structured match for compare-relevant fields.

## Output Summary

- Total enriched rows: **150**
- Ready for import (offline assessment only): **147**
- Unresolved rows: **0**
- Confidence counts: high=144, medium=5, low=1, unresolved=0
- Status counts: enriched=146, partial=4, unresolved=0

## Source Mix

| source_used | count |
| --- | --- |
| NHTSA vPIC VIN decode; EPA FuelEconomy vehicles.csv | 150 |

## What Still Remains For Batch 3 Or Later

- Manual review on low-confidence rows where trim naming differs between the CSV and VIN decode.
- Seats remain unresolved on all 150 selected rows because the structured VIN sample did not expose them reliably enough to fill automatically.
- Some premium and truck variants still need human confirmation before any future import because multiple EPA records remain close on engine/package details.
- The Nissan Leaf rows stay `ready_for_import=false` under the current rule because official structured sources did not provide a piston-engine-style displacement field.
- Real images are still outside this batch.
