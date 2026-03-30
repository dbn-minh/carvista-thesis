# CarVista Data Pipeline

This folder separates local bootstrap data from realistic ingestion and enrichment jobs.

## Run order

1. Bootstrap local/dev data

```bash
python seed.py
```

2. Normalize aliases and build internal market features

```bash
python -m data.ingestion.refresh_intelligence_materializations
```

3. Run individual jobs when needed

```bash
python -m data.ingestion.ingest_vehicle_facts
python -m data.ingestion.ingest_market_listings
python -m data.ingestion.ingest_price_history
python -m data.ingestion.ingest_fuel_economy
python -m data.ingestion.ingest_safety_recalls
```

## What seed does now

- seeds a small canonical catalog
- seeds minimal TCO profiles/rules
- seeds a few users, listings, images, and reviews
- creates the support tables used by ingestion

It is meant for local bootstrap only, not as the truth for prediction quality.

## What ingestion does

- builds vehicle alias normalization
- materializes market-signal snapshots from real marketplace listings
- rolls up listing history into variant price history proxies
- caches official fuel-economy and recall data into source-aware tables

## Canonical vehicle layer

The existing normalized tables remain the canonical layer:

- `car_makes`
- `car_models`
- `car_variants`
- `variant_specs`
- `variant_price_history`

Support tables added by ingestion:

- `source_references`
- `vehicle_market_aliases`
- `vehicle_market_signals`
- `vehicle_fuel_economy_snapshots`
- `vehicle_recall_snapshots`
- `data_freshness_snapshots`
