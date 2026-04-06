# Local Marketplace Expansion Runbook

This local-only batch expands the CarVista development database in three additive ways:

1. add curated exotic/performance catalog variants and showcase listings
2. add five years of monthly variant market history for charting and prediction
3. add one realistic active listing for each high-quality variant that currently has no marketplace listing
4. normalize active seeded marketplace listings to Vietnam-only locations and more realistic tier-aware pricing

## Safety scope

These scripts are local-only and additive:

- they insert into `car_makes`, `car_models`, `car_variants`, `variant_specs`, `variant_images`, `listings`, and `variant_price_history`
- they do **not** delete from any table
- they do **not** modify `listing_images`
- they do **not** remove or overwrite existing catalog variants

`listing_images` row count remained `231` before and after this batch.

## Scripts

- `scripts/seed_exotic_catalog_and_listings.py`
- `scripts/seed_variant_price_history.py`
- `scripts/seed_additional_listings.py`
- `scripts/normalize_local_marketplace_inventory.py`

## Recommended run order

```powershell
python scripts/seed_exotic_catalog_and_listings.py
python scripts/seed_variant_price_history.py
python scripts/seed_additional_listings.py
python scripts/normalize_local_marketplace_inventory.py
```

## What each script does

### 1. Exotic catalog + showcase listings

Adds a curated performance/exotic set:

- Ferrari 488 GTB
- Ferrari F8 Tributo
- Lamborghini Huracan EVO
- Lamborghini Urus S
- McLaren 720S
- Porsche 911 Carrera S
- Porsche 911 Turbo S
- Audi R8 V10 Performance quattro
- Mercedes-Benz AMG GT R
- BMW M4 Competition xDrive
- Nissan GT-R Premium
- Chevrolet Corvette Z06
- Aston Martin Vantage Coupe
- Lexus LC 500

It also inserts a placeholder `variant_images` row when the new variant has no image yet, and creates one showcase active listing per added variant.

### 2. Variant price history

Seeds `variant_price_history` with:

- `61` monthly `avg_market` points per market
- `market_id = 1` (Vietnam / VND)
- `market_id = 2` (United States / USD)
- source tag: `local_seed_history_v1`

Generation logic is deterministic and tries to stay believable:

- current market value is derived from MSRP plus age/body/fuel/performance retention rules
- the past 5 years trend higher than today using age-aware depreciation
- EVs decay a bit faster
- SUVs/pickups/MPVs hold value slightly better
- exotics/performance cars hold value a bit better and use a slightly wider volatility band
- a mild 2022-2023 market tightness bump is added so the line is not unnaturally flat

### 3. Additional listings

Creates one active listing for each variant that:

- has no existing listing
- has a non-`other` body type
- has a non-`other` fuel type
- has a usable transmission value

Listings are deterministic and vary by:

- owner (dealer-style demo owners 1-10 or private owners 11-20)
- location
- mileage
- asking price
- description copy

### 4. Marketplace normalization

Normalizes active generated inventory without deleting or recreating listings:

- reprices seeded inventory using segment-aware VND pricing tiers
- forces active seeded listings onto curated Vietnam-only city labels
- skips structured user-authored listings that include fields such as `Condition:` or `Contact preference:`

Pricing rules now separate:

- mainstream
- premium
- performance
- exotic

This is important because local catalog `msrp_base` values often came from Batch 1/2 market medians, not always true OEM MSRP. Premium/performance pricing therefore uses a tier-aware fallback floor and anchor uplift so older BMW / Mercedes-Benz / Audi / Lexus stock does not look implausibly cheap in the marketplace.

## Result after running this batch locally

Before:

- `car_makes = 20`
- `car_models = 57`
- `car_variants = 173`
- `variant_images = 150`
- `listings = 69`
- `listing_images = 231`
- `variant_price_history = 227`

After:

- `car_makes = 25`
- `car_models = 70`
- `car_variants = 187`
- `variant_images = 164`
- `listings = 228`
- `listing_images = 231`
- `variant_price_history = 23041`

History coverage after seeding:

- variants with at least 5 years of market-1 history: `187`
- variants with at least 5 years of market-2 history: `187`

## Reports

Each script writes a JSON report under `data/`:

- `data/local_seed_exotic_catalog_report.json`
- `data/local_seed_variant_price_history_report.json`
- `data/local_seed_additional_listings_report.json`

Idempotence checks were also rerun and saved as:

- `data/local_seed_exotic_catalog_report_rerun.json`
- `data/local_seed_variant_price_history_report_rerun.json`
- `data/local_seed_additional_listings_report_rerun.json`

## Notes

- No real images were sourced in this batch.
- Placeholder-only variant imagery remains in `variant_images`.
- No schema migration was required for this batch.
