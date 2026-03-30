from itertools import chain

from data.common.db import db_cursor
from data.common.schema import ensure_support_tables
from data.ingestion.helpers import insert_source_reference, upsert_freshness_snapshot
from data.providers.vehicle_fact_provider import CanonicalCatalogProvider


def build_aliases(vehicle):
    make = vehicle["make_name"]
    model = vehicle["model_name"]
    trim = vehicle["trim_name"]
    year = vehicle["model_year"]

    aliases = {
        make,
        f"{make} {model}",
        f"{model}",
        f"{year} {make} {model}",
        f"{make} {model} {trim}",
        f"{year} {make} {model} {trim}",
    }

    if "Series" in model:
        aliases.add(model.replace(" Series", ""))
    if make == "Mercedes-Benz" and "Class" in model:
        aliases.add(model.replace("-Class", ""))
        aliases.add(f"Mercedes {model}")
        aliases.add(f"Mercedes {trim}")
    if make == "BMW":
        aliases.add(f"{model} {trim}")
    return {alias.strip() for alias in aliases if alias and len(alias.strip()) >= 2}


def main():
    with db_cursor(dictionary=True) as (_conn, cursor):
        ensure_support_tables(cursor)
        provider = CanonicalCatalogProvider()
        result = provider.fetch(cursor)
        source_reference_id = insert_source_reference(cursor, result.source)

        inserted = 0
        for vehicle in result.items:
            for alias in build_aliases(vehicle):
                cursor.execute(
                    """
                    INSERT INTO vehicle_market_aliases
                      (variant_id, model_id, make_id, alias_name, market_scope, normalization_status, source_reference_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE
                      model_id = VALUES(model_id),
                      make_id = VALUES(make_id),
                      source_reference_id = VALUES(source_reference_id),
                      normalization_status = VALUES(normalization_status)
                    """,
                    (
                        vehicle["variant_id"],
                        vehicle["model_id"],
                        vehicle["make_id"],
                        alias,
                        None,
                        "generated",
                        source_reference_id,
                    ),
                )
                inserted += 1

            upsert_freshness_snapshot(
                cursor,
                "variant_aliases",
                f"variant:{vehicle['variant_id']}",
                source_reference_id,
                status="fresh",
                notes="Canonical alias set refreshed from the normalized catalog.",
            )

        print(f"Normalized aliases refreshed for {len(result.items)} variants ({inserted} alias rows processed).")


if __name__ == "__main__":
    main()
