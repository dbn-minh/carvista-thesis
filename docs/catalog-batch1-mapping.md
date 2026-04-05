# Catalog Batch 1 Mapping

## Batch Intent

This mapping is only for a future **catalog-only** import into `car_makes`, `car_models`, `car_variants`, and `variant_images`. Batch 1 does not touch the database.

## Field Mapping Summary

| destination_table | target_field | csv_source | batch_1_rule |
| --- | --- | --- | --- |
| car_makes | name | make | Trim whitespace, preserve the representative raw display form, and generate `make_name_normalized` for stable matching. |
| car_models | name | model | Trim whitespace, preserve the representative raw display form, and generate `model_name_normalized` for stable matching under a make. |
| car_models | segment | body (indirect) | Not populated in Batch 1. Body data is too noisy for a clean model-level segment assignment without a later enrichment step. |
| car_variants | model_year | year | Direct integer mapping after validating the year range. |
| car_variants | trim_name | trim | Normalize casing, whitespace, and punctuation. Missing trim becomes `Base / Unspecified` in the intermediate seed. |
| car_variants | body_type | body | Map noisy body labels into the existing enum (`sedan`, `hatchback`, `suv`, `cuv`, `mpv`, `pickup`, `coupe`, `convertible`, `wagon`, `van`, `other`). |
| car_variants | transmission | transmission | Map to a clean user-facing label (`Automatic`, `Manual`, `CVT`, etc.). Contaminated values that are actually body labels are cleared. |
| car_variants | msrp_base | mmr / sellingprice | Use the median non-null `mmr` for the normalized variant group. If `mmr` is missing, fall back to the median non-null `sellingprice`. This is a market-price proxy, not a true OEM MSRP. |
| variant_images | url | none | No real image field exists in the CSV. Batch 1 only assigns a deterministic placeholder path for later review. |

## Fields That Map Directly

- `year` -> `car_variants.model_year`
- `make` -> `car_makes.name` after simple cleanup
- `model` -> `car_models.name` after simple cleanup
- `trim` -> `car_variants.trim_name` after normalization

## Fields That Need Normalization Before Any Future Import

- `body` needs normalization because the CSV mixes real body styles with pickup cab labels, model-specific labels (`G Sedan`, `Koup`), and a few shifted values.
- `transmission` is simple overall but contains a small number of contaminated rows where body labels were shifted into the transmission column.
- `trim` needs punctuation and whitespace cleanup, plus a default placeholder when missing.
- `make` and `model` need stable normalized keys so later imports do not create duplicate makes/models because of casing or punctuation differences.

## Fields Missing From the CSV (Batch 2 Enrichment Needed)

- `engine`
- `drivetrain`
- `fuel_type`
- `seats`
- `doors`
- Any compare-ready spec fields such as dimensions, cargo space, horsepower, torque, and efficiency

These fields should remain empty or flagged for enrichment in any later catalog import batch. Batch 1 does not invent them.

## Fields That Should Not Be Used For Catalog Seeding

- `vin`: identifies a sold unit, not a reusable catalog variant
- `state`: transaction location, not a catalog attribute
- `condition`: auction/sale condition, not a stable catalog field
- `odometer`: unit-specific usage, not a catalog field
- `color` and `interior`: sale-unit attributes, too noisy for a base catalog seed
- `seller`: transaction source, not a catalog attribute
- `saledate`: transactional timestamp, not a catalog attribute

## Variant Images Strategy For Batch 1

Because the CSV has no trustworthy image field, the intermediate seed includes `placeholder_image_url` only. The placeholder path is deterministic by normalized body type so a later batch can choose whether to keep placeholders, replace them with static local assets, or leave `variant_images` empty until real images are sourced.
