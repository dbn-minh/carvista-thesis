MARKETS = [
    {"country_code": "VN", "currency_code": "VND", "name": "Vietnam (VND)"},
    {"country_code": "US", "currency_code": "USD", "name": "United States (USD)"},
]

BOOTSTRAP_CATALOG = [
    {
        "make": "Toyota",
        "model": "Corolla Cross",
        "segment": "C-SUV",
        "variants": [
            {"year": 2023, "trim_name": "1.8V", "body_type": "suv", "fuel_type": "gasoline", "engine": "1.8L", "transmission": "CVT", "drivetrain": "FWD", "seats": 5, "doors": 5, "msrp_base": 820000000},
            {"year": 2024, "trim_name": "Hybrid Premium", "body_type": "suv", "fuel_type": "hybrid", "engine": "1.8L Hybrid", "transmission": "e-CVT", "drivetrain": "FWD", "seats": 5, "doors": 5, "msrp_base": 955000000},
        ],
    },
    {
        "make": "Toyota",
        "model": "Camry",
        "segment": "D-sedan",
        "variants": [
            {"year": 2023, "trim_name": "2.0Q", "body_type": "sedan", "fuel_type": "gasoline", "engine": "2.0L", "transmission": "AT", "drivetrain": "FWD", "seats": 5, "doors": 4, "msrp_base": 1115000000},
            {"year": 2024, "trim_name": "2.5 Hybrid", "body_type": "sedan", "fuel_type": "hybrid", "engine": "2.5L Hybrid", "transmission": "e-CVT", "drivetrain": "FWD", "seats": 5, "doors": 4, "msrp_base": 1495000000},
        ],
    },
    {
        "make": "Honda",
        "model": "Civic",
        "segment": "C-sedan",
        "variants": [
            {"year": 2023, "trim_name": "RS", "body_type": "sedan", "fuel_type": "gasoline", "engine": "1.5T", "transmission": "CVT", "drivetrain": "FWD", "seats": 5, "doors": 4, "msrp_base": 890000000},
            {"year": 2024, "trim_name": "e:HEV RS", "body_type": "sedan", "fuel_type": "hybrid", "engine": "2.0L Hybrid", "transmission": "e-CVT", "drivetrain": "FWD", "seats": 5, "doors": 4, "msrp_base": 999000000},
        ],
    },
    {
        "make": "Mazda",
        "model": "Mazda3",
        "segment": "C-sedan",
        "variants": [
            {"year": 2023, "trim_name": "Luxury", "body_type": "sedan", "fuel_type": "gasoline", "engine": "1.5L", "transmission": "AT", "drivetrain": "FWD", "seats": 5, "doors": 4, "msrp_base": 769000000},
            {"year": 2024, "trim_name": "Signature", "body_type": "sedan", "fuel_type": "gasoline", "engine": "2.0L", "transmission": "AT", "drivetrain": "FWD", "seats": 5, "doors": 4, "msrp_base": 869000000},
        ],
    },
    {
        "make": "Hyundai",
        "model": "Tucson",
        "segment": "C-SUV",
        "variants": [
            {"year": 2023, "trim_name": "1.6 Turbo", "body_type": "suv", "fuel_type": "gasoline", "engine": "1.6T", "transmission": "DCT", "drivetrain": "FWD", "seats": 5, "doors": 5, "msrp_base": 939000000},
            {"year": 2024, "trim_name": "2.0 Diesel Special", "body_type": "suv", "fuel_type": "diesel", "engine": "2.0D", "transmission": "AT", "drivetrain": "FWD", "seats": 5, "doors": 5, "msrp_base": 1039000000},
        ],
    },
    {
        "make": "Kia",
        "model": "Carnival",
        "segment": "MPV",
        "variants": [
            {"year": 2023, "trim_name": "2.2D Signature", "body_type": "mpv", "fuel_type": "diesel", "engine": "2.2D", "transmission": "AT", "drivetrain": "FWD", "seats": 7, "doors": 5, "msrp_base": 1589000000},
            {"year": 2024, "trim_name": "3.5G Signature", "body_type": "mpv", "fuel_type": "gasoline", "engine": "3.5L V6", "transmission": "AT", "drivetrain": "FWD", "seats": 7, "doors": 5, "msrp_base": 1849000000},
        ],
    },
    {
        "make": "BMW",
        "model": "X5",
        "segment": "Luxury SUV",
        "variants": [
            {"year": 2024, "trim_name": "xDrive40i", "body_type": "suv", "fuel_type": "gasoline", "engine": "3.0T", "transmission": "AT", "drivetrain": "AWD", "seats": 5, "doors": 5, "msrp_base": 3899000000},
            {"year": 2024, "trim_name": "xDrive50e", "body_type": "suv", "fuel_type": "phev", "engine": "3.0T PHEV", "transmission": "AT", "drivetrain": "AWD", "seats": 5, "doors": 5, "msrp_base": 4299000000},
        ],
    },
    {
        "make": "Mercedes-Benz",
        "model": "C-Class",
        "segment": "Premium sedan",
        "variants": [
            {"year": 2023, "trim_name": "C200 Avantgarde", "body_type": "sedan", "fuel_type": "gasoline", "engine": "1.5T", "transmission": "AT", "drivetrain": "RWD", "seats": 5, "doors": 4, "msrp_base": 1709000000},
            {"year": 2024, "trim_name": "C300 AMG Line", "body_type": "sedan", "fuel_type": "gasoline", "engine": "2.0T", "transmission": "AT", "drivetrain": "RWD", "seats": 5, "doors": 4, "msrp_base": 2099000000},
        ],
    },
    {
        "make": "Lexus",
        "model": "NX",
        "segment": "Premium C-SUV",
        "variants": [
            {"year": 2023, "trim_name": "NX250 Luxury", "body_type": "suv", "fuel_type": "gasoline", "engine": "2.5L", "transmission": "AT", "drivetrain": "FWD", "seats": 5, "doors": 5, "msrp_base": 2349000000},
            {"year": 2024, "trim_name": "NX350h Premium", "body_type": "suv", "fuel_type": "hybrid", "engine": "2.5L Hybrid", "transmission": "e-CVT", "drivetrain": "AWD", "seats": 5, "doors": 5, "msrp_base": 2789000000},
        ],
    },
    {
        "make": "VinFast",
        "model": "VF 8",
        "segment": "Electric SUV",
        "variants": [
            {"year": 2023, "trim_name": "Eco", "body_type": "suv", "fuel_type": "ev", "engine": "Dual Motor EV", "transmission": "Single-speed", "drivetrain": "AWD", "seats": 5, "doors": 5, "msrp_base": 1170000000},
            {"year": 2024, "trim_name": "Plus", "body_type": "suv", "fuel_type": "ev", "engine": "Dual Motor EV", "transmission": "Single-speed", "drivetrain": "AWD", "seats": 5, "doors": 5, "msrp_base": 1359000000},
        ],
    },
    {
        "make": "BYD",
        "model": "Seal",
        "segment": "Electric sedan",
        "variants": [
            {"year": 2024, "trim_name": "Premium", "body_type": "sedan", "fuel_type": "ev", "engine": "Single Motor EV", "transmission": "Single-speed", "drivetrain": "RWD", "seats": 5, "doors": 4, "msrp_base": 1119000000},
            {"year": 2024, "trim_name": "Performance AWD", "body_type": "sedan", "fuel_type": "ev", "engine": "Dual Motor EV", "transmission": "Single-speed", "drivetrain": "AWD", "seats": 5, "doors": 4, "msrp_base": 1369000000},
        ],
    },
]

BOOTSTRAP_TCO_PROFILES = [
    {
        "market_code": "VN",
        "name": "Vietnam passenger car baseline",
        "description": "Bootstrap tax and ownership rules for Vietnam passenger cars.",
        "rules": [
            {"cost_type": "registration_tax", "rule_kind": "rate", "rate": 0.12, "applies_to": "all"},
            {"cost_type": "vat", "rule_kind": "rate", "rate": 0.10, "applies_to": "all"},
            {"cost_type": "insurance", "rule_kind": "rate", "rate": 0.015, "applies_to": "all"},
            {"cost_type": "maintenance", "rule_kind": "formula", "formula_json": {"formula": "per_km", "rate": 1.1}, "applies_to": "all"},
            {"cost_type": "depreciation", "rule_kind": "formula", "formula_json": {"formula": "declining_balance", "rate": 0.12}, "applies_to": "all"},
        ],
    },
    {
        "market_code": "US",
        "name": "United States passenger car baseline",
        "description": "Bootstrap tax and ownership rules for US passenger cars.",
        "rules": [
            {"cost_type": "registration_tax", "rule_kind": "rate", "rate": 0.06, "applies_to": "all"},
            {"cost_type": "insurance", "rule_kind": "fixed", "fixed_amount": 1800, "applies_to": "all"},
            {"cost_type": "maintenance", "rule_kind": "formula", "formula_json": {"formula": "per_km", "rate": 0.08}, "applies_to": "all"},
            {"cost_type": "depreciation", "rule_kind": "formula", "formula_json": {"formula": "declining_balance", "rate": 0.11}, "applies_to": "all"},
        ],
    },
]
