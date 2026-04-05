# Catalog Batch 3 Import Runbook

This batch imports the reviewed Batch 2 catalog CSV into catalog tables only, seeds deterministic placeholder `variant_images`, and prepares a natural-key image-link importer for future real variant photos.

## Scope and Safety Guardrails

This batch only writes to:

- `car_makes`
- `car_models`
- `car_variants`
- `variant_images`

This batch does **not** write to:

- `listings`
- `listing_images`

The import script fingerprints `listings` and `listing_images` before and after the catalog import. If either seller-side table changes unexpectedly, the script raises an error and the transaction rolls back.

## Files Added for Batch 3

- `scripts/catalog_batch3_import.py`
- `scripts/catalog_batch3_import_variant_images.py`
- `data/catalog_batch3_import_report.json`
- `data/catalog_batch3_import_report_initial.json`
- `data/catalog_batch3_variant_image_import_report.json`
- `data/variant_image_links.csv`
- `cars-com-clone/public/placeholders/catalog/*.svg`

## Import Source

The catalog import reads:

- `data/enriched_selected_50_models.csv`

The script imports all reviewed rows that are not `unresolved`.

## EV-Safe Import Rule

Batch 2 marked three Nissan Leaf rows as not ready because they do not have a piston-engine displacement field. Batch 3 relaxes that import gate safely:

- EV rows are allowed when they have:
  - `fuel_type = Electric`
  - `body_type_normalized`
  - `transmission_normalized` or `transmission_detail`
  - non-`unresolved` enrichment confidence

They are **not** blocked only because `engine` or `engine_displacement_cc` is null.

Imported under this EV-safe rule:

- `Nissan Leaf 2012 SL`
- `Nissan Leaf 2013 SV`
- `Nissan Leaf 2013 S`

## Placeholder Variant Image Strategy

Placeholder images are stored in `variant_images` only.

The import never creates placeholder records in `listing_images`.

Placeholder paths are deterministic local assets served by the frontend:

- `/placeholders/catalog/sedan.svg`
- `/placeholders/catalog/suv.svg`
- `/placeholders/catalog/hatchback.svg`
- `/placeholders/catalog/pickup.svg`
- `/placeholders/catalog/mpv.svg`
- `/placeholders/catalog/wagon.svg`
- `/placeholders/catalog/coupe.svg`
- `/placeholders/catalog/convertible.svg`
- `/placeholders/catalog/van.svg`
- `/placeholders/catalog/ev.svg`
- `/placeholders/catalog/generic.svg`

Selection rules:

- EV rows use `/placeholders/catalog/ev.svg`
- otherwise the placeholder is chosen from normalized body type
- if a variant already has any `variant_images`, the script does not insert another placeholder

## Real Variant Image Link Importer

Use `scripts/catalog_batch3_import_variant_images.py` later when real image URLs are available.

Expected CSV columns:

- `make_name`
- `model_name`
- `model_year`
- `trim_name`
- `image_url`
- `sort_order`

Natural-key resolution:

- `car_makes.name`
- `car_models.name`
- `car_variants.model_year`
- `car_variants.trim_name`

The importer only touches `variant_images`.

Behavior:

- if the exact URL already exists for the variant, it keeps the row and updates `sort_order` if needed
- if a placeholder exists at the requested `sort_order`, it replaces that placeholder URL with the real URL
- otherwise it inserts a new `variant_images` row

It never writes to `listing_images`.

## How To Run

### Remote Aiven / production-like catalog import

The Batch 3 Python scripts now support:

- split DB env vars (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
- or a single `DATABASE_URL`
- optional SSL envs for managed MySQL providers such as Aiven

Recommended Aiven setup in PowerShell:

```powershell
$env:DB_HOST="mysql-320288b-carvista.b.aivencloud.com"
$env:DB_PORT="13986"
$env:DB_NAME="defaultdb"
$env:DB_USER="avnadmin"
$env:DB_PASSWORD="<YOUR_PASSWORD>"
$env:DB_SSL="true"
$env:DB_SSL_CA_PATH="C:\path\to\aiven-ca.pem"
```

Alternative using the service URI directly:

```powershell
$env:DATABASE_URL="mysql://avnadmin:<YOUR_PASSWORD>@mysql-320288b-carvista.b.aivencloud.com:13986/defaultdb?ssl-mode=REQUIRED"
$env:DB_SSL_CA_PATH="C:\path\to\aiven-ca.pem"
```

Notes:

- For Aiven, SSL should stay enabled.
- Download the CA certificate from the Aiven service page and point `DB_SSL_CA_PATH` at the downloaded `.pem` file.
- The import scripts only write to catalog tables and still leave `listings` and `listing_images` untouched.

### 1. Catalog import

```powershell
python scripts/catalog_batch3_import.py
```

Optional custom output path:

```powershell
python scripts/catalog_batch3_import.py --report data/catalog_batch3_import_report.json
```

### 2. Real variant image link import later

Fill `data/variant_image_links.csv`, then run:

```powershell
python scripts/catalog_batch3_import_variant_images.py --csv data/variant_image_links.csv
```

## Actual Batch 3 Result

The catalog import was run successfully once, then rerun to verify idempotency.

### First import result

- inserted makes: `10`
- inserted models: `45`
- inserted variants: `150`
- placeholder variant images created: `150`
- imported reviewed rows: `150`
- skipped rows: `0`

### Confidence rows imported

Imported with `medium` confidence:

- `Ford F-150 2013 XLT`
- `Ford F-150 2011 XLT`
- `Ford F-150 2014 XLT`
- `Mercedes-Benz M-Class 2011 ML350 4MATIC`
- `Mercedes-Benz M-Class 2006 ML350`

Imported with `low` confidence:

- `Ram 1500 2012 ST`

These rows were not discarded because they were reviewed and were not `unresolved`. Their confidence and notes are preserved in the JSON report.

### Final table counts after import

- `car_makes = 20`
- `car_models = 57`
- `car_variants = 173`
- `variant_images = 150`
- `listings = 69`
- `listing_images = 231`

### Idempotency rerun

The import was run a second time and produced:

- inserted makes: `0`
- inserted models: `0`
- inserted variants: `0`
- updated variants: `0`
- placeholder images created: `0`

That rerun confirms the script is idempotent for the current dataset.

## Compare Gating

Compare is now limited to DB-backed catalog variants.

Behavior changes:

- frontend compare selection resolves only through `car_variants`
- unresolved query/listing inputs show a clear “catalog-backed vehicles only” state
- backend `/ai/compare` now returns a safe not-found error when one or more `variant_ids` are missing from `car_variants`

This prevents compare flows from pretending to support vehicles that are not actually present in the catalog database.

## Reports To Review

- `data/catalog_batch3_import_report.json`
- `data/catalog_batch3_import_report_initial.json`
- `data/catalog_batch3_import_report_rerun.json`
- `data/catalog_batch3_variant_image_import_report.json`

These files capture:

- imported counts
- medium/low confidence rows
- EV-rule rows
- skipped rows
- final table counts
