import argparse
import csv
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.common.db import db_cursor

CSV_PATH = REPO_ROOT / "data" / "variant_image_links.csv"
REPORT_PATH = REPO_ROOT / "data" / "catalog_batch3_variant_image_import_report.json"
PLACEHOLDER_PREFIX = "/placeholders/catalog/"


def clean_text(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_int(value):
    text = clean_text(value)
    if text is None:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def row_label(row):
    return " ".join(
        str(part)
        for part in [
            clean_text(row.get("make_name")),
            clean_text(row.get("model_name")),
            parse_int(row.get("model_year")),
            clean_text(row.get("trim_name")),
        ]
        if part not in {None, ""}
    )


def load_rows(path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def resolve_variant_id(cursor, row):
    cursor.execute(
        """
        SELECT cv.variant_id
        FROM car_variants cv
        JOIN car_models cm ON cm.model_id = cv.model_id
        JOIN car_makes mk ON mk.make_id = cm.make_id
        WHERE LOWER(TRIM(mk.name)) = LOWER(TRIM(%s))
          AND LOWER(TRIM(cm.name)) = LOWER(TRIM(%s))
          AND cv.model_year = %s
          AND LOWER(TRIM(cv.trim_name)) = LOWER(TRIM(%s))
        LIMIT 2
        """,
        (
            clean_text(row.get("make_name")),
            clean_text(row.get("model_name")),
            parse_int(row.get("model_year")),
            clean_text(row.get("trim_name")),
        ),
    )
    rows = cursor.fetchall()
    if len(rows) != 1:
        return None
    return rows[0]["variant_id"]


def upsert_variant_image(cursor, variant_id, row):
    image_url = clean_text(row.get("image_url"))
    sort_order = parse_int(row.get("sort_order"))
    sort_order = 0 if sort_order is None or sort_order < 0 else sort_order

    cursor.execute(
        "SELECT image_id, url, sort_order FROM variant_images WHERE variant_id = %s ORDER BY sort_order ASC, image_id ASC",
        (variant_id,),
    )
    existing = cursor.fetchall()

    for image in existing:
        if clean_text(image["url"]) == image_url:
            if int(image["sort_order"]) != sort_order:
                cursor.execute(
                    "UPDATE variant_images SET sort_order = %s WHERE image_id = %s",
                    (sort_order, image["image_id"]),
                )
                return "updated_existing_url"
            return "unchanged"

    for image in existing:
        if int(image["sort_order"]) == sort_order and str(image["url"]).startswith(PLACEHOLDER_PREFIX):
            cursor.execute(
                "UPDATE variant_images SET url = %s, sort_order = %s WHERE image_id = %s",
                (image_url, sort_order, image["image_id"]),
            )
            return "replaced_placeholder"

    occupied_sort_orders = {int(image["sort_order"]) for image in existing}
    final_sort_order = sort_order
    while final_sort_order in occupied_sort_orders:
        final_sort_order += 1

    cursor.execute(
        "INSERT INTO variant_images (variant_id, url, sort_order) VALUES (%s, %s, %s)",
        (variant_id, image_url, final_sort_order),
    )
    return "inserted"


def import_variant_images(csv_path, report_path):
    rows = load_rows(csv_path)
    report = {
        "input_csv": str(csv_path),
        "input_row_count": len(rows),
        "inserted": 0,
        "replaced_placeholder": 0,
        "updated_existing_url": 0,
        "unchanged": 0,
        "skipped": [],
    }

    with db_cursor(dictionary=True) as (conn, cursor):
        for row in rows:
            image_url = clean_text(row.get("image_url"))
            if not image_url:
                report["skipped"].append({"variant": row_label(row), "reason": "missing image_url"})
                continue

            variant_id = resolve_variant_id(cursor, row)
            if variant_id is None:
                report["skipped"].append({"variant": row_label(row), "reason": "natural key did not resolve to exactly one variant"})
                continue

            action = upsert_variant_image(cursor, variant_id, row)
            report[action] += 1

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description="Import real variant image links by natural key without touching listing_images.")
    parser.add_argument("--csv", type=Path, default=CSV_PATH)
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    args = parser.parse_args()

    report = import_variant_images(args.csv, args.report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
