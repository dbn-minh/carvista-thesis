from datetime import datetime


def insert_source_reference(cursor, source):
    cursor.execute(
        """
        INSERT INTO source_references
          (provider_key, source_type, title, url, trust_level, retrieved_at, update_cadence, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            source.provider_key,
            source.source_type,
            source.title,
            source.url,
            source.trust_level,
            source.retrieved_at,
            source.update_cadence,
            source.notes,
        ),
    )
    return cursor.lastrowid


def upsert_freshness_snapshot(cursor, entity_type, entity_key, source_reference_id, status="fresh", notes=None):
    now = datetime.utcnow()
    cursor.execute(
        """
        INSERT INTO data_freshness_snapshots
          (entity_type, entity_key, source_reference_id, last_refreshed_at, freshness_days, status, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
          source_reference_id = VALUES(source_reference_id),
          last_refreshed_at = VALUES(last_refreshed_at),
          freshness_days = VALUES(freshness_days),
          status = VALUES(status),
          notes = VALUES(notes)
        """,
        (entity_type, entity_key, source_reference_id, now, 0, status, notes),
    )


def fetch_market_map(cursor):
    cursor.execute("SELECT market_id, country_code FROM markets")
    market_map = {}
    for row in cursor.fetchall():
        if isinstance(row, dict):
            market_map[row["country_code"]] = row["market_id"]
        else:
            market_map[row[1]] = row[0]
    return market_map


def fetch_variant_catalog(cursor, limit=None):
    sql = """
        SELECT
          cv.variant_id,
          cv.model_year,
          cv.trim_name,
          cm.name AS model_name,
          mk.name AS make_name
        FROM car_variants cv
        JOIN car_models cm ON cm.model_id = cv.model_id
        JOIN car_makes mk ON mk.make_id = cm.make_id
        ORDER BY cv.model_year DESC, mk.name, cm.name
    """
    if limit:
        sql += " LIMIT %s"
        cursor.execute(sql, (limit,))
    else:
        cursor.execute(sql)
    return cursor.fetchall()
