# CarVista Data Ingestion Architecture

## Audit of the legacy `seed.py`

The audited legacy script at `C:/Users/nhatm/OneDrive - SYSTEMS VIET NAM/University Study/Thesis/seed.py` is useful as a bootstrap generator, but it is not suitable as the long-term data center for AI quality.

### What it seeds today

- markets
- makes, models, variants
- variant specs
- variant price history
- users
- listings and listing images
- listing price history
- viewing requests
- watchlists and saved logs
- car reviews and seller reviews
- notifications and reports

### Main realism gaps

- prices are randomized and not consistently tied to market/region realism
- listing prices and variant market history are generated independently
- provenance is missing
- no canonical alias normalization layer exists
- no persisted marketplace signal table exists
- no persisted official fuel economy or recall snapshots exist
- no freshness metadata exists
- TCO support data is fragile because the legacy script wipes `tco_profiles` and `tco_rules` before reseeding, and did not rebuild them in a durable pipeline

### Conclusion

The old script is appropriate for **local bootstrap/dev seed**, not as the production-like data source for prediction, recommendation quality, or page intelligence.

## New strategy

### 1. Bootstrap seed layer

- repo-local entrypoint: [seed.py](/C:/disk/Working/carvista/backend/seed.py)
- implementation: [data/seed/seed.py](/C:/disk/Working/carvista/backend/data/seed/seed.py)
- reference fixtures: [data/seed/seed_reference_data.py](/C:/disk/Working/carvista/backend/data/seed/seed_reference_data.py)

This layer is lightweight, deterministic, and fast. It seeds only enough catalog, users, listings, reviews, and TCO baseline data for development.

### 2. Real-data ingestion/enrichment layer

Implemented provider-based jobs:

- [data/ingestion/normalize_vehicles.py](/C:/disk/Working/carvista/backend/data/ingestion/normalize_vehicles.py)
- [data/ingestion/ingest_market_listings.py](/C:/disk/Working/carvista/backend/data/ingestion/ingest_market_listings.py)
- [data/ingestion/ingest_price_history.py](/C:/disk/Working/carvista/backend/data/ingestion/ingest_price_history.py)
- [data/ingestion/ingest_fuel_economy.py](/C:/disk/Working/carvista/backend/data/ingestion/ingest_fuel_economy.py)
- [data/ingestion/ingest_safety_recalls.py](/C:/disk/Working/carvista/backend/data/ingestion/ingest_safety_recalls.py)
- [data/ingestion/refresh_intelligence_materializations.py](/C:/disk/Working/carvista/backend/data/ingestion/refresh_intelligence_materializations.py)

Provider abstractions live in:

- [data/providers/base.py](/C:/disk/Working/carvista/backend/data/providers/base.py)
- [data/providers/vehicle_fact_provider.py](/C:/disk/Working/carvista/backend/data/providers/vehicle_fact_provider.py)
- [data/providers/marketplace_provider.py](/C:/disk/Working/carvista/backend/data/providers/marketplace_provider.py)
- [data/providers/fuel_provider.py](/C:/disk/Working/carvista/backend/data/providers/fuel_provider.py)
- [data/providers/recall_provider.py](/C:/disk/Working/carvista/backend/data/providers/recall_provider.py)

Support-table DDL is centralized in [data/common/schema.py](/C:/disk/Working/carvista/backend/data/common/schema.py).

## Canonical model

Instead of duplicating a new `canonical_vehicle` table, the refactor reuses the existing normalized schema as the canonical vehicle layer:

- `car_makes`
- `car_models`
- `car_variants`
- `variant_specs`

The ingestion layer improves this canonical layer with support tables:

- `source_references`
- `vehicle_market_aliases`
- `vehicle_market_signals`
- `vehicle_fuel_economy_snapshots`
- `vehicle_recall_snapshots`
- `data_freshness_snapshots`

## What supports each product capability

### Recommendation

- canonical vehicles from `car_makes/car_models/car_variants`
- alias normalization from `vehicle_market_aliases`
- marketplace linkability from current listings

### Prediction / valuation

- `variant_price_history`
- `vehicle_market_signals`
- current listings and listing history rollups
- official enrichment snapshots when available

### TCO

- deterministic TCO rules from `tco_profiles` and `tco_rules`
- canonical vehicle identity
- official fuel-economy snapshot when available
- fallback estimates remain clearly labeled

### Page intelligence

- recommendation links
- `vehicle_market_signals`
- `variant_price_history`
- persisted fuel-economy / recall snapshots

## Runtime wiring added in backend AI

The backend runtime now prefers persisted ingestion output before falling back to live official retrieval in:

- [src/services/ai/source_retrieval.service.js](/C:/disk/Working/carvista/backend/src/services/ai/source_retrieval.service.js)

This improves:

- vehicle name resolution through aliases
- market signal quality for prediction
- official-data freshness/caching for detail-page intelligence and TCO

## Verified vs estimated

### Verified / source-aware

- canonical vehicle identity
- internal marketplace listings
- listing-derived market snapshots
- persisted official fuel-economy snapshots
- persisted official recall snapshots
- configured TCO rules

### Estimated

- forecast confidence under thin market coverage
- depreciation path when historical depth is weak
- TCO energy or maintenance assumptions when exact values are incomplete

## Recommended operating model

For local/dev:

1. run `python seed.py`
2. run `python -m data.ingestion.refresh_intelligence_materializations`

For future production-like refresh:

- run `normalize_vehicles`
- run market/listing/history rollups on a schedule
- refresh fuel economy and recalls in smaller batches
- keep confidence low when coverage remains thin
