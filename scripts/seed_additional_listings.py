from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.common.db import db_cursor
from scripts.local_seed_common import (
    DATA_DIR,
    build_listing_description,
    clean_text,
    compute_listing_mileage,
    compute_listing_price,
    insert_listing,
    listing_exists,
    listing_signature,
    load_variant_rows,
    pick_location,
    pick_owner_id,
)

REPORT_PATH = DATA_DIR / "local_seed_additional_listings_report.json"


def should_seed_variant(variant):
    if clean_text(variant.body_type) in {None, "other"}:
        return False
    if clean_text(variant.fuel_type) in {None, "other"}:
        return False
    if clean_text(variant.transmission) is None:
        return False
    return True


def seed_additional_listings(report_path: Path):
    report = {
        "variants_considered": 0,
        "variants_seeded": 0,
        "listings_created": 0,
        "skipped_variants": [],
        "body_type_breakdown": Counter(),
        "make_breakdown": Counter(),
    }

    with db_cursor(dictionary=True) as (conn, cursor):
        variants = load_variant_rows(cursor, include_listing_counts=True)
        listing_counts = {}
        cursor.execute(
            """
            SELECT variant_id, COUNT(*) AS listing_count
            FROM listings
            GROUP BY variant_id
            """
        )
        for row in cursor.fetchall():
            listing_counts[int(row["variant_id"])] = int(row["listing_count"])

        for variant in variants:
            report["variants_considered"] += 1
            current_count = listing_counts.get(variant.variant_id, 0)

            if not should_seed_variant(variant):
                report["skipped_variants"].append(
                    {"variant": variant.natural_label, "reason": "variant quality is too incomplete for marketplace seeding"}
                )
                continue

            if current_count > 0:
                continue

            location_city, location_country_code = pick_location(variant, slot=0)
            owner_id = pick_owner_id(variant, slot=0)
            asking_price = compute_listing_price(variant, slot=0)
            mileage_km = compute_listing_mileage(variant, slot=0)
            description = build_listing_description(variant, slot=0)
            signature = listing_signature(
                owner_id,
                variant,
                location_city,
                location_country_code,
                asking_price,
                mileage_km,
            )
            if listing_exists(cursor, signature):
                continue

            insert_listing(
                cursor,
                owner_id=owner_id,
                variant=variant,
                location_city=location_city,
                location_country_code=location_country_code,
                asking_price=asking_price,
                mileage_km=mileage_km,
                description=description,
                status="active",
            )
            report["variants_seeded"] += 1
            report["listings_created"] += 1
            report["body_type_breakdown"][variant.body_type or "other"] += 1
            report["make_breakdown"][variant.make_name] += 1

    report["body_type_breakdown"] = dict(sorted(report["body_type_breakdown"].items()))
    report["make_breakdown"] = dict(sorted(report["make_breakdown"].items(), key=lambda item: (-item[1], item[0])))
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description="Add one realistic active marketplace listing for each DB-backed variant that currently has no listing.")
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    args = parser.parse_args()

    report = seed_additional_listings(args.report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
