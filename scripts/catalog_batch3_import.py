import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.common.db import db_cursor

CSV_PATH = REPO_ROOT / "data" / "enriched_selected_50_models.csv"
REPORT_PATH = REPO_ROOT / "data" / "catalog_batch3_import_report.json"
PLACEHOLDER_PREFIX = "/placeholders/catalog"

BODY_TYPES = {
    "sedan",
    "hatchback",
    "suv",
    "cuv",
    "mpv",
    "pickup",
    "coupe",
    "convertible",
    "wagon",
    "van",
    "other",
}

FUEL_MAP = {
    "gasoline": "gasoline",
    "diesel": "diesel",
    "hybrid": "hybrid",
    "plug-in hybrid": "phev",
    "phev": "phev",
    "electric": "ev",
    "ev": "ev",
    "flex fuel": "other",
    "other": "other",
}

SEGMENT_MAP = {
    "sedan": "sedan",
    "hatchback": "hatchback",
    "suv": "suv",
    "cuv": "cuv",
    "mpv": "mpv",
    "pickup": "pickup",
    "coupe": "coupe",
    "convertible": "convertible",
    "wagon": "wagon",
    "van": "van",
    "other": "other",
}

PLACEHOLDER_BY_BODY = {
    "sedan": "sedan",
    "hatchback": "hatchback",
    "suv": "suv",
    "cuv": "suv",
    "mpv": "mpv",
    "pickup": "pickup",
    "coupe": "coupe",
    "convertible": "convertible",
    "wagon": "wagon",
    "van": "van",
    "other": "generic",
}


def clean_text(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_decimal(value):
    text = clean_text(value)
    if text is None:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_int(value):
    text = clean_text(value)
    if text is None:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def parse_bool(value):
    return str(value).strip().lower() in {"true", "1", "yes"}


def normalize_body_type(row):
    body = clean_text(row.get("body_type_normalized"))
    if not body:
        refined = clean_text(row.get("body_class_refined"))
        if not refined:
            return "other"
        refined_lower = refined.lower()
        if "suv" in refined_lower:
            body = "suv"
        elif "crossover" in refined_lower:
            body = "cuv"
        elif "minivan" in refined_lower or "mpv" in refined_lower:
            body = "mpv"
        elif "pickup" in refined_lower:
            body = "pickup"
        elif "hatchback" in refined_lower or "liftback" in refined_lower:
            body = "hatchback"
        elif "wagon" in refined_lower:
            body = "wagon"
        elif "convertible" in refined_lower or "cabriolet" in refined_lower:
            body = "convertible"
        elif "coupe" in refined_lower:
            body = "coupe"
        elif "van" in refined_lower:
            body = "van"
        elif "sedan" in refined_lower or "saloon" in refined_lower:
            body = "sedan"
        else:
            body = "other"
    body = body.lower()
    return body if body in BODY_TYPES else "other"


def normalize_fuel_type(value):
    text = clean_text(value)
    if not text:
        return "other"
    return FUEL_MAP.get(text.lower(), "other")


def normalize_drivetrain(value):
    text = clean_text(value)
    if not text:
        return None
    normalized = " ".join(part.capitalize() for part in text.replace("-", " ").split())
    replacements = {
        "All Wheel Drive": "All-Wheel Drive",
        "Rear Wheel Drive": "Rear-Wheel Drive",
        "Front Wheel Drive": "Front-Wheel Drive",
        "Four Wheel Drive": "Four-Wheel Drive",
    }
    return replacements.get(normalized, text[:60])


def choose_transmission(row):
    detailed = clean_text(row.get("transmission_detail"))
    if detailed:
        return detailed[:60]
    normalized = clean_text(row.get("transmission_normalized"))
    if normalized:
        return normalized[:60]
    raw = clean_text(row.get("transmission_raw"))
    return raw[:60] if raw else None


def choose_engine(row):
    engine = clean_text(row.get("engine"))
    return engine[:120] if engine else None


def choose_segment(body_type):
    return SEGMENT_MAP.get(body_type or "other", "other")


def choose_placeholder_url(row):
    fuel_type = normalize_fuel_type(row.get("fuel_type"))
    if fuel_type == "ev":
        slug = "ev"
    else:
        slug = PLACEHOLDER_BY_BODY.get(normalize_body_type(row), "generic")
    return f"{PLACEHOLDER_PREFIX}/{slug}.svg"


def natural_key(row):
    return {
        "make_name": clean_text(row.get("make_name")),
        "model_name": clean_text(row.get("model_name")),
        "model_year": parse_int(row.get("model_year")),
        "trim_name": clean_text(row.get("trim_name")),
    }


def row_label(row):
    key = natural_key(row)
    return " ".join(
        str(part)
        for part in [key["make_name"], key["model_name"], key["model_year"], key["trim_name"]]
        if part
    )


def is_import_eligible(row):
    confidence = clean_text(row.get("enrichment_confidence")) or "unresolved"
    status = clean_text(row.get("enrichment_status")) or "unresolved"
    body_type = normalize_body_type(row)
    fuel_type = normalize_fuel_type(row.get("fuel_type"))
    transmission = choose_transmission(row)
    drivetrain = normalize_drivetrain(row.get("drivetrain"))
    engine = choose_engine(row)
    displacement = parse_int(row.get("engine_displacement_cc"))

    if status == "unresolved" or confidence == "unresolved":
        return False, "enrichment unresolved"
    if not all(natural_key(row).values()):
        return False, "missing natural-key field"
    if body_type == "other" and not clean_text(row.get("body_type_normalized")):
        return False, "missing body type"
    if not fuel_type:
        return False, "missing fuel type"
    if not transmission:
        return False, "missing transmission detail"

    if fuel_type == "ev":
        return True, "eligible under EV import rule"

    if not drivetrain:
        return False, "missing drivetrain"
    if not engine and displacement is None:
        return False, "missing engine/displacement"
    return True, "eligible under compare-essential field rule"


def listing_fingerprints(cursor):
    cursor.execute(
        """
        SELECT
          COUNT(*) AS row_count,
          COALESCE(SUM(listing_id), 0) AS id_sum,
          COALESCE(SUM(owner_id), 0) AS owner_sum,
          COALESCE(SUM(variant_id), 0) AS variant_sum,
          COALESCE(SUM(asking_price), 0) AS price_sum,
          COALESCE(SUM(mileage_km), 0) AS mileage_sum,
          COALESCE(UNIX_TIMESTAMP(MAX(updated_at)), 0) AS latest_update_unix
        FROM listings
        """
    )
    listings = cursor.fetchone()

    cursor.execute(
        """
        SELECT
          COUNT(*) AS row_count,
          COALESCE(SUM(listing_image_id), 0) AS id_sum,
          COALESCE(SUM(listing_id), 0) AS listing_sum,
          COALESCE(SUM(sort_order), 0) AS sort_sum,
          COALESCE(SUM(CRC32(url)), 0) AS url_crc_sum
        FROM listing_images
        """
    )
    listing_images = cursor.fetchone()

    return {"listings": listings, "listing_images": listing_images}


def fetch_one(cursor, sql, params):
    cursor.execute(sql, params)
    return cursor.fetchone()


def ensure_make(cursor, make_name, report):
    existing = fetch_one(
        cursor,
        """
        SELECT make_id, name, is_placeholder
        FROM car_makes
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
        LIMIT 1
        """,
        (make_name,),
    )
    if existing:
        if existing["is_placeholder"]:
            cursor.execute(
                "UPDATE car_makes SET is_placeholder = %s WHERE make_id = %s",
                (False, existing["make_id"]),
            )
            report["updated_makes"] += 1
        return existing["make_id"]

    cursor.execute(
        "INSERT INTO car_makes (name, country_of_origin, is_placeholder) VALUES (%s, %s, %s)",
        (make_name, None, False),
    )
    report["inserted_makes"] += 1
    return cursor.lastrowid


def ensure_model(cursor, make_id, model_name, segment, report):
    existing = fetch_one(
        cursor,
        """
        SELECT model_id, segment, is_placeholder
        FROM car_models
        WHERE make_id = %s AND LOWER(TRIM(name)) = LOWER(TRIM(%s))
        LIMIT 1
        """,
        (make_id, model_name),
    )
    if existing:
        updates = []
        params = []
        if existing["is_placeholder"]:
            updates.append("is_placeholder = %s")
            params.append(False)
        if segment and (existing["segment"] is None or existing["is_placeholder"]):
            updates.append("segment = %s")
            params.append(segment)
        if updates:
            params.append(existing["model_id"])
            cursor.execute(
                f"UPDATE car_models SET {', '.join(updates)} WHERE model_id = %s",
                tuple(params),
            )
            report["updated_models"] += 1
        return existing["model_id"]

    cursor.execute(
        "INSERT INTO car_models (make_id, name, segment, is_placeholder) VALUES (%s, %s, %s, %s)",
        (make_id, model_name, segment, False),
    )
    report["inserted_models"] += 1
    return cursor.lastrowid


def ensure_variant(cursor, model_id, row, report):
    existing = fetch_one(
        cursor,
        """
        SELECT
          variant_id,
          body_type,
          engine,
          transmission,
          drivetrain,
          fuel_type,
          seats,
          doors,
          msrp_base,
          is_placeholder
        FROM car_variants
        WHERE model_id = %s
          AND model_year = %s
          AND LOWER(TRIM(trim_name)) = LOWER(TRIM(%s))
        LIMIT 1
        """,
        (model_id, parse_int(row.get("model_year")), clean_text(row.get("trim_name"))),
    )

    body_type = normalize_body_type(row)
    engine = choose_engine(row)
    transmission = choose_transmission(row)
    drivetrain = normalize_drivetrain(row.get("drivetrain"))
    fuel_type = normalize_fuel_type(row.get("fuel_type"))
    seats = parse_int(row.get("seats"))
    doors = parse_int(row.get("doors"))
    msrp_base = parse_decimal(row.get("msrp_base_candidate"))

    if existing:
        updates = []
        params = []
        if existing["is_placeholder"]:
            updates.append("is_placeholder = %s")
            params.append(False)
        if body_type and body_type != existing["body_type"] and (existing["body_type"] in {None, "other"} or existing["is_placeholder"]):
            updates.append("body_type = %s")
            params.append(body_type)
        if engine and engine != existing["engine"] and (not existing["engine"] or existing["is_placeholder"]):
            updates.append("engine = %s")
            params.append(engine)
        if transmission and transmission != existing["transmission"] and (not existing["transmission"] or existing["is_placeholder"]):
            updates.append("transmission = %s")
            params.append(transmission)
        if drivetrain and drivetrain != existing["drivetrain"] and (not existing["drivetrain"] or existing["is_placeholder"]):
            updates.append("drivetrain = %s")
            params.append(drivetrain)
        if fuel_type and fuel_type != existing["fuel_type"] and (existing["fuel_type"] in {None, "other"} or existing["is_placeholder"]):
            updates.append("fuel_type = %s")
            params.append(fuel_type)
        if seats is not None and existing["seats"] is None:
            updates.append("seats = %s")
            params.append(seats)
        if doors is not None and existing["doors"] is None:
            updates.append("doors = %s")
            params.append(doors)
        if msrp_base is not None and existing["msrp_base"] is None:
            updates.append("msrp_base = %s")
            params.append(msrp_base)

        if updates:
            params.append(existing["variant_id"])
            cursor.execute(
                f"UPDATE car_variants SET {', '.join(updates)} WHERE variant_id = %s",
                tuple(params),
            )
            report["updated_variants"] += 1
        return existing["variant_id"]

    cursor.execute(
        """
        INSERT INTO car_variants
          (model_id, model_year, trim_name, body_type, engine, transmission, drivetrain, fuel_type, seats, doors, msrp_base, is_placeholder)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            model_id,
            parse_int(row.get("model_year")),
            clean_text(row.get("trim_name")),
            body_type,
            engine,
            transmission,
            drivetrain,
            fuel_type,
            seats,
            doors,
            msrp_base,
            False,
        ),
    )
    report["inserted_variants"] += 1
    return cursor.lastrowid


def ensure_placeholder_image(cursor, variant_id, placeholder_url, report):
    cursor.execute(
        "SELECT image_id, url, sort_order FROM variant_images WHERE variant_id = %s ORDER BY sort_order ASC, image_id ASC",
        (variant_id,),
    )
    existing = cursor.fetchall()
    if existing:
        return

    cursor.execute(
        "INSERT INTO variant_images (variant_id, url, sort_order) VALUES (%s, %s, %s)",
        (variant_id, placeholder_url, 0),
    )
    report["placeholder_images_created"] += 1


def load_rows(path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_report(path, report):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def build_model_segment_map(rows):
    grouped = defaultdict(list)
    for row in rows:
        key = (clean_text(row.get("make_name")), clean_text(row.get("model_name")))
        grouped[key].append(normalize_body_type(row))

    segments = {}
    for key, bodies in grouped.items():
        dominant_body = Counter(bodies).most_common(1)[0][0] if bodies else "other"
        segments[key] = choose_segment(dominant_body)
    return segments


def build_import_report(rows):
    return {
        "input_csv": str(REPO_ROOT / "data" / "enriched_selected_50_models.csv"),
        "input_row_count": len(rows),
        "inserted_makes": 0,
        "updated_makes": 0,
        "inserted_models": 0,
        "updated_models": 0,
        "inserted_variants": 0,
        "updated_variants": 0,
        "placeholder_images_created": 0,
        "imported_rows": 0,
        "skipped_rows": [],
        "confidence_rows": {"medium": [], "low": []},
        "ev_rule_rows": [],
    }


def import_catalog(csv_path, report_path):
    rows = load_rows(csv_path)
    report = build_import_report(rows)
    model_segments = build_model_segment_map(rows)

    with db_cursor(dictionary=True) as (conn, cursor):
        before_fingerprints = listing_fingerprints(cursor)

        for row in rows:
            eligible, reason = is_import_eligible(row)
            label = row_label(row)
            if not eligible:
                report["skipped_rows"].append({"variant": label, "reason": reason})
                continue

            make_name = clean_text(row.get("make_name"))
            model_name = clean_text(row.get("model_name"))
            trim_name = clean_text(row.get("trim_name"))
            model_year = parse_int(row.get("model_year"))
            confidence = clean_text(row.get("enrichment_confidence")) or "unresolved"
            fuel_type = normalize_fuel_type(row.get("fuel_type"))

            if fuel_type == "ev":
                report["ev_rule_rows"].append(
                    {
                        "variant": label,
                        "reason": "Imported under EV-safe rule even without piston-engine displacement.",
                    }
                )

            if confidence in {"medium", "low"}:
                report["confidence_rows"][confidence].append(
                    {
                        "variant": label,
                        "confidence": confidence,
                        "notes": clean_text(row.get("enrichment_notes")),
                    }
                )

            make_id = ensure_make(cursor, make_name, report)
            model_id = ensure_model(
                cursor,
                make_id,
                model_name,
                model_segments.get((make_name, model_name), "other"),
                report,
            )
            variant_id = ensure_variant(cursor, model_id, row, report)
            ensure_placeholder_image(cursor, variant_id, choose_placeholder_url(row), report)
            report["imported_rows"] += 1

            # Keep linters happy about required natural-key variables being read.
            _ = (trim_name, model_year)

        after_fingerprints = listing_fingerprints(cursor)
        if before_fingerprints != after_fingerprints:
            raise RuntimeError(
                "Safety check failed: listings or listing_images changed during catalog-only import."
            )

        cursor.execute("SELECT COUNT(*) AS count FROM car_makes")
        report["final_counts"] = {"car_makes": cursor.fetchone()["count"]}
        cursor.execute("SELECT COUNT(*) AS count FROM car_models")
        report["final_counts"]["car_models"] = cursor.fetchone()["count"]
        cursor.execute("SELECT COUNT(*) AS count FROM car_variants")
        report["final_counts"]["car_variants"] = cursor.fetchone()["count"]
        cursor.execute("SELECT COUNT(*) AS count FROM variant_images")
        report["final_counts"]["variant_images"] = cursor.fetchone()["count"]
        cursor.execute("SELECT COUNT(*) AS count FROM listings")
        report["final_counts"]["listings"] = cursor.fetchone()["count"]
        cursor.execute("SELECT COUNT(*) AS count FROM listing_images")
        report["final_counts"]["listing_images"] = cursor.fetchone()["count"]

    write_report(report_path, report)
    return report


def main():
    parser = argparse.ArgumentParser(description="Batch 3 catalog-only import for reviewed enriched catalog variants.")
    parser.add_argument("--csv", type=Path, default=CSV_PATH)
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    args = parser.parse_args()

    report = import_catalog(args.csv, args.report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
