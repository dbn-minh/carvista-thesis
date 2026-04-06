from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
PLACEHOLDER_PREFIX = "/placeholders/catalog"
FX_VND_PER_USD = Decimal("24500")
HISTORY_SOURCE = "local_seed_history_v1"

BODY_PLACEHOLDERS = {
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

EXOTIC_MAKES = {
    "Ferrari",
    "Lamborghini",
    "McLaren",
    "Porsche",
    "Aston Martin",
}

PREMIUM_PERFORMANCE_KEYS = {
    ("Audi", "R8"),
    ("BMW", "M4"),
    ("Mercedes-Benz", "AMG GT"),
    ("Nissan", "GT-R"),
    ("Chevrolet", "Corvette"),
    ("Lexus", "LC"),
}

PREMIUM_MAKES = {
    "Audi",
    "BMW",
    "Genesis",
    "Infiniti",
    "Jaguar",
    "Land Rover",
    "Lexus",
    "Lincoln",
    "Mercedes-Benz",
    "Mini",
    "Porsche",
    "Volvo",
}

VN_LOCATIONS = [
    ("HCMC", "VN"),
    ("Hanoi", "VN"),
    ("Da Nang", "VN"),
    ("Hai Phong", "VN"),
    ("Can Tho", "VN"),
    ("Nha Trang", "VN"),
    ("Bien Hoa", "VN"),
    ("Binh Duong", "VN"),
    ("Vung Tau", "VN"),
    ("Hue", "VN"),
]

DEALER_OWNER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
PRIVATE_OWNER_IDS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
PREMIUM_OWNER_IDS = [3, 7, 10]


@dataclass
class VariantContext:
    variant_id: int
    make_name: str
    model_name: str
    model_year: int
    trim_name: str
    body_type: str | None
    fuel_type: str | None
    transmission: str | None
    drivetrain: str | None
    engine: str | None
    seats: int | None
    doors: int | None
    msrp_base: Decimal | None
    power_hp: int | None = None
    displacement_cc: int | None = None

    @property
    def natural_label(self) -> str:
        parts = [
            str(self.model_year) if self.model_year else None,
            self.make_name,
            self.model_name,
            self.trim_name,
        ]
        return " ".join(part for part in parts if part)


def clean_text(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def decimal_or_none(value) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    text = clean_text(value)
    if not text:
        return None
    return Decimal(str(text))


def int_or_none(value) -> int | None:
    text = clean_text(value)
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def round_currency(value: Decimal | float | int | None, market_id: int) -> Decimal | None:
    if value is None:
        return None
    amount = value if isinstance(value, Decimal) else Decimal(str(value))
    quantum = Decimal("1000") if market_id == 1 else Decimal("10")
    return amount.quantize(quantum, rounding=ROUND_HALF_UP)


def deterministic_fraction(key: str) -> Decimal:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
    numerator = int(digest, 16)
    denominator = Decimal(16 ** 16 - 1)
    return Decimal(numerator) / denominator


def deterministic_choice(items: list, key: str):
    if not items:
        raise ValueError("Cannot choose from empty collection")
    index = int(deterministic_fraction(key) * len(items)) % len(items)
    return items[index]


def deterministic_range(key: str, minimum: Decimal | float | int, maximum: Decimal | float | int) -> Decimal:
    lower = minimum if isinstance(minimum, Decimal) else Decimal(str(minimum))
    upper = maximum if isinstance(maximum, Decimal) else Decimal(str(maximum))
    if upper <= lower:
        return lower
    return lower + (upper - lower) * deterministic_fraction(key)


def is_vnd_scale(amount: Decimal | None) -> bool:
    return amount is not None and amount >= Decimal("100000000")


def convert_msrp_to_market_currency(msrp_base: Decimal | None, market_id: int) -> Decimal | None:
    if msrp_base is None or msrp_base <= 0:
        return None
    if market_id == 1:
        return msrp_base if is_vnd_scale(msrp_base) else msrp_base * FX_VND_PER_USD
    if market_id == 2:
        return msrp_base / FX_VND_PER_USD if is_vnd_scale(msrp_base) else msrp_base
    return msrp_base


def body_floor_price(market_id: int, body_type: str | None) -> Decimal:
    return tier_body_floor_price(market_id, body_type, tier="mainstream", age=0)


def market_tier(variant: VariantContext, market_id: int = 1) -> str:
    anchor_local = convert_msrp_to_market_currency(variant.msrp_base, market_id)
    if variant.make_name in EXOTIC_MAKES:
        return "exotic"
    if (variant.make_name, variant.model_name) in PREMIUM_PERFORMANCE_KEYS:
        return "performance"
    if (variant.power_hp or 0) >= 520:
        return "performance"
    if variant.make_name in PREMIUM_MAKES:
        return "premium"
    if anchor_local is not None and anchor_local >= Decimal("1800000000"):
        return "premium"
    return "mainstream"


def tier_body_floor_price(market_id: int, body_type: str | None, *, tier: str, age: int) -> Decimal:
    body_key = body_type or "other"
    floors_vnd = {
        "mainstream": {
            "sedan": Decimal("220000000"),
            "hatchback": Decimal("190000000"),
            "suv": Decimal("380000000"),
            "cuv": Decimal("340000000"),
            "mpv": Decimal("460000000"),
            "pickup": Decimal("480000000"),
            "coupe": Decimal("1500000000"),
            "convertible": Decimal("2100000000"),
            "wagon": Decimal("320000000"),
            "van": Decimal("520000000"),
            "other": Decimal("250000000"),
        },
        "premium": {
            "sedan": Decimal("450000000"),
            "hatchback": Decimal("360000000"),
            "suv": Decimal("820000000"),
            "cuv": Decimal("760000000"),
            "mpv": Decimal("980000000"),
            "pickup": Decimal("920000000"),
            "coupe": Decimal("1800000000"),
            "convertible": Decimal("2400000000"),
            "wagon": Decimal("620000000"),
            "van": Decimal("1050000000"),
            "other": Decimal("420000000"),
        },
        "performance": {
            "sedan": Decimal("980000000"),
            "hatchback": Decimal("760000000"),
            "suv": Decimal("1800000000"),
            "cuv": Decimal("1650000000"),
            "mpv": Decimal("1450000000"),
            "pickup": Decimal("1600000000"),
            "coupe": Decimal("2800000000"),
            "convertible": Decimal("3600000000"),
            "wagon": Decimal("1200000000"),
            "van": Decimal("1400000000"),
            "other": Decimal("950000000"),
        },
        "exotic": {
            "sedan": Decimal("2600000000"),
            "hatchback": Decimal("2200000000"),
            "suv": Decimal("8500000000"),
            "cuv": Decimal("7200000000"),
            "mpv": Decimal("3600000000"),
            "pickup": Decimal("3400000000"),
            "coupe": Decimal("7000000000"),
            "convertible": Decimal("8400000000"),
            "wagon": Decimal("3000000000"),
            "van": Decimal("3200000000"),
            "other": Decimal("2800000000"),
        },
    }
    age_factor_map = {
        "mainstream": Decimal("1.00") if age <= 8 else Decimal("0.92"),
        "premium": Decimal("1.00") if age <= 5 else Decimal("0.88") if age <= 10 else Decimal("0.74"),
        "performance": Decimal("1.00") if age <= 6 else Decimal("0.90") if age <= 10 else Decimal("0.78"),
        "exotic": Decimal("1.00") if age <= 6 else Decimal("0.94") if age <= 10 else Decimal("0.86"),
    }
    tier_floors = floors_vnd.get(tier, floors_vnd["mainstream"])
    base = tier_floors.get(body_key, tier_floors["other"]) * age_factor_map.get(tier, Decimal("1.00"))
    return base if market_id == 1 else base / FX_VND_PER_USD


def variant_is_exotic(variant: VariantContext) -> bool:
    if variant.make_name in EXOTIC_MAKES:
        return True
    return (variant.make_name, variant.model_name) in PREMIUM_PERFORMANCE_KEYS


def price_anchor_looks_like_new_msrp(anchor_local: Decimal, variant: VariantContext, market_id: int = 1) -> bool:
    thresholds_vnd = {
        "mainstream": Decimal("1400000000"),
        "premium": Decimal("2500000000"),
        "performance": Decimal("3800000000"),
        "exotic": Decimal("6500000000"),
    }
    tier = market_tier(variant, market_id)
    threshold = thresholds_vnd[tier]
    threshold = threshold if market_id == 1 else threshold / FX_VND_PER_USD
    return anchor_local >= threshold


def compute_current_market_value(variant: VariantContext, market_id: int = 1) -> Decimal:
    today_year = datetime.utcnow().year
    age = max(0, today_year - int(variant.model_year or today_year))
    anchor_local = convert_msrp_to_market_currency(variant.msrp_base, market_id)
    tier = market_tier(variant, market_id)
    floor = tier_body_floor_price(market_id, variant.body_type, tier=tier, age=age)

    if age <= 1:
        retention = Decimal("0.88")
    elif age <= 2:
        retention = Decimal("0.80")
    elif age <= 4:
        retention = Decimal("0.70")
    elif age <= 6:
        retention = Decimal("0.58")
    elif age <= 10:
        retention = Decimal("0.46")
    else:
        retention = Decimal("0.34")

    if variant.fuel_type == "ev":
        retention -= Decimal("0.06")
    elif variant.fuel_type in {"hybrid", "phev"}:
        retention += Decimal("0.02")

    if variant.body_type in {"pickup", "suv", "mpv"}:
        retention += Decimal("0.03")

    if tier == "premium":
        retention += Decimal("0.04")
    elif tier == "performance":
        retention += Decimal("0.06")

    if variant_is_exotic(variant):
        retention += Decimal("0.07")

    retention = max(Decimal("0.22"), min(Decimal("0.93"), retention))

    if anchor_local is None:
        return floor

    if price_anchor_looks_like_new_msrp(anchor_local, variant, market_id):
        current_value = anchor_local * retention
    else:
        uplift_map = {
            "mainstream": Decimal("1.00"),
            "premium": Decimal("1.18"),
            "performance": Decimal("1.24"),
            "exotic": Decimal("1.08"),
        }
        current_value = anchor_local * uplift_map[tier]

    return max(current_value, floor)


def compute_history_decline_rate(variant: VariantContext) -> Decimal:
    today_year = datetime.utcnow().year
    age = max(0, today_year - int(variant.model_year or today_year))

    if age <= 1:
        annual = Decimal("0.11")
    elif age <= 3:
        annual = Decimal("0.09")
    elif age <= 5:
        annual = Decimal("0.075")
    elif age <= 8:
        annual = Decimal("0.06")
    else:
        annual = Decimal("0.045")

    if variant.fuel_type == "ev":
        annual += Decimal("0.025")
    elif variant.fuel_type in {"hybrid", "phev"}:
        annual -= Decimal("0.005")

    if variant.body_type in {"pickup", "suv", "mpv"}:
        annual -= Decimal("0.01")

    if variant_is_exotic(variant):
        annual -= Decimal("0.02")

    return max(Decimal("0.025"), min(Decimal("0.14"), annual))


def choose_placeholder_url(body_type: str | None, fuel_type: str | None) -> str:
    if fuel_type == "ev":
        slug = "ev"
    else:
        slug = BODY_PLACEHOLDERS.get(body_type or "other", "generic")
    return f"{PLACEHOLDER_PREFIX}/{slug}.svg"


def get_or_create_make(cursor, name: str, country_of_origin: str | None = None, is_placeholder: bool = False):
    cursor.execute("SELECT * FROM car_makes WHERE LOWER(name) = LOWER(%s) LIMIT 1", (name,))
    row = cursor.fetchone()
    if row:
        updates = {}
        if country_of_origin and not clean_text(row.get("country_of_origin")):
            updates["country_of_origin"] = country_of_origin
        if row.get("is_placeholder") and not is_placeholder:
            updates["is_placeholder"] = 0
        if updates:
            sets = ", ".join(f"{column} = %s" for column in updates)
            params = list(updates.values()) + [row["make_id"]]
            cursor.execute(f"UPDATE car_makes SET {sets} WHERE make_id = %s", params)
        return row["make_id"], False

    cursor.execute(
        """
        INSERT INTO car_makes (name, country_of_origin, is_placeholder, created_at)
        VALUES (%s, %s, %s, NOW())
        """,
        (name, country_of_origin, 1 if is_placeholder else 0),
    )
    return cursor.lastrowid, True


def get_or_create_model(cursor, make_id: int, name: str, segment: str | None = None, is_placeholder: bool = False):
    cursor.execute(
        "SELECT * FROM car_models WHERE make_id = %s AND LOWER(name) = LOWER(%s) LIMIT 1",
        (make_id, name),
    )
    row = cursor.fetchone()
    if row:
        updates = {}
        if segment and not clean_text(row.get("segment")):
            updates["segment"] = segment
        if row.get("is_placeholder") and not is_placeholder:
            updates["is_placeholder"] = 0
        if updates:
            sets = ", ".join(f"{column} = %s" for column in updates)
            params = list(updates.values()) + [row["model_id"]]
            cursor.execute(f"UPDATE car_models SET {sets} WHERE model_id = %s", params)
        return row["model_id"], False

    cursor.execute(
        """
        INSERT INTO car_models (make_id, name, segment, is_placeholder, created_at)
        VALUES (%s, %s, %s, %s, NOW())
        """,
        (make_id, name, segment, 1 if is_placeholder else 0),
    )
    return cursor.lastrowid, True


def get_or_create_variant(cursor, *, model_id: int, model_year: int, trim_name: str, body_type: str,
                          engine: str | None, transmission: str | None, drivetrain: str | None,
                          fuel_type: str, seats: int | None, doors: int | None,
                          msrp_base: Decimal | None, is_placeholder: bool = False):
    cursor.execute(
        """
        SELECT *
        FROM car_variants
        WHERE model_id = %s AND model_year = %s AND LOWER(trim_name) = LOWER(%s)
        LIMIT 1
        """,
        (model_id, model_year, trim_name),
    )
    row = cursor.fetchone()
    if row:
        updates = {}
        fillable = {
            "body_type": body_type,
            "engine": engine,
            "transmission": transmission,
            "drivetrain": drivetrain,
            "fuel_type": fuel_type,
            "seats": seats,
            "doors": doors,
            "msrp_base": msrp_base,
        }
        for column, value in fillable.items():
            current = row.get(column)
            if value is None:
                continue
            if column in {"body_type", "fuel_type"}:
                if current in {None, "", "other"}:
                    updates[column] = value
            elif column == "msrp_base":
                if current is None:
                    updates[column] = str(value)
            else:
                if current in {None, ""}:
                    updates[column] = value
        if row.get("is_placeholder") and not is_placeholder:
            updates["is_placeholder"] = 0
        if updates:
            sets = ", ".join(f"{column} = %s" for column in updates)
            params = list(updates.values()) + [row["variant_id"]]
            cursor.execute(f"UPDATE car_variants SET {sets}, updated_at = NOW() WHERE variant_id = %s", params)
        return row["variant_id"], False

    cursor.execute(
        """
        INSERT INTO car_variants (
          model_id, model_year, trim_name, body_type, engine, transmission, drivetrain,
          fuel_type, seats, doors, msrp_base, is_placeholder, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """,
        (
            model_id,
            model_year,
            trim_name,
            body_type,
            engine,
            transmission,
            drivetrain,
            fuel_type,
            seats,
            doors,
            str(msrp_base) if msrp_base is not None else None,
            1 if is_placeholder else 0,
        ),
    )
    return cursor.lastrowid, True


def ensure_variant_specs(cursor, variant_id: int, *, power_hp: int | None = None, torque_nm: int | None = None,
                         displacement_cc: int | None = None, length_mm: int | None = None,
                         width_mm: int | None = None, height_mm: int | None = None,
                         wheelbase_mm: int | None = None, curb_weight_kg: int | None = None,
                         battery_kwh: Decimal | None = None, range_km: int | None = None):
    cursor.execute("SELECT * FROM variant_specs WHERE variant_id = %s LIMIT 1", (variant_id,))
    row = cursor.fetchone()
    fields = {
        "power_hp": power_hp,
        "torque_nm": torque_nm,
        "displacement_cc": displacement_cc,
        "length_mm": length_mm,
        "width_mm": width_mm,
        "height_mm": height_mm,
        "wheelbase_mm": wheelbase_mm,
        "curb_weight_kg": curb_weight_kg,
        "battery_kwh": str(battery_kwh) if battery_kwh is not None else None,
        "range_km": range_km,
    }

    if row:
        updates = {}
        for column, value in fields.items():
            if value is None:
                continue
            if row.get(column) in {None, ""}:
                updates[column] = value
        if updates:
            sets = ", ".join(f"{column} = %s" for column in updates)
            params = list(updates.values()) + [variant_id]
            cursor.execute(f"UPDATE variant_specs SET {sets} WHERE variant_id = %s", params)
        return False

    cursor.execute(
        """
        INSERT INTO variant_specs (
          variant_id, power_hp, torque_nm, displacement_cc, length_mm, width_mm, height_mm,
          wheelbase_mm, curb_weight_kg, battery_kwh, range_km
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            variant_id,
            power_hp,
            torque_nm,
            displacement_cc,
            length_mm,
            width_mm,
            height_mm,
            wheelbase_mm,
            curb_weight_kg,
            str(battery_kwh) if battery_kwh is not None else None,
            range_km,
        ),
    )
    return True


def ensure_placeholder_image(cursor, variant_id: int, body_type: str | None, fuel_type: str | None):
    url = choose_placeholder_url(body_type, fuel_type)
    cursor.execute("SELECT image_id, url FROM variant_images WHERE variant_id = %s ORDER BY sort_order ASC, image_id ASC", (variant_id,))
    rows = cursor.fetchall()
    if any(clean_text(row.get("url")) == url for row in rows):
        return False
    if rows:
        return False
    cursor.execute(
        "INSERT INTO variant_images (variant_id, url, sort_order) VALUES (%s, %s, 0)",
        (variant_id, url),
    )
    return True


def load_variant_rows(cursor, *, include_listing_counts: bool = False) -> list[VariantContext]:
    if include_listing_counts:
        extra = ", COUNT(l.listing_id) AS listing_count"
        join = "LEFT JOIN listings l ON l.variant_id = cv.variant_id"
        group = """
        GROUP BY
          cv.variant_id, mk.name, cm.name, cv.model_year, cv.trim_name, cv.body_type, cv.fuel_type,
          cv.transmission, cv.drivetrain, cv.engine, cv.seats, cv.doors, cv.msrp_base, vs.power_hp, vs.displacement_cc
        """
    else:
        extra = ""
        join = ""
        group = ""

    cursor.execute(
        f"""
        SELECT
          cv.variant_id,
          mk.name AS make_name,
          cm.name AS model_name,
          cv.model_year,
          cv.trim_name,
          cv.body_type,
          cv.fuel_type,
          cv.transmission,
          cv.drivetrain,
          cv.engine,
          cv.seats,
          cv.doors,
          cv.msrp_base,
          vs.power_hp,
          vs.displacement_cc
          {extra}
        FROM car_variants cv
        JOIN car_models cm ON cm.model_id = cv.model_id
        JOIN car_makes mk ON mk.make_id = cm.make_id
        LEFT JOIN variant_specs vs ON vs.variant_id = cv.variant_id
        {join}
        {group}
        ORDER BY mk.name, cm.name, cv.model_year DESC, cv.trim_name
        """
    )
    rows = []
    for row in cursor.fetchall():
        rows.append(
            VariantContext(
                variant_id=int(row["variant_id"]),
                make_name=row["make_name"],
                model_name=row["model_name"],
                model_year=int(row["model_year"]),
                trim_name=row["trim_name"],
                body_type=clean_text(row["body_type"]),
                fuel_type=clean_text(row["fuel_type"]),
                transmission=clean_text(row["transmission"]),
                drivetrain=clean_text(row["drivetrain"]),
                engine=clean_text(row["engine"]),
                seats=int_or_none(row["seats"]),
                doors=int_or_none(row["doors"]),
                msrp_base=decimal_or_none(row["msrp_base"]),
                power_hp=int_or_none(row.get("power_hp")),
                displacement_cc=int_or_none(row.get("displacement_cc")),
            )
        )
    return rows


def pick_location(variant: VariantContext, slot: int = 0):
    category_key = f"{variant.variant_id}:{slot}:location"
    return deterministic_choice(VN_LOCATIONS, category_key)


def pick_owner_id(variant: VariantContext, slot: int = 0) -> int:
    key = f"{variant.variant_id}:{slot}:owner"
    if variant_is_exotic(variant):
        return deterministic_choice(PREMIUM_OWNER_IDS, key)
    if variant.model_year >= datetime.utcnow().year - 3:
        return deterministic_choice(DEALER_OWNER_IDS, key)
    if deterministic_fraction(key) > Decimal("0.72"):
        return deterministic_choice(PRIVATE_OWNER_IDS, key)
    return deterministic_choice(DEALER_OWNER_IDS, key)


def build_listing_description(variant: VariantContext, slot: int = 0) -> str:
    lead_templates = [
        "Well-kept {vehicle} with transparent paperwork and a straightforward viewing process.",
        "Clean-condition {vehicle} with a practical spec mix and ready-to-view availability this week.",
        "Well-presented {vehicle} with a tidy cabin, honest walk-around notes, and flexible appointment times.",
        "Carefully maintained {vehicle} that suits buyers looking for a realistic used-market option without guesswork.",
    ]
    detail_templates = {
        "sedan": "Smooth for city use, comfortable for daily commutes, and easy to inspect in person.",
        "hatchback": "Compact enough for daily city driving while still offering practical cargo space.",
        "suv": "Family-friendly cabin layout, easy step-in height, and confidence for longer weekend trips.",
        "cuv": "Balanced crossover shape with practical ground clearance and everyday usability.",
        "mpv": "People-moving layout with flexible seating and sensible family-car practicality.",
        "pickup": "Useful bed space, working-truck posture, and enough comfort for mixed work and daily use.",
        "coupe": "Driver-focused character with premium presence and cleaner-condition enthusiast appeal.",
        "convertible": "Weekend-car energy with a more special open-air feel and carefully presented condition.",
        "wagon": "Useful luggage room with a lower driving stance for mixed family and commuting use.",
        "van": "Commercial-friendly shape with straightforward cargo or passenger utility.",
        "other": "Balanced used-car option with serviceable daily usability.",
    }
    close_templates = [
        "Seller is open to scheduled viewings, video walk-arounds, and direct follow-up for serious buyers.",
        "Ideal for buyers who want a grounded listing with clear next steps before arranging a viewing.",
        "Paperwork, ownership discussion, and test-drive coordination can be arranged after initial contact.",
    ]
    vehicle = variant.natural_label
    lead = deterministic_choice(lead_templates, f"{variant.variant_id}:{slot}:lead").format(vehicle=vehicle)
    detail = detail_templates.get(variant.body_type or "other", detail_templates["other"])
    close = deterministic_choice(close_templates, f"{variant.variant_id}:{slot}:close")
    return " ".join([lead, detail, close])


def compute_listing_mileage(variant: VariantContext, slot: int = 0) -> int:
    age = max(0, datetime.utcnow().year - variant.model_year)
    yearly_km = Decimal("12000")
    tier = market_tier(variant)
    if variant.body_type in {"suv", "mpv", "pickup"}:
        yearly_km += Decimal("2500")
    if tier == "premium":
        yearly_km -= Decimal("1500")
    if tier == "performance":
        yearly_km = Decimal("6500")
    if variant_is_exotic(variant):
        yearly_km = Decimal("4500")
    if variant.fuel_type == "ev":
        yearly_km -= Decimal("1500")

    base = yearly_km * max(age, 1)
    jitter = deterministic_range(f"{variant.variant_id}:{slot}:km", Decimal("-0.18"), Decimal("0.22"))
    mileage = base * (Decimal("1") + jitter)
    return max(3500, int(mileage.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))


def compute_listing_price(variant: VariantContext, slot: int = 0, mileage_km: int | None = None) -> Decimal:
    current_value = compute_current_market_value(variant, market_id=1)
    age = max(0, datetime.utcnow().year - variant.model_year)
    mileage = mileage_km if mileage_km is not None else compute_listing_mileage(variant, slot)
    tier = market_tier(variant)

    price = current_value
    if mileage > 0:
        divisor_map = {
            "mainstream": Decimal("7000000"),
            "premium": Decimal("9500000"),
            "performance": Decimal("14000000"),
            "exotic": Decimal("24000000"),
        }
        floor_map = {
            "mainstream": Decimal("0.78"),
            "premium": Decimal("0.84"),
            "performance": Decimal("0.90"),
            "exotic": Decimal("0.94"),
        }
        km_penalty = Decimal(mileage) / divisor_map[tier]
        price *= max(floor_map[tier], Decimal("1") - km_penalty)

    tuning_map = {
        "mainstream": (Decimal("0.95"), Decimal("1.08")),
        "premium": (Decimal("0.98"), Decimal("1.12")),
        "performance": (Decimal("1.00"), Decimal("1.14")),
        "exotic": (Decimal("1.03"), Decimal("1.18")),
    }
    tuning_min, tuning_max = tuning_map[tier]
    market_tuning = deterministic_range(f"{variant.variant_id}:{slot}:price", tuning_min, tuning_max)
    price *= market_tuning

    if age <= 1:
        price *= Decimal("1.03")

    floor = tier_body_floor_price(1, variant.body_type, tier=tier, age=age)
    return round_currency(max(price, floor), 1) or Decimal("0")


def listing_signature(owner_id: int, variant: VariantContext, location_city: str, location_country_code: str,
                      asking_price: Decimal, mileage_km: int) -> tuple:
    return (
        owner_id,
        variant.variant_id,
        location_city,
        location_country_code,
        str(asking_price),
        mileage_km,
    )


def listing_exists(cursor, signature: tuple) -> bool:
    cursor.execute(
        """
        SELECT listing_id
        FROM listings
        WHERE owner_id = %s
          AND variant_id = %s
          AND location_city = %s
          AND location_country_code = %s
          AND asking_price = %s
          AND mileage_km = %s
        LIMIT 1
        """,
        signature,
    )
    return cursor.fetchone() is not None


def insert_listing(cursor, *, owner_id: int, variant: VariantContext, location_city: str,
                   location_country_code: str, asking_price: Decimal, mileage_km: int,
                   description: str, status: str = "active") -> int:
    cursor.execute(
        """
        INSERT INTO listings (
          owner_id, variant_id, asking_price, mileage_km, location_city, location_country_code,
          status, description, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """,
        (
            owner_id,
            variant.variant_id,
            str(asking_price),
            mileage_km,
            location_city,
            location_country_code,
            status,
            description,
        ),
    )
    return cursor.lastrowid


def count_existing_history_points(cursor, variant_id: int, market_id: int, source: str = HISTORY_SOURCE) -> int:
    cursor.execute(
        """
        SELECT COUNT(*) AS c
        FROM variant_price_history
        WHERE variant_id = %s AND market_id = %s AND price_type = 'avg_market' AND source = %s
        """,
        (variant_id, market_id, source),
    )
    return int(cursor.fetchone()["c"])


def iter_month_starts(months_back: int = 60) -> Iterable[date]:
    today = datetime.utcnow().date().replace(day=1)
    year = today.year
    month = today.month
    for offset in range(months_back, -1, -1):
        y = year
        m = month - offset
        while m <= 0:
            y -= 1
            m += 12
        while m > 12:
            y += 1
            m -= 12
        yield date(y, m, 1)
