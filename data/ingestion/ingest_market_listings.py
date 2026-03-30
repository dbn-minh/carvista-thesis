from datetime import UTC, datetime

from data.common.db import db_cursor
from data.common.schema import ensure_support_tables
from data.ingestion.helpers import fetch_market_map, insert_source_reference, upsert_freshness_snapshot
from data.providers.marketplace_provider import InternalMarketplaceProvider, build_market_signal_rows


def main():
    with db_cursor(dictionary=True) as (_conn, cursor):
        ensure_support_tables(cursor)
        provider = InternalMarketplaceProvider()
        result = provider.fetch(cursor)
        source_reference_id = insert_source_reference(cursor, result.source)
        market_map = fetch_market_map(cursor)
        snapshot_date = datetime.now(UTC).replace(minute=0, second=0, microsecond=0, tzinfo=None)

        signal_rows = build_market_signal_rows(result.items, snapshot_date, source_reference_id)
        for row in signal_rows:
            market_id = market_map.get(row["country_code"])
            if market_id is None:
                continue

            cursor.execute(
                """
                INSERT INTO vehicle_market_signals
                  (variant_id, market_id, snapshot_date, active_listing_count, avg_asking_price, median_asking_price, min_asking_price, max_asking_price,
                   avg_mileage_km, price_spread_pct, scarcity_score, data_confidence, source_reference_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                  active_listing_count = VALUES(active_listing_count),
                  avg_asking_price = VALUES(avg_asking_price),
                  median_asking_price = VALUES(median_asking_price),
                  min_asking_price = VALUES(min_asking_price),
                  max_asking_price = VALUES(max_asking_price),
                  avg_mileage_km = VALUES(avg_mileage_km),
                  price_spread_pct = VALUES(price_spread_pct),
                  scarcity_score = VALUES(scarcity_score),
                  data_confidence = VALUES(data_confidence),
                  source_reference_id = VALUES(source_reference_id)
                """,
                (
                    row["variant_id"],
                    market_id,
                    row["snapshot_date"],
                    row["active_listing_count"],
                    row["avg_asking_price"],
                    row["median_asking_price"],
                    row["min_asking_price"],
                    row["max_asking_price"],
                    row["avg_mileage_km"],
                    row["price_spread_pct"],
                    row["scarcity_score"],
                    row["data_confidence"],
                    row["source_reference_id"],
                ),
            )
            upsert_freshness_snapshot(
                cursor,
                "vehicle_market_signal",
                f"variant:{row['variant_id']}:market:{market_id}",
                source_reference_id,
                status="fresh",
                notes="Derived from active marketplace listings.",
            )

        print(f"Ingested {len(signal_rows)} current marketplace signal row(s).")


if __name__ == "__main__":
    main()
