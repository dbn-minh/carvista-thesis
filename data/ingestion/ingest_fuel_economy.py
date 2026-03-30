from data.common.db import db_cursor
from data.common.schema import ensure_support_tables
from data.ingestion.helpers import fetch_variant_catalog, insert_source_reference, upsert_freshness_snapshot
from data.providers.fuel_provider import FuelEconomyGovProvider


def main(limit=20):
    provider = FuelEconomyGovProvider()
    with db_cursor(dictionary=True) as (_conn, cursor):
        ensure_support_tables(cursor)
        variants = fetch_variant_catalog(cursor, limit=limit)

        for variant in variants:
            result = provider.fetch(variant["model_year"], variant["make_name"], variant["model_name"])
            source_reference_id = insert_source_reference(cursor, result.source)
            if not result.items:
                upsert_freshness_snapshot(
                    cursor,
                    "fuel_economy",
                    f"variant:{variant['variant_id']}",
                    source_reference_id,
                    status="unknown",
                    notes="No official fuel-economy row was returned for this variant lookup.",
                )
                continue

            item = result.items[0]
            cursor.execute(
                """
                INSERT INTO vehicle_fuel_economy_snapshots
                  (variant_id, source_reference_id, combined_mpg, city_mpg, highway_mpg, annual_fuel_cost_usd, fuel_type, drive, class_name)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                  source_reference_id = VALUES(source_reference_id),
                  combined_mpg = VALUES(combined_mpg),
                  city_mpg = VALUES(city_mpg),
                  highway_mpg = VALUES(highway_mpg),
                  annual_fuel_cost_usd = VALUES(annual_fuel_cost_usd),
                  fuel_type = VALUES(fuel_type),
                  drive = VALUES(drive),
                  class_name = VALUES(class_name)
                """,
                (
                    variant["variant_id"],
                    source_reference_id,
                    item.get("combined_mpg"),
                    item.get("city_mpg"),
                    item.get("highway_mpg"),
                    item.get("annual_fuel_cost_usd"),
                    item.get("fuel_type"),
                    item.get("drive"),
                    item.get("class_name"),
                ),
            )
            upsert_freshness_snapshot(
                cursor,
                "fuel_economy",
                f"variant:{variant['variant_id']}",
                source_reference_id,
                status="fresh",
                notes="Official FuelEconomy.gov snapshot cached for AI retrieval.",
            )

        print(f"Fuel economy ingestion finished for {len(variants)} variant(s).")


if __name__ == "__main__":
    main()
