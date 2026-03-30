from datetime import datetime

from data.common.db import db_cursor
from data.common.schema import ensure_support_tables
from data.ingestion.helpers import fetch_market_map, insert_source_reference, upsert_freshness_snapshot
from data.providers.base import SourceReference


def main():
    with db_cursor(dictionary=True) as (_conn, cursor):
        ensure_support_tables(cursor)
        source_reference_id = insert_source_reference(
            cursor,
            SourceReference(
                provider_key="listing_price_history_rollup",
                source_type="internal_marketplace",
                title="Variant price-history rollup derived from listing and listing_price_history tables",
                trust_level="high",
                update_cadence="daily",
            ),
        )
        market_map = fetch_market_map(cursor)
        cursor.execute(
            """
            SELECT
              l.variant_id,
              l.location_country_code AS country_code,
              DATE_FORMAT(COALESCE(lph.changed_at, l.created_at), '%Y-%m-01') AS bucket_start,
              AVG(COALESCE(lph.price, l.asking_price)) AS avg_price
            FROM listings l
            LEFT JOIN listing_price_history lph ON lph.listing_id = l.listing_id
            GROUP BY
              l.variant_id,
              l.location_country_code,
              DATE_FORMAT(COALESCE(lph.changed_at, l.created_at), '%Y-%m-01')
            HAVING avg_price IS NOT NULL
            """
        )
        rows = cursor.fetchall()

        for row in rows:
            market_id = market_map.get(row["country_code"])
            if market_id is None:
                continue
            cursor.execute(
                """
                INSERT INTO variant_price_history (variant_id, market_id, price_type, price, captured_at, source)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE price = VALUES(price), source = VALUES(source)
                """,
                (
                    row["variant_id"],
                    market_id,
                    "avg_market",
                    round(float(row["avg_price"]), 2),
                    row["bucket_start"],
                    "internal_marketplace_rollup",
                ),
            )
            upsert_freshness_snapshot(
                cursor,
                "variant_price_history",
                f"variant:{row['variant_id']}:market:{market_id}",
                source_reference_id,
                status="fresh",
                notes="Monthly price history proxy built from current listings and listing price history.",
            )

        print(f"Rolled up {len(rows)} variant price-history data point(s).")


if __name__ == "__main__":
    main()
