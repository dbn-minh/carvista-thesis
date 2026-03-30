from data.common.db import db_cursor
from data.common.schema import ensure_support_tables
from data.ingestion.helpers import fetch_variant_catalog, insert_source_reference, upsert_freshness_snapshot
from data.providers.recall_provider import NhtsaRecallProvider


def main(limit=20):
    provider = NhtsaRecallProvider()
    with db_cursor(dictionary=True) as (_conn, cursor):
        ensure_support_tables(cursor)
        variants = fetch_variant_catalog(cursor, limit=limit)

        for variant in variants:
            result = provider.fetch(variant["model_year"], variant["make_name"], variant["model_name"])
            source_reference_id = insert_source_reference(cursor, result.source)

            for row in result.items:
                cursor.execute(
                    """
                    INSERT INTO vehicle_recall_snapshots
                      (variant_id, source_reference_id, campaign_number, component, summary, consequence, remedy, report_date)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE
                      source_reference_id = VALUES(source_reference_id),
                      component = VALUES(component),
                      summary = VALUES(summary),
                      consequence = VALUES(consequence),
                      remedy = VALUES(remedy),
                      report_date = VALUES(report_date)
                    """,
                    (
                        variant["variant_id"],
                        source_reference_id,
                        row.get("campaign_number"),
                        row.get("component"),
                        row.get("summary"),
                        row.get("consequence"),
                        row.get("remedy"),
                        None,
                    ),
                )

            upsert_freshness_snapshot(
                cursor,
                "recall_snapshot",
                f"variant:{variant['variant_id']}",
                source_reference_id,
                status="fresh" if result.items else "unknown",
                notes="Official NHTSA recall snapshot cached for AI retrieval.",
            )

        print(f"Safety/recall ingestion finished for {len(variants)} variant(s).")


if __name__ == "__main__":
    main()
