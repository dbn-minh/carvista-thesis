import json
import random
from collections import defaultdict
from datetime import datetime, timedelta

from faker import Faker

from data.common.db import db_cursor
from data.common.schema import ensure_support_tables
from data.seed.seed_reference_data import BOOTSTRAP_CATALOG, BOOTSTRAP_TCO_PROFILES, MARKETS

RANDOM_SEED = 42
N_USERS = 18
N_LISTINGS = 48
N_CAR_REVIEWS = 42

fake = Faker("en_US")


def serialize_json_value(value):
    if value is None or isinstance(value, str):
        return value
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def reset_bootstrap_tables(cursor):
    tables_in_delete_order = [
        "data_freshness_snapshots",
        "vehicle_recall_snapshots",
        "vehicle_fuel_economy_snapshots",
        "vehicle_market_signals",
        "vehicle_market_aliases",
        "source_references",
        "notifications",
        "reports",
        "seller_reviews",
        "car_reviews",
        "viewing_requests",
        "saved_logs",
        "saved_listings",
        "watched_variants",
        "listing_price_history",
        "listing_images",
        "listings",
        "variant_price_history",
        "variant_spec_kv",
        "variant_specs",
        "variant_images",
        "car_variants",
        "car_models",
        "car_makes",
        "tco_rules",
        "tco_profiles",
        "markets",
        "users",
    ]
    cursor.execute("SET FOREIGN_KEY_CHECKS=0")
    for table in tables_in_delete_order:
        cursor.execute(f"DELETE FROM {table}")
        try:
            cursor.execute(f"ALTER TABLE {table} AUTO_INCREMENT = 1")
        except Exception:
            pass
    cursor.execute("SET FOREIGN_KEY_CHECKS=1")


def seed_markets(cursor):
    cursor.executemany(
        """
        INSERT INTO markets (country_code, currency_code, name)
        VALUES (%(country_code)s, %(currency_code)s, %(name)s)
        """,
        MARKETS,
    )


def seed_catalog(cursor):
    make_ids = {}
    model_ids = {}
    variant_ids = []

    for entry in BOOTSTRAP_CATALOG:
        if entry["make"] not in make_ids:
            cursor.execute(
                "INSERT INTO car_makes (name, country_of_origin, is_placeholder) VALUES (%s,%s,%s)",
                (entry["make"], None, False),
            )
            make_ids[entry["make"]] = cursor.lastrowid

        if (entry["make"], entry["model"]) not in model_ids:
            cursor.execute(
                "INSERT INTO car_models (make_id, name, segment, is_placeholder) VALUES (%s,%s,%s,%s)",
                (make_ids[entry["make"]], entry["model"], entry["segment"], False),
            )
            model_ids[(entry["make"], entry["model"])] = cursor.lastrowid

        for variant in entry["variants"]:
            cursor.execute(
                """
                INSERT INTO car_variants
                  (model_id, model_year, trim_name, body_type, engine, transmission, drivetrain, fuel_type, seats, doors, msrp_base, is_placeholder)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    model_ids[(entry["make"], entry["model"])],
                    variant["year"],
                    variant["trim_name"],
                    variant["body_type"],
                    variant["engine"],
                    variant["transmission"],
                    variant["drivetrain"],
                    variant["fuel_type"],
                    variant["seats"],
                    variant["doors"],
                    variant["msrp_base"],
                    False,
                ),
            )
            variant_id = cursor.lastrowid
            variant_ids.append(variant_id)
            cursor.execute(
                """
                INSERT INTO variant_specs
                  (variant_id, power_hp, torque_nm, displacement_cc, length_mm, width_mm, height_mm, wheelbase_mm, curb_weight_kg, battery_kwh, range_km)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    variant_id,
                    random.randint(140, 380),
                    random.randint(220, 520),
                    random.choice([1498, 1798, 1998, 2998]) if variant["fuel_type"] != "ev" else None,
                    random.randint(4450, 5000),
                    random.randint(1780, 1930),
                    random.randint(1450, 1750),
                    random.randint(2600, 2980),
                    random.randint(1250, 2200),
                    random.choice([55, 75]) if variant["fuel_type"] == "ev" else None,
                    random.randint(350, 520) if variant["fuel_type"] == "ev" else None,
                ),
            )
    return variant_ids


def seed_tco_profiles(cursor):
    cursor.execute("SELECT market_id, country_code FROM markets")
    markets = {country_code: market_id for market_id, country_code in cursor.fetchall()}

    for profile in BOOTSTRAP_TCO_PROFILES:
        market_id = markets[profile["market_code"]]
        cursor.execute(
            "INSERT INTO tco_profiles (market_id, name, description) VALUES (%s,%s,%s)",
            (market_id, profile["name"], profile["description"]),
        )
        profile_id = cursor.lastrowid
        for rule in profile["rules"]:
            cursor.execute(
                """
                INSERT INTO tco_rules (profile_id, cost_type, rule_kind, rate, fixed_amount, formula_json, applies_to)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    profile_id,
                    rule["cost_type"],
                    rule["rule_kind"],
                    rule.get("rate"),
                    rule.get("fixed_amount"),
                    serialize_json_value(rule.get("formula_json")),
                    rule.get("applies_to", "all"),
                ),
            )


def seed_users(cursor):
    user_ids = []
    for _ in range(N_USERS):
        cursor.execute(
            """
            INSERT INTO users (name, email, phone, password_hash, role)
            VALUES (%s,%s,%s,%s,%s)
            """,
            (
                fake.name(),
                fake.unique.email(),
                fake.numerify(text="0#########"),
                "dev_seed_password_hash",
                "user",
            ),
        )
        user_ids.append(cursor.lastrowid)
    return user_ids


def seed_listings(cursor, user_ids, variant_ids):
    listing_records = []
    now = datetime.utcnow()
    cursor.execute("SELECT variant_id, model_year, msrp_base FROM car_variants")
    variant_rows = {
        variant_id: {"model_year": model_year, "msrp_base": float(msrp_base or 0)}
        for variant_id, model_year, msrp_base in cursor.fetchall()
    }
    listing_total = max(N_LISTINGS, len(variant_ids) * 3)
    variant_pool = (variant_ids * ((listing_total // max(len(variant_ids), 1)) + 1))[:listing_total]
    random.shuffle(variant_pool)

    for variant_id in variant_pool:
        owner_id = random.choice(user_ids)
        variant_meta = variant_rows.get(variant_id, {})
        msrp_base = float(variant_meta.get("msrp_base") or 0)
        model_year = int(variant_meta.get("model_year") or now.year)
        age_years = max(now.year - model_year, 0)
        base_ratio = random.uniform(max(0.72, 0.94 - age_years * 0.05), min(1.03, 0.99 - age_years * 0.02))
        asking_price = max(250_000_000, round(msrp_base * base_ratio / 1_000) * 1_000) if msrp_base else random.choice([780000000, 915000000, 985000000, 1250000000, 3980000000])
        mileage = random.randint(6_000 + age_years * 8_000, 38_000 + age_years * 24_000)
        country = random.choice(["VN", "US"])
        created_at = now - timedelta(days=random.randint(12, 220))
        cursor.execute(
            """
            INSERT INTO listings
              (owner_id, variant_id, asking_price, mileage_km, location_city, location_country_code, status, description, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                owner_id,
                variant_id,
                asking_price,
                mileage,
                fake.city(),
                country,
                "active",
                fake.paragraph(nb_sentences=2),
                created_at,
                now,
            ),
        )
        listing_id = cursor.lastrowid
        image_count = random.randint(2, 5)
        for sort_order in range(image_count):
            cursor.execute(
                "INSERT INTO listing_images (listing_id, url, sort_order) VALUES (%s,%s,%s)",
                (listing_id, fake.image_url(), sort_order),
            )

        starting_price = round(asking_price * random.uniform(1.03, 1.12) / 1_000) * 1_000
        history_points = random.randint(2, 4)
        max_age_days = max((now - created_at).days, history_points + 2)
        for step in range(history_points):
            fraction = (step + 1) / history_points
            changed_at = created_at + timedelta(days=max(1, int(max_age_days * fraction)))
            if changed_at > now:
                changed_at = now - timedelta(days=random.randint(0, 2))
            price = asking_price if step == history_points - 1 else round((starting_price - (starting_price - asking_price) * fraction) / 1_000) * 1_000
            cursor.execute(
                """
                INSERT INTO listing_price_history (listing_id, price, changed_at, note)
                VALUES (%s,%s,%s,%s)
                """,
                (
                    listing_id,
                    price,
                    changed_at,
                    "Bootstrap market history point",
                ),
            )

        listing_records.append(
            {
                "listing_id": listing_id,
                "variant_id": variant_id,
                "country_code": country,
                "asking_price": asking_price,
                "created_at": created_at,
            }
        )
    return listing_records


def seed_variant_price_history(cursor, listing_records):
    cursor.execute("SELECT market_id, country_code FROM markets")
    market_map = {country_code: market_id for market_id, country_code in cursor.fetchall()}
    grouped_prices = defaultdict(list)

    for row in listing_records:
        grouped_prices[(row["variant_id"], row["country_code"])].append(float(row["asking_price"]))

    now = datetime.utcnow()
    first_of_month = datetime(now.year, now.month, 1)

    for (variant_id, country_code), prices in grouped_prices.items():
        market_id = market_map.get(country_code)
        if market_id is None:
            continue
        average_price = sum(prices) / len(prices)
        for months_back, multiplier in [(2, 1.04), (1, 1.02), (0, 1.0)]:
            captured_at = first_of_month - timedelta(days=30 * months_back)
            price = round(average_price * multiplier / 1_000) * 1_000
            cursor.execute(
                """
                INSERT INTO variant_price_history (variant_id, market_id, price_type, price, captured_at, source)
                VALUES (%s,%s,%s,%s,%s,%s)
                """,
                (
                    variant_id,
                    market_id,
                    "avg_market",
                    price,
                    captured_at,
                    "bootstrap_seed_rollup",
                ),
            )


def seed_reviews(cursor, user_ids, variant_ids):
    review_pairs = [(user_id, variant_id) for user_id in user_ids for variant_id in variant_ids]
    random.shuffle(review_pairs)

    for user_id, variant_id in review_pairs[: min(N_CAR_REVIEWS, len(review_pairs))]:
        cursor.execute(
            """
            INSERT INTO car_reviews (user_id, variant_id, rating, title, comment)
            VALUES (%s,%s,%s,%s,%s)
            """,
            (
                user_id,
                variant_id,
                random.randint(3, 5),
                random.choice(["Solid daily driver", "Worth a test drive", "Feels premium"]),
                fake.paragraph(nb_sentences=2),
            ),
        )


def main():
    random.seed(RANDOM_SEED)
    Faker.seed(RANDOM_SEED)

    with db_cursor() as (_conn, cursor):
        ensure_support_tables(cursor)
        reset_bootstrap_tables(cursor)
        seed_markets(cursor)
        variant_ids = seed_catalog(cursor)
        seed_tco_profiles(cursor)
        user_ids = seed_users(cursor)
        listing_records = seed_listings(cursor, user_ids, variant_ids)
        seed_variant_price_history(cursor, listing_records)
        seed_reviews(cursor, user_ids, variant_ids)
        print("Bootstrap seed completed.")


if __name__ == "__main__":
    main()
