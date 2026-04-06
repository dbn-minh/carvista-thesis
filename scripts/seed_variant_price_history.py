from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.common.db import db_cursor
from scripts.local_seed_common import (
    DATA_DIR,
    HISTORY_SOURCE,
    VariantContext,
    clean_text,
    compute_current_market_value,
    compute_history_decline_rate,
    count_existing_history_points,
    deterministic_fraction,
    iter_month_starts,
    load_variant_rows,
    round_currency,
    variant_is_exotic,
)

REPORT_PATH = DATA_DIR / "local_seed_variant_price_history_report.json"


def build_history_price(variant: VariantContext, market_id: int, months_back: int) -> Decimal:
    current_value = compute_current_market_value(variant, market_id=market_id)
    annual_decline = compute_history_decline_rate(variant)
    monthly_decline = annual_decline / Decimal("12")

    base = current_value / ((Decimal("1") - monthly_decline) ** months_back)
    seasonal = Decimal(str(1 + 0.012 * math.sin(months_back / 5.5)))
    shortage_multiplier = Decimal("1.00")
    if 26 <= months_back <= 42:
        shortage_multiplier += Decimal("0.025")
    elif 14 <= months_back <= 25:
        shortage_multiplier += Decimal("0.01")

    volatility_window = Decimal("0.018") if variant_is_exotic(variant) else Decimal("0.012")
    centered_noise = (deterministic_fraction(f"{variant.variant_id}:{market_id}:{months_back}:noise") * 2) - 1
    noise = Decimal("1.0") + centered_noise * volatility_window

    price = base * seasonal * shortage_multiplier * noise
    return round_currency(price, market_id) or Decimal("0")


def upsert_history_points(cursor, variant: VariantContext, market_id: int):
    cursor.execute(
        """
        SELECT price_id, DATE(captured_at) AS captured_day, price
        FROM variant_price_history
        WHERE variant_id = %s
          AND market_id = %s
          AND price_type = 'avg_market'
          AND source = %s
        """,
        (variant.variant_id, market_id, HISTORY_SOURCE),
    )
    existing = {str(row["captured_day"]): row for row in cursor.fetchall()}

    inserted = 0
    updated = 0
    total_target = 0
    month_points = list(iter_month_starts(60))
    total_months = len(month_points) - 1

    for index, captured_at in enumerate(month_points):
        months_back = total_months - index
        target_price = build_history_price(variant, market_id, months_back)
        total_target += 1
        key = captured_at.isoformat()
        current_row = existing.get(key)
        if current_row:
            current_price = Decimal(str(current_row["price"]))
            if current_price != target_price:
                cursor.execute(
                    "UPDATE variant_price_history SET price = %s, source = %s WHERE price_id = %s",
                    (str(target_price), HISTORY_SOURCE, current_row["price_id"]),
                )
                updated += 1
            continue

        cursor.execute(
            """
            INSERT INTO variant_price_history (
              variant_id, market_id, price_type, price, captured_at, source
            ) VALUES (%s, %s, 'avg_market', %s, %s, %s)
            """,
            (variant.variant_id, market_id, str(target_price), captured_at.isoformat(), HISTORY_SOURCE),
        )
        inserted += 1

    return {
        "inserted": inserted,
        "updated": updated,
        "target_points": total_target,
    }


def count_variants_with_five_years(cursor, market_id: int):
    cursor.execute(
        """
        SELECT COUNT(*) AS c
        FROM (
          SELECT variant_id
          FROM variant_price_history
          WHERE market_id = %s AND price_type = 'avg_market'
          GROUP BY variant_id
          HAVING MIN(captured_at) <= DATE_SUB(UTC_DATE(), INTERVAL 5 YEAR)
        ) x
        """,
        (market_id,),
    )
    return int(cursor.fetchone()["c"])


def seed_history(report_path: Path):
    report = {
        "source": HISTORY_SOURCE,
        "variants_processed": 0,
        "market_stats": {
            "1": {"inserted": 0, "updated": 0},
            "2": {"inserted": 0, "updated": 0},
        },
        "variants_with_5_years_market_1_before": 0,
        "variants_with_5_years_market_1_after": 0,
        "variants_with_5_years_market_2_after": 0,
        "rows_per_variant_per_market": 61,
    }

    with db_cursor(dictionary=True) as (conn, cursor):
        report["variants_with_5_years_market_1_before"] = count_variants_with_five_years(cursor, 1)
        variants = load_variant_rows(cursor)
        for variant in variants:
            report["variants_processed"] += 1
            for market_id in (1, 2):
                stats = upsert_history_points(cursor, variant, market_id)
                report["market_stats"][str(market_id)]["inserted"] += stats["inserted"]
                report["market_stats"][str(market_id)]["updated"] += stats["updated"]

        report["variants_with_5_years_market_1_after"] = count_variants_with_five_years(cursor, 1)
        report["variants_with_5_years_market_2_after"] = count_variants_with_five_years(cursor, 2)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description="Seed five years of local variant price history for charting and prediction.")
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    args = parser.parse_args()

    report = seed_history(args.report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
