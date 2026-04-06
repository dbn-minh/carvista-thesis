from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.common.db import db_cursor
from scripts.local_seed_common import (  # noqa: E402
    DATA_DIR,
    VN_LOCATIONS,
    clean_text,
    compute_listing_price,
    load_variant_rows,
    market_tier,
    pick_location,
)

REPORT_PATH = DATA_DIR / "local_marketplace_alignment_report.json"
USER_AUTHORED_MARKERS = (
    "Condition:",
    "Contact preference:",
    "Maintenance history:",
    "Exterior color:",
    "Interior color:",
)
VALID_VN_CITIES = {city for city, _country in VN_LOCATIONS}
LOCATION_ALIASES = {
    "HCM": "HCMC",
    "Ho Chi Minh City": "HCMC",
    "Ha Noi": "Hanoi",
}


def looks_user_authored(description: str | None) -> bool:
    text = description or ""
    return any(marker in text for marker in USER_AUTHORED_MARKERS)


def normalize_inventory(report_path: Path):
    report = {
        "listings_scanned": 0,
        "generated_listings_updated": 0,
        "price_updates": 0,
        "location_updates": 0,
        "skipped_user_authored": 0,
        "skipped_no_variant": 0,
        "country_counts_before": {},
        "country_counts_after": {},
        "updated_by_tier": Counter(),
        "updated_listings": [],
    }

    with db_cursor(dictionary=True) as (conn, cursor):
        variant_rows = {variant.variant_id: variant for variant in load_variant_rows(cursor)}

        cursor.execute(
            """
            SELECT location_country_code, COUNT(*) AS c
            FROM listings
            WHERE status = 'active'
            GROUP BY location_country_code
            ORDER BY c DESC
            """
        )
        report["country_counts_before"] = {
            (row["location_country_code"] or ""): int(row["c"]) for row in cursor.fetchall()
        }

        cursor.execute(
            """
            SELECT listing_id, owner_id, variant_id, asking_price, mileage_km, location_city,
                   location_country_code, status, description
            FROM listings
            WHERE status = 'active'
            ORDER BY listing_id ASC
            """
        )
        listings = cursor.fetchall()

        for row in listings:
            report["listings_scanned"] += 1
            variant_id = int(row["variant_id"]) if row.get("variant_id") is not None else None
            if variant_id is None or variant_id not in variant_rows:
                report["skipped_no_variant"] += 1
                continue

            variant = variant_rows[variant_id]
            updates: dict[str, object] = {}
            current_city = clean_text(row.get("location_city")) or ""
            current_country = clean_text(row.get("location_country_code")) or ""
            normalized_city = LOCATION_ALIASES.get(current_city, current_city)

            desired_city, desired_country = pick_location(variant, slot=int(row["listing_id"]))
            if looks_user_authored(clean_text(row.get("description"))):
                if current_country == "VN" and normalized_city in VALID_VN_CITIES and normalized_city != current_city:
                    updates["location_city"] = normalized_city
                    report["location_updates"] += 1
                else:
                    report["skipped_user_authored"] += 1
                    continue
                current_price = Decimal(str(row["asking_price"]))
                desired_price = current_price
            else:
                if current_country != desired_country or current_city not in VALID_VN_CITIES:
                    updates["location_city"] = desired_city
                    updates["location_country_code"] = desired_country
                    report["location_updates"] += 1

                current_price = Decimal(str(row["asking_price"]))
                desired_price = compute_listing_price(
                    variant,
                    slot=int(row["listing_id"]),
                    mileage_km=int(row.get("mileage_km") or 0),
                )
                if current_price != desired_price:
                    updates["asking_price"] = str(desired_price)
                    report["price_updates"] += 1
            if not updates:
                continue

            sets = ", ".join(f"{column} = %s" for column in updates)
            params = list(updates.values()) + [row["listing_id"]]
            cursor.execute(
                f"UPDATE listings SET {sets}, updated_at = NOW() WHERE listing_id = %s",
                params,
            )
            report["generated_listings_updated"] += 1
            tier = market_tier(variant)
            report["updated_by_tier"][tier] += 1
            report["updated_listings"].append(
                {
                    "listing_id": int(row["listing_id"]),
                    "vehicle": variant.natural_label,
                    "tier": tier,
                    "old_price": str(current_price),
                    "new_price": str(desired_price),
                    "old_location": f"{current_city}, {current_country}".strip(", "),
                    "new_location": f"{updates.get('location_city', desired_city)}, {updates.get('location_country_code', desired_country)}",
                }
            )

        cursor.execute(
            """
            SELECT location_country_code, COUNT(*) AS c
            FROM listings
            WHERE status = 'active'
            GROUP BY location_country_code
            ORDER BY c DESC
            """
        )
        report["country_counts_after"] = {
            (row["location_country_code"] or ""): int(row["c"]) for row in cursor.fetchall()
        }

    report["updated_by_tier"] = dict(sorted(report["updated_by_tier"].items()))
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(
        description="Normalize local marketplace listings to Vietnam-only locations and updated tier-aware pricing."
    )
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    args = parser.parse_args()

    report = normalize_inventory(args.report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
