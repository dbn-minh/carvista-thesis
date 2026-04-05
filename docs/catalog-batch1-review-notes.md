# Catalog Batch 1 Review Notes

## What Batch 1 Safely Did

- Read and profiled the uploaded CSV only.
- Normalized make/model/year/trim/body/transmission into a deduplicated intermediate seed file.
- Selected a curated first-wave set of 50 vehicle models for human review.
- Left all catalog enrichment gaps explicit instead of inventing missing specs.

## Top Normalization Decisions

- Missing `trim` values are preserved as `Base / Unspecified` instead of being dropped entirely.
- Pickup body labels such as `Crew Cab`, `SuperCrew`, `King Cab`, and `Double Cab` are normalized to `pickup`.
- `Minivan` is normalized to `mpv`, while cargo/passenger van labels such as `E-Series Van` and `Transit Van` stay as `van`.
- Model-specific body labels such as `G Sedan`, `G Coupe`, `Koup`, and `TSX Sport Wagon` are normalized to their closest schema-safe body types.
- Rows where `transmission` contains a body label and `body` contains a clear spillover value are repaired conservatively by moving the body label back into the body field and blanking transmission.

## Ambiguous Cases That Still Need Human Review

- `SUV` vs `CUV` cannot be separated reliably from this CSV alone, so most utility vehicles remain normalized as `suv` unless the raw body explicitly says `cuv` or `crossover`.
- The dataset has no direct `fuel_type`; electrified models can be recognized by model names, but the structured field should still be filled only in a later enrichment batch.
- A small number of model-specific body labels may hide trim/package information rather than clean body style. They were normalized for safety, but high-priority models should still be spot-checked before import.
- `msrp_base_candidate` is a market-price proxy from used-car transactions, not a true MSRP. It is useful for seed review, not for final pricing truth.

## Examples Excluded From the Batch 1 Candidate Seed

| make_name | model_name | model_year | trim_name | source_row_count | why_excluded |
| --- | --- | --- | --- | --- | --- |
| Acura | CL | 2002 | 3.2 Type-S | 2 | Fewer than 3 source rows after normalization. |
| Acura | CL | 1997 | 2.2 | 2 | Fewer than 3 source rows after normalization. |
| Acura | Integra | 1998 | LS | 2 | Fewer than 3 source rows after normalization. |
| Acura | Legend | 1995 | L | 2 | Fewer than 3 source rows after normalization. |
| Acura | Legend | 1994 | L | 2 | Fewer than 3 source rows after normalization. |
| Acura | MDX | 2014 | Technology and Entertainment Packages | 2 | Fewer than 3 source rows after normalization. |
| Acura | MDX | 2012 | Advance and Entertainment Packages | 2 | Fewer than 3 source rows after normalization. |
| Acura | RL | 1997 | 3.5 | 2 | Fewer than 3 source rows after normalization. |
| Acura | RLX | 2014 | Advance Package | 2 | Fewer than 3 source rows after normalization. |
| Acura | TL | 2014 | Special Edition | 2 | Fewer than 3 source rows after normalization. |
| Acura | TL | 1998 | 3.2 | 2 | Fewer than 3 source rows after normalization. |
| Acura | TSX Sport Wagon | 2013 | Technology Package | 2 | Fewer than 3 source rows after normalization. |

Additional exclusion summary: 2,511 normalized groups were excluded for having fewer than 3 source rows, and 10,399 raw rows were excluded before grouping because they were missing make/model/year identity.

## First-Wave Selected Models (Sample Reasons)

| make_name | model_name | selection_reason |
| --- | --- | --- |
| Audi | A4 | Premium compact sedan alternative with clear user-facing recognition. |
| BMW | 3 Series | Premium sport sedan anchor with strong volume for later compare use cases. |
| BMW | X3 | Premium compact SUV with good compare potential. |
| BMW | X5 | Premium midsize SUV anchor with strong row volume. |
| Chevrolet | Cruze | Mainstream compact option with usable pricing coverage and trim spread. |
| Chevrolet | Equinox | Compact SUV value option with usable data quality. |
| Chevrolet | Silverado 1500 | High-volume pickup that adds truck compare coverage. |
| Chevrolet | Traverse | Three-row family SUV with practical compare value. |
| Chevrolet | Volt | Electrified model with recognizable identity and enough signal for later enrichment. |
| Dodge | Grand Caravan | High-volume minivan benchmark with strong later compare value. |
| Ford | Escape | Mainstream compact SUV with good pricing coverage. |
| Ford | Explorer | Large family SUV with strong row volume and recognizable buyer use case. |
| Ford | F-150 | Full-size pickup benchmark with strong row count and trim spread. |
| Ford | Focus | Popular compact with enough volume to support 1-3 representative variants. |
| Ford | Fusion | High-volume sedan with strong pricing signal and representative trims. |

## Batch 2 Enrichment Needs

- Structured powertrain details (`engine`, `drivetrain`, `fuel_type`)
- Cabin configuration (`seats`, `doors`)
- Compare-ready specs (`horsepower`, `torque`, dimensions, cargo space, efficiency)
- Real model/variant images if the future catalog import should populate `variant_images` with more than deterministic placeholders

## Risks and Caveats

- This source is strongest for identifying popular market variants, not for building a complete OEM-grade spec catalog.
- A future import batch should stay catalog-only and continue to avoid existing listing/listing image tables.
- Before any import, the selected 50-model set should be spot-checked by a human for trim deduplication, especially on premium and pickup models where package naming can be noisy.
