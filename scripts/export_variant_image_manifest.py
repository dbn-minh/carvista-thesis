from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.common.db import db_cursor

OUTPUT_PATH = REPO_ROOT / "data" / "variant_image_manifest.csv"
PLACEHOLDER_PREFIX = "/placeholders/catalog/"


def clean_text(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def is_placeholder(url: str | None) -> bool:
    return bool(url and str(url).startswith(PLACEHOLDER_PREFIX))


def export_manifest(output_path: Path, only_missing: bool = False):
    rows_to_write: list[dict[str, object]] = []

    with db_cursor(dictionary=True) as (_conn, cursor):
        cursor.execute(
            """
            SELECT
              cv.variant_id,
              mk.name AS make_name,
              cm.name AS model_name,
              cv.model_year,
              cv.trim_name,
              cv.body_type,
              cv.fuel_type,
              cv.transmission,
              cv.msrp_base,
              COUNT(vi.image_id) AS image_count,
              MIN(CASE WHEN vi.sort_order = 0 THEN vi.url ELSE NULL END) AS primary_image_url,
              MIN(vi.url) AS first_image_url
            FROM car_variants cv
            JOIN car_models cm ON cm.model_id = cv.model_id
            JOIN car_makes mk ON mk.make_id = cm.make_id
            LEFT JOIN variant_images vi ON vi.variant_id = cv.variant_id
            GROUP BY
              cv.variant_id,
              mk.name,
              cm.name,
              cv.model_year,
              cv.trim_name,
              cv.body_type,
              cv.fuel_type,
              cv.transmission,
              cv.msrp_base
            ORDER BY cv.msrp_base DESC, mk.name ASC, cm.name ASC, cv.model_year DESC, cv.trim_name ASC
            """
        )
        rows = cursor.fetchall()

    for row in rows:
        primary_image_url = clean_text(row.get("primary_image_url")) or clean_text(row.get("first_image_url"))
        placeholder_only = is_placeholder(primary_image_url)
        has_real_image = bool(primary_image_url and not placeholder_only)

        if only_missing and has_real_image:
            continue

        rows_to_write.append(
            {
                "variant_id": row["variant_id"],
                "make_name": row["make_name"],
                "model_name": row["model_name"],
                "model_year": row["model_year"],
                "trim_name": row["trim_name"],
                "body_type": row["body_type"],
                "fuel_type": row["fuel_type"],
                "transmission": row["transmission"],
                "msrp_base": row["msrp_base"],
                "current_image_count": row["image_count"],
                "current_primary_image_url": primary_image_url or "",
                "image_status": "real" if has_real_image else "placeholder" if primary_image_url else "missing",
                "image_url": "",
                "sort_order": 0,
                "notes": "",
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "variant_id",
                "make_name",
                "model_name",
                "model_year",
                "trim_name",
                "body_type",
                "fuel_type",
                "transmission",
                "msrp_base",
                "current_image_count",
                "current_primary_image_url",
                "image_status",
                "image_url",
                "sort_order",
                "notes",
            ],
        )
        writer.writeheader()
        writer.writerows(rows_to_write)

    return {
        "output_csv": str(output_path),
        "exported_rows": len(rows_to_write),
        "only_missing": only_missing,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Export a human-friendly variant image manifest so you can fill image URLs by make/model/year/trim instead of looking up variant_id manually."
    )
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Export only variants that currently have placeholder or missing images.",
    )
    args = parser.parse_args()

    report = export_manifest(args.output, only_missing=args.only_missing)
    print(report)


if __name__ == "__main__":
    main()
