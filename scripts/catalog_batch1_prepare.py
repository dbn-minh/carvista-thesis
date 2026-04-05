from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Iterable

import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = Path(
    r"C:/Users/nhatm/OneDrive - SYSTEMS VIET NAM/University Study/Thesis/Datasets/car_prices.csv"
)
DOCS_DIR = REPO_ROOT / "docs"
DATA_DIR = REPO_ROOT / "data"

ANALYSIS_DOC = DOCS_DIR / "catalog-batch1-analysis.md"
MAPPING_DOC = DOCS_DIR / "catalog-batch1-mapping.md"
REVIEW_DOC = DOCS_DIR / "catalog-batch1-review-notes.md"
NORMALIZED_CSV = DATA_DIR / "normalized_catalog_seed.csv"
SELECTED_CSV = DATA_DIR / "selected_50_models.csv"

CORE_ENRICHMENT_FIELDS = ["engine", "drivetrain", "fuel_type", "seats", "doors"]
RAW_COLUMNS = [
    "year",
    "make",
    "model",
    "trim",
    "body",
    "transmission",
    "vin",
    "state",
    "condition",
    "odometer",
    "color",
    "interior",
    "seller",
    "mmr",
    "sellingprice",
    "saledate",
]

BODY_NORMALIZATION_MAP = {
    "sedan": "sedan",
    "g sedan": "sedan",
    "suv": "suv",
    "sport utility vehicle": "suv",
    "cuv": "cuv",
    "crossover": "cuv",
    "hatchback": "hatchback",
    "wagon": "wagon",
    "tsx sport wagon": "wagon",
    "cts wagon": "wagon",
    "cts-v wagon": "wagon",
    "coupe": "coupe",
    "g coupe": "coupe",
    "g37 coupe": "coupe",
    "q60 coupe": "coupe",
    "cts coupe": "coupe",
    "cts-v coupe": "coupe",
    "genesis coupe": "coupe",
    "elantra coupe": "coupe",
    "koup": "coupe",
    "convertible": "convertible",
    "beetle convertible": "convertible",
    "g convertible": "convertible",
    "g37 convertible": "convertible",
    "q60 convertible": "convertible",
    "granturismo convertible": "convertible",
    "minivan": "mpv",
    "van": "van",
    "ram van": "van",
    "e-series van": "van",
    "transit van": "van",
    "promaster cargo van": "van",
    "club cab": "pickup",
    "crew cab": "pickup",
    "crewmax cab": "pickup",
    "double cab": "pickup",
    "extended cab": "pickup",
    "quad cab": "pickup",
    "regular cab": "pickup",
    "regular-cab": "pickup",
    "supercab": "pickup",
    "supercrew": "pickup",
    "access cab": "pickup",
    "cab plus": "pickup",
    "cab plus 4": "pickup",
    "king cab": "pickup",
    "mega cab": "pickup",
    "xtracab": "pickup",
}

BODY_PLACEHOLDERS = {
    "sedan": "/placeholders/catalog/sedan.svg",
    "hatchback": "/placeholders/catalog/hatchback.svg",
    "suv": "/placeholders/catalog/suv.svg",
    "cuv": "/placeholders/catalog/cuv.svg",
    "mpv": "/placeholders/catalog/mpv.svg",
    "pickup": "/placeholders/catalog/pickup.svg",
    "coupe": "/placeholders/catalog/coupe.svg",
    "convertible": "/placeholders/catalog/convertible.svg",
    "wagon": "/placeholders/catalog/wagon.svg",
    "van": "/placeholders/catalog/van.svg",
    "other": "/placeholders/catalog/generic.svg",
}

BODY_LABELS_FOR_TRANSMISSION_FIX = set(BODY_NORMALIZATION_MAP.keys())

CURATED_MODEL_SELECTION = [
    ("Toyota", "Camry", "High-volume midsize sedan with strong pricing signal and broad compare relevance."),
    ("Toyota", "Corolla", "Mainstream compact sedan with strong market familiarity and clean transaction volume."),
    ("Toyota", "Prius", "Recognizable hybrid nameplate that will be useful for later efficiency-focused compares."),
    ("Honda", "Accord", "Well-known midsize sedan with reliable price coverage across trims and years."),
    ("Honda", "Civic", "Compact benchmark with strong volume and practical trim diversity."),
    ("Nissan", "Altima", "Large midsize sedan sample with good coverage for later value comparisons."),
    ("Nissan", "Sentra", "Compact value sedan with enough rows for a stable seed candidate."),
    ("Nissan", "Leaf", "Clear EV-oriented model name that adds electrified diversity without guessing specs."),
    ("Ford", "Fusion", "High-volume sedan with strong pricing signal and representative trims."),
    ("Ford", "Fusion Hybrid", "Hybrid-branded model name makes it a good candidate for later enriched compare workflows."),
    ("Ford", "Focus", "Popular compact with enough volume to support 1-3 representative variants."),
    ("Chevrolet", "Cruze", "Mainstream compact option with usable pricing coverage and trim spread."),
    ("Chevrolet", "Volt", "Electrified model with recognizable identity and enough signal for later enrichment."),
    ("Hyundai", "Sonata", "Midsize sedan with strong row count and practical price coverage."),
    ("Hyundai", "Elantra", "Compact sedan with broad year coverage and clean model identity."),
    ("Kia", "Optima", "Midsize sedan alternative with solid pricing signal."),
    ("Kia", "Soul", "Distinct practical hatchback/wagon-style option that improves segment diversity."),
    ("Mazda", "Mazda3", "Compact sedan/hatch family with strong compare potential."),
    ("Volkswagen", "Jetta", "Recognizable compact sedan with enough clean rows to seed safely."),
    ("BMW", "3 Series", "Premium sport sedan anchor with strong volume for later compare use cases."),
    ("Mercedes-Benz", "C-Class", "Premium sedan baseline with good data density."),
    ("Audi", "A4", "Premium compact sedan alternative with clear user-facing recognition."),
    ("Lexus", "ES 350", "Comfort-oriented premium sedan that adds useful compare contrast."),
    ("Honda", "CR-V", "Compact SUV benchmark with marketplace relevance."),
    ("Toyota", "RAV4", "High-demand compact SUV with broad trim coverage."),
    ("Toyota", "Highlander", "Family-focused crossover with strong marketplace relevance."),
    ("Toyota", "4Runner", "Distinct SUV profile that adds rugged utility to the seed mix."),
    ("Nissan", "Rogue", "Compact SUV with enough rows and pricing signal for practical compare later."),
    ("Ford", "Escape", "Mainstream compact SUV with good pricing coverage."),
    ("Ford", "Explorer", "Large family SUV with strong row volume and recognizable buyer use case."),
    ("Chevrolet", "Equinox", "Compact SUV value option with usable data quality."),
    ("Chevrolet", "Traverse", "Three-row family SUV with practical compare value."),
    ("Hyundai", "Santa Fe", "Midsize SUV with enough clean rows for seed review."),
    ("Kia", "Sorento", "Midsize family SUV that broadens non-premium SUV coverage."),
    ("Jeep", "Grand Cherokee", "Popular midsize SUV with clear brand positioning."),
    ("Jeep", "Wrangler", "Lifestyle/off-road SUV that improves body-style diversity."),
    ("BMW", "X5", "Premium midsize SUV anchor with strong row volume."),
    ("BMW", "X3", "Premium compact SUV with good compare potential."),
    ("Mercedes-Benz", "M-Class", "Premium SUV option with practical luxury compare value."),
    ("Lexus", "RX 350", "Comfort-oriented premium crossover with solid row count."),
    ("Subaru", "Forester", "Practical AWD crossover with enough clean variants."),
    ("Subaru", "Outback", "Wagon/crossover-style entry that broadens body-style diversity."),
    ("GMC", "Acadia", "Family crossover that strengthens three-row SUV coverage."),
    ("Dodge", "Grand Caravan", "High-volume minivan benchmark with strong later compare value."),
    ("Toyota", "Sienna", "Family minivan anchor with useful pricing signal."),
    ("Honda", "Odyssey", "High-recognition minivan with strong buyer relevance."),
    ("Ford", "F-150", "Full-size pickup benchmark with strong row count and trim spread."),
    ("Chevrolet", "Silverado 1500", "High-volume pickup that adds truck compare coverage."),
    ("Ram", "1500", "Full-size pickup alternative with solid row count."),
    ("Toyota", "Tacoma", "Mid-size pickup that improves truck segment diversity."),
]

FALLBACK_MODEL_REASON = (
    "High-quality normalized model candidate kept as a fallback to preserve diversity and coverage."
)


def clean_text(value: object) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    text = unicodedata.normalize("NFKC", str(value))
    text = text.replace("\u2018", "'").replace("\u2019", "'").replace("\u2013", "-").replace("\u2014", "-")
    text = re.sub(r"\s+", " ", text).strip()
    if not text or text.lower() in {"nan", "none", "null", "n/a", "na"}:
        return None
    return text


def normalize_key(value: str | None) -> str | None:
    text = clean_text(value)
    if text is None:
        return None
    text = text.lower().replace("&", " and ").replace("w/", "with ")
    text = re.sub(r"[^a-z0-9+-]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or None


def normalize_trim_key(value: str | None) -> str:
    text = clean_text(value) or "Base / Unspecified"
    text = text.replace("w/", "with ")
    text = re.sub(r"\s*[-/]\s*", " ", text)
    text = re.sub(r"[^A-Za-z0-9+ ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text or "base unspecified"


def pick_mode(values: Iterable[str | None], fallback: str | None = None) -> str | None:
    counter = Counter(value for value in values if value)
    if not counter:
        return fallback
    return sorted(counter.items(), key=lambda item: (-item[1], len(item[0]), item[0]))[0][0]


def normalize_body(raw_body: str | None, raw_transmission: str | None) -> tuple[str | None, str | None, str | None]:
    body = clean_text(raw_body)
    transmission = clean_text(raw_transmission)
    body_lower = body.lower() if body else None
    transmission_lower = transmission.lower() if transmission else None

    if transmission_lower in BODY_LABELS_FOR_TRANSMISSION_FIX and body_lower not in BODY_LABELS_FOR_TRANSMISSION_FIX:
        body = transmission
        body_lower = transmission_lower
        transmission = None

    normalized = BODY_NORMALIZATION_MAP.get(body_lower) if body_lower else None
    return body, normalized, transmission


def normalize_transmission(raw_transmission: str | None) -> str | None:
    transmission = clean_text(raw_transmission)
    if not transmission:
        return None
    value = transmission.lower()
    if value in BODY_LABELS_FOR_TRANSMISSION_FIX:
        return None
    if "dual" in value and "clutch" in value:
        return "Dual-clutch automatic"
    if "single" in value and "speed" in value:
        return "Single-speed automatic"
    if "cvt" in value:
        return "CVT"
    if "automated manual" in value or value == "amt":
        return "Automated manual"
    if "manual" in value:
        return "Manual"
    if "auto" in value or "automatic" in value:
        return "Automatic"
    return transmission.title()


def placeholder_for_body(body_type_normalized: str | None) -> str:
    return BODY_PLACEHOLDERS.get(body_type_normalized or "other", BODY_PLACEHOLDERS["other"])


def median_from_series(series: pd.Series) -> int | None:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.empty:
        return None
    return int(round(float(numeric.median())))


def markdown_table_from_records(records: list[dict[str, object]]) -> str:
    if not records:
        return "_No rows._"
    headers = list(records[0].keys())
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in records:
        lines.append("| " + " | ".join(str(row.get(header, "")) for header in headers) + " |")
    return "\n".join(lines)


def format_number(value: int | float | None) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, (int, float)):
        return f"{value:,}"
    return str(value)


def build_analysis_doc(
    df: pd.DataFrame,
    candidate_variants: pd.DataFrame,
    analysis_stats: dict[str, object],
) -> str:
    missingness_records = []
    raw_df = df[RAW_COLUMNS]
    missingness = raw_df.isna().sum().sort_values(ascending=False)
    for column, missing_count in missingness.items():
        missingness_records.append(
            {
                "column": column,
                "missing_count": format_number(int(missing_count)),
                "missing_pct": f"{raw_df[column].isna().mean() * 100:.2f}%",
            }
        )

    top_sections = []
    for column in ["make", "model", "body", "transmission"]:
        series = df[column].astype("string").str.strip().value_counts(dropna=False).head(15)
        records = [
            {
                column: "<NA>" if pd.isna(index) else str(index),
                "count": format_number(int(value)),
            }
            for index, value in series.items()
        ]
        top_sections.append((column, markdown_table_from_records(records)))

    combo_records = [
        {"combination": "make + model", "unique_count": format_number(int(analysis_stats["unique_make_model"]))},
        {
            "combination": "make + model + year",
            "unique_count": format_number(int(analysis_stats["unique_make_model_year"])),
        },
        {
            "combination": "make + model + year + trim",
            "unique_count": format_number(int(analysis_stats["unique_make_model_year_trim"])),
        },
        {
            "combination": "normalized candidate variants kept for review",
            "unique_count": format_number(int(len(candidate_variants))),
        },
    ]

    issues = [
        f"`body` has {analysis_stats['body_unique_non_null']} non-null raw labels, including model-specific labels like `G Sedan`, pickup cab labels, and casing variants.",
        f"`transmission` is mostly usable (`automatic` / `manual`), but {analysis_stats['shifted_transmission_rows']} rows are clearly shifted and contain body labels instead.",
        f"{format_number(int(analysis_stats['rows_missing_core_identity']))} rows are missing at least one core identity field (`make`, `model`, or `year`).",
        f"{format_number(int(analysis_stats['groups_below_min_rows']))} normalized make/model/year/trim groups were left out of the candidate seed because they have fewer than 3 source rows.",
        f"{format_number(int(analysis_stats['invalid_vin_rows']))} rows have malformed VIN values, all caused by a column-shift pattern where `vin` became `automatic`.",
        "This is transaction data, not a clean OEM catalog. Duplicate patterns at the make/model/year/trim level are expected because many rows represent repeated sales of the same variant.",
    ]

    doc = [
        "# Catalog Batch 1 Analysis",
        "",
        "## Scope",
        "",
        "This document profiles `car_prices.csv` only. It does not import anything into the CarVista database and it does not modify any existing listings or catalog tables.",
        "",
        "## Dataset Overview",
        "",
        f"- Total rows: **{format_number(len(df))}**",
        f"- Total columns: **{len(RAW_COLUMNS)}**",
        f"- Columns: {', '.join(RAW_COLUMNS)}",
        f"- Year range: **{int(df['year'].min())}** to **{int(df['year'].max())}**",
        "",
        "## Missingness by Column",
        "",
        markdown_table_from_records(missingness_records),
        "",
        "## High-Level Cardinality",
        "",
        markdown_table_from_records(combo_records),
        "",
        "## Top Raw Values",
        "",
    ]

    for column, table in top_sections:
        doc.extend([f"### {column.title()}", "", table, ""])

    doc.extend(
        [
            "## Duplicate Patterns",
            "",
            f"- Full-row duplicates: **{format_number(int(analysis_stats['full_row_duplicates']))}**",
            f"- Duplicate VIN rows (same VIN appears more than once): **{format_number(int(analysis_stats['duplicate_vin_rows']))}**",
            f"- Duplicate transactional rows on `year + make + model + trim + body + transmission`: **{format_number(int(analysis_stats['identity_duplicates']))}**",
            "",
            "Practical interpretation:",
            "",
            "- The CSV is best treated as repeated used-car transactions, not as one row per catalog variant.",
            "- Variant deduplication is therefore required before any future catalog import.",
            "",
            "## Major Data Quality Issues",
            "",
        ]
    )
    doc.extend([f"- {issue}" for issue in issues])
    doc.extend(
        [
            "",
            "## Practical Takeaway",
            "",
            "The dataset is strong enough for a first-pass catalog seed around make/model/year/trim plus body, transmission, and a provisional price signal. It is not sufficient for compare-ready specs without a second enrichment batch because it does not provide structured fields such as engine, drivetrain, fuel type, seating, or doors.",
            "",
        ]
    )
    return "\n".join(doc)


def build_mapping_doc() -> str:
    mapping_records = [
        {
            "destination_table": "car_makes",
            "target_field": "name",
            "csv_source": "make",
            "batch_1_rule": "Trim whitespace, preserve the representative raw display form, and generate `make_name_normalized` for stable matching.",
        },
        {
            "destination_table": "car_models",
            "target_field": "name",
            "csv_source": "model",
            "batch_1_rule": "Trim whitespace, preserve the representative raw display form, and generate `model_name_normalized` for stable matching under a make.",
        },
        {
            "destination_table": "car_models",
            "target_field": "segment",
            "csv_source": "body (indirect)",
            "batch_1_rule": "Not populated in Batch 1. Body data is too noisy for a clean model-level segment assignment without a later enrichment step.",
        },
        {
            "destination_table": "car_variants",
            "target_field": "model_year",
            "csv_source": "year",
            "batch_1_rule": "Direct integer mapping after validating the year range.",
        },
        {
            "destination_table": "car_variants",
            "target_field": "trim_name",
            "csv_source": "trim",
            "batch_1_rule": "Normalize casing, whitespace, and punctuation. Missing trim becomes `Base / Unspecified` in the intermediate seed.",
        },
        {
            "destination_table": "car_variants",
            "target_field": "body_type",
            "csv_source": "body",
            "batch_1_rule": "Map noisy body labels into the existing enum (`sedan`, `hatchback`, `suv`, `cuv`, `mpv`, `pickup`, `coupe`, `convertible`, `wagon`, `van`, `other`).",
        },
        {
            "destination_table": "car_variants",
            "target_field": "transmission",
            "csv_source": "transmission",
            "batch_1_rule": "Map to a clean user-facing label (`Automatic`, `Manual`, `CVT`, etc.). Contaminated values that are actually body labels are cleared.",
        },
        {
            "destination_table": "car_variants",
            "target_field": "msrp_base",
            "csv_source": "mmr / sellingprice",
            "batch_1_rule": "Use the median non-null `mmr` for the normalized variant group. If `mmr` is missing, fall back to the median non-null `sellingprice`. This is a market-price proxy, not a true OEM MSRP.",
        },
        {
            "destination_table": "variant_images",
            "target_field": "url",
            "csv_source": "none",
            "batch_1_rule": "No real image field exists in the CSV. Batch 1 only assigns a deterministic placeholder path for later review.",
        },
    ]

    doc = [
        "# Catalog Batch 1 Mapping",
        "",
        "## Batch Intent",
        "",
        "This mapping is only for a future **catalog-only** import into `car_makes`, `car_models`, `car_variants`, and `variant_images`. Batch 1 does not touch the database.",
        "",
        "## Field Mapping Summary",
        "",
        markdown_table_from_records(mapping_records),
        "",
        "## Fields That Map Directly",
        "",
        "- `year` -> `car_variants.model_year`",
        "- `make` -> `car_makes.name` after simple cleanup",
        "- `model` -> `car_models.name` after simple cleanup",
        "- `trim` -> `car_variants.trim_name` after normalization",
        "",
        "## Fields That Need Normalization Before Any Future Import",
        "",
        "- `body` needs normalization because the CSV mixes real body styles with pickup cab labels, model-specific labels (`G Sedan`, `Koup`), and a few shifted values.",
        "- `transmission` is simple overall but contains a small number of contaminated rows where body labels were shifted into the transmission column.",
        "- `trim` needs punctuation and whitespace cleanup, plus a default placeholder when missing.",
        "- `make` and `model` need stable normalized keys so later imports do not create duplicate makes/models because of casing or punctuation differences.",
        "",
        "## Fields Missing From the CSV (Batch 2 Enrichment Needed)",
        "",
        "- `engine`",
        "- `drivetrain`",
        "- `fuel_type`",
        "- `seats`",
        "- `doors`",
        "- Any compare-ready spec fields such as dimensions, cargo space, horsepower, torque, and efficiency",
        "",
        "These fields should remain empty or flagged for enrichment in any later catalog import batch. Batch 1 does not invent them.",
        "",
        "## Fields That Should Not Be Used For Catalog Seeding",
        "",
        "- `vin`: identifies a sold unit, not a reusable catalog variant",
        "- `state`: transaction location, not a catalog attribute",
        "- `condition`: auction/sale condition, not a stable catalog field",
        "- `odometer`: unit-specific usage, not a catalog field",
        "- `color` and `interior`: sale-unit attributes, too noisy for a base catalog seed",
        "- `seller`: transaction source, not a catalog attribute",
        "- `saledate`: transactional timestamp, not a catalog attribute",
        "",
        "## Variant Images Strategy For Batch 1",
        "",
        "Because the CSV has no trustworthy image field, the intermediate seed includes `placeholder_image_url` only. The placeholder path is deterministic by normalized body type so a later batch can choose whether to keep placeholders, replace them with static local assets, or leave `variant_images` empty until real images are sourced.",
        "",
    ]
    return "\n".join(doc)


def build_review_doc(
    analysis_stats: dict[str, object],
    excluded_examples: pd.DataFrame,
    selected_models: pd.DataFrame,
) -> str:
    excluded_records = []
    for row in excluded_examples.to_dict(orient="records"):
        excluded_records.append(
            {
                "make_name": row["make_name"],
                "model_name": row["model_name"],
                "model_year": int(row["model_year"]),
                "trim_name": row["trim_name"],
                "source_row_count": format_number(int(row["source_row_count"])),
                "why_excluded": row["why_excluded"],
            }
        )

    selected_model_records = []
    for row in (
        selected_models[["make_name", "model_name", "selection_reason"]]
        .drop_duplicates()
        .head(15)
        .to_dict(orient="records")
    ):
        selected_model_records.append(row)

    doc = [
        "# Catalog Batch 1 Review Notes",
        "",
        "## What Batch 1 Safely Did",
        "",
        "- Read and profiled the uploaded CSV only.",
        "- Normalized make/model/year/trim/body/transmission into a deduplicated intermediate seed file.",
        "- Selected a curated first-wave set of 50 vehicle models for human review.",
        "- Left all catalog enrichment gaps explicit instead of inventing missing specs.",
        "",
        "## Top Normalization Decisions",
        "",
        "- Missing `trim` values are preserved as `Base / Unspecified` instead of being dropped entirely.",
        "- Pickup body labels such as `Crew Cab`, `SuperCrew`, `King Cab`, and `Double Cab` are normalized to `pickup`.",
        "- `Minivan` is normalized to `mpv`, while cargo/passenger van labels such as `E-Series Van` and `Transit Van` stay as `van`.",
        "- Model-specific body labels such as `G Sedan`, `G Coupe`, `Koup`, and `TSX Sport Wagon` are normalized to their closest schema-safe body types.",
        "- Rows where `transmission` contains a body label and `body` contains a clear spillover value are repaired conservatively by moving the body label back into the body field and blanking transmission.",
        "",
        "## Ambiguous Cases That Still Need Human Review",
        "",
        "- `SUV` vs `CUV` cannot be separated reliably from this CSV alone, so most utility vehicles remain normalized as `suv` unless the raw body explicitly says `cuv` or `crossover`.",
        "- The dataset has no direct `fuel_type`; electrified models can be recognized by model names, but the structured field should still be filled only in a later enrichment batch.",
        "- A small number of model-specific body labels may hide trim/package information rather than clean body style. They were normalized for safety, but high-priority models should still be spot-checked before import.",
        "- `msrp_base_candidate` is a market-price proxy from used-car transactions, not a true MSRP. It is useful for seed review, not for final pricing truth.",
        "",
        "## Examples Excluded From the Batch 1 Candidate Seed",
        "",
        markdown_table_from_records(excluded_records),
        "",
        f"Additional exclusion summary: {format_number(int(analysis_stats['groups_below_min_rows']))} normalized groups were excluded for having fewer than 3 source rows, and {format_number(int(analysis_stats['rows_missing_core_identity']))} raw rows were excluded before grouping because they were missing make/model/year identity.",
        "",
        "## First-Wave Selected Models (Sample Reasons)",
        "",
        markdown_table_from_records(selected_model_records),
        "",
        "## Batch 2 Enrichment Needs",
        "",
        "- Structured powertrain details (`engine`, `drivetrain`, `fuel_type`)",
        "- Cabin configuration (`seats`, `doors`)",
        "- Compare-ready specs (`horsepower`, `torque`, dimensions, cargo space, efficiency)",
        "- Real model/variant images if the future catalog import should populate `variant_images` with more than deterministic placeholders",
        "",
        "## Risks and Caveats",
        "",
        "- This source is strongest for identifying popular market variants, not for building a complete OEM-grade spec catalog.",
        "- A future import batch should stay catalog-only and continue to avoid existing listing/listing image tables.",
        "- Before any import, the selected 50-model set should be spot-checked by a human for trim deduplication, especially on premium and pickup models where package naming can be noisy.",
        "",
    ]
    return "\n".join(doc)


def load_and_prepare_raw() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH, low_memory=False)

    for column in ["make", "model", "trim", "body", "transmission", "vin"]:
        df[column] = df[column].map(clean_text)

    df["make_name_normalized"] = df["make"].map(normalize_key)
    df["model_name_normalized"] = df["model"].map(normalize_key)
    df["trim_name_normalized"] = df["trim"].map(normalize_trim_key)

    body_fix_results = df.apply(
        lambda row: normalize_body(row["body"], row["transmission"]),
        axis=1,
        result_type="expand",
    )
    body_fix_results.columns = ["body_type_raw", "body_type_normalized", "transmission_raw_fixed"]
    df = pd.concat([df, body_fix_results], axis=1)
    df["transmission_raw"] = df["transmission_raw_fixed"].where(df["transmission_raw_fixed"].notna(), df["transmission"])
    df["transmission_normalized"] = df["transmission_raw"].map(normalize_transmission)
    df["body_type_raw"] = df["body_type_raw"].map(clean_text)

    df["vin"] = df["vin"].str.lower() if df["vin"].dtype == "string" else df["vin"]
    return df


def build_candidate_variants(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, object]]:
    core_identity_mask = (
        df["make_name_normalized"].notna()
        & df["model_name_normalized"].notna()
        & df["year"].notna()
    )
    working = df.loc[core_identity_mask].copy()
    working["trim_name_normalized"] = working["trim_name_normalized"].fillna("base unspecified")

    group_cols = [
        "make_name_normalized",
        "model_name_normalized",
        "year",
        "trim_name_normalized",
    ]

    grouped_rows: list[dict[str, object]] = []
    excluded_sparse_rows: list[dict[str, object]] = []

    for group_values, group in working.groupby(group_cols, dropna=False, sort=False):
        source_row_count = int(len(group))
        make_name = pick_mode(group["make"].tolist())
        model_name = pick_mode(group["model"].tolist())
        trim_name = pick_mode(group["trim"].tolist(), fallback="Base / Unspecified") or "Base / Unspecified"
        body_type_raw = pick_mode(group["body_type_raw"].tolist())
        body_type_normalized = pick_mode(group["body_type_normalized"].tolist())
        transmission_raw = pick_mode(group["transmission_raw"].tolist())
        transmission_normalized = pick_mode(group["transmission_normalized"].tolist())
        source_mmr_median = median_from_series(group["mmr"])
        source_sellingprice_median = median_from_series(group["sellingprice"])
        msrp_base_candidate = source_mmr_median if source_mmr_median is not None else source_sellingprice_median
        source_vin_sample = pick_mode(group["vin"].tolist())

        missing_fields = list(CORE_ENRICHMENT_FIELDS)
        if not body_type_normalized:
            missing_fields.append("body_type")
        if not transmission_normalized:
            missing_fields.append("transmission")

        record = {
            "make_name": make_name,
            "make_name_normalized": group_values[0],
            "model_name": model_name,
            "model_name_normalized": group_values[1],
            "model_year": int(group_values[2]),
            "trim_name": trim_name,
            "trim_name_normalized": group_values[3],
            "body_type_raw": body_type_raw,
            "body_type_normalized": body_type_normalized,
            "transmission_raw": transmission_raw,
            "transmission_normalized": transmission_normalized,
            "msrp_base_candidate": msrp_base_candidate,
            "source_row_count": source_row_count,
            "source_mmr_median": source_mmr_median,
            "source_sellingprice_median": source_sellingprice_median,
            "source_vin_sample": source_vin_sample,
            "placeholder_image_url": placeholder_for_body(body_type_normalized),
            "needs_enrichment": True,
            "enrichment_missing_fields": ",".join(missing_fields),
        }

        if source_row_count < 3:
            excluded_sparse_rows.append(
                {
                    **record,
                    "why_excluded": "Fewer than 3 source rows after normalization.",
                }
            )
            continue

        grouped_rows.append(record)

    candidate_variants = pd.DataFrame(grouped_rows)
    if candidate_variants.empty:
        raise RuntimeError("No candidate variants were produced. Check normalization rules.")

    candidate_variants["variant_quality_score"] = (
        candidate_variants["source_row_count"] * 1.0
        + candidate_variants["msrp_base_candidate"].notna().astype(int) * 15
        + candidate_variants["body_type_normalized"].notna().astype(int) * 5
        + candidate_variants["transmission_normalized"].notna().astype(int) * 5
        + (candidate_variants["model_year"] - candidate_variants["model_year"].min()) * 0.2
    )

    candidate_variants = candidate_variants.sort_values(
        [
            "make_name_normalized",
            "model_name_normalized",
            "variant_quality_score",
            "source_row_count",
            "model_year",
            "trim_name_normalized",
        ],
        ascending=[True, True, False, False, False, True],
    ).reset_index(drop=True)

    candidate_variants["variant_sort_order"] = (
        candidate_variants.groupby(["make_name_normalized", "model_name_normalized"]).cumcount() + 1
    )

    analysis_stats = {
        "rows_missing_core_identity": int((~core_identity_mask).sum()),
        "groups_below_min_rows": int(len(excluded_sparse_rows)),
        "excluded_sparse_rows": pd.DataFrame(excluded_sparse_rows),
    }
    return candidate_variants, analysis_stats


def select_curated_models(candidate_variants: pd.DataFrame) -> pd.DataFrame:
    selected_keys: list[tuple[str, str]] = []
    selection_reason_map: dict[tuple[str, str], str] = {}

    available_keys = {
        (row["make_name_normalized"], row["model_name_normalized"])
        for row in candidate_variants[["make_name_normalized", "model_name_normalized"]].drop_duplicates().to_dict(orient="records")
    }

    for make_name, model_name, reason in CURATED_MODEL_SELECTION:
        key = (normalize_key(make_name), normalize_key(model_name))
        if key in available_keys and key not in selection_reason_map:
            selected_keys.append(key)
            selection_reason_map[key] = reason

    if len(selected_keys) < 50:
        model_summary = (
            candidate_variants.groupby(
                ["make_name_normalized", "model_name_normalized", "make_name", "model_name"],
                as_index=False,
            )
            .agg(
                model_source_rows=("source_row_count", "sum"),
                model_variant_count=("trim_name_normalized", "count"),
                priced_variant_count=("msrp_base_candidate", lambda s: int(s.notna().sum())),
            )
            .sort_values(
                ["model_source_rows", "priced_variant_count", "model_variant_count"],
                ascending=[False, False, False],
            )
        )
        for row in model_summary.to_dict(orient="records"):
            key = (row["make_name_normalized"], row["model_name_normalized"])
            if key in selection_reason_map:
                continue
            selected_keys.append(key)
            selection_reason_map[key] = FALLBACK_MODEL_REASON
            if len(selected_keys) == 50:
                break

    selected_keys = selected_keys[:50]
    selected_key_set = set(selected_keys)

    working = candidate_variants[
        candidate_variants.apply(
            lambda row: (row["make_name_normalized"], row["model_name_normalized"]) in selected_key_set,
            axis=1,
        )
    ].copy()

    selected_rows = (
        working.sort_values(
            [
                "make_name_normalized",
                "model_name_normalized",
                "variant_quality_score",
                "source_row_count",
                "model_year",
            ],
            ascending=[True, True, False, False, False],
        )
        .groupby(["make_name_normalized", "model_name_normalized"], as_index=False, group_keys=False)
        .head(3)
        .copy()
    )

    selected_rows["selection_reason"] = selected_rows.apply(
        lambda row: selection_reason_map[(row["make_name_normalized"], row["model_name_normalized"])],
        axis=1,
    )

    return selected_rows


def finalize_outputs(candidate_variants: pd.DataFrame, selected_rows: pd.DataFrame) -> pd.DataFrame:
    candidate_variants = candidate_variants.copy()
    selected_variant_keys = {
        (
            row["make_name_normalized"],
            row["model_name_normalized"],
            row["trim_name_normalized"],
            row["model_year"],
        )
        for row in selected_rows.to_dict(orient="records")
    }
    selected_reason_lookup = {
        (
            row["make_name_normalized"],
            row["model_name_normalized"],
            row["trim_name_normalized"],
            row["model_year"],
        ): row["selection_reason"]
        for row in selected_rows.to_dict(orient="records")
    }

    candidate_variants["selection_status"] = candidate_variants.apply(
        lambda row: "selected"
        if (
            row["make_name_normalized"],
            row["model_name_normalized"],
            row["trim_name_normalized"],
            row["model_year"],
        )
        in selected_variant_keys
        else "review_pool",
        axis=1,
    )
    candidate_variants["selection_reason"] = candidate_variants.apply(
        lambda row: selected_reason_lookup.get(
            (
                row["make_name_normalized"],
                row["model_name_normalized"],
                row["trim_name_normalized"],
                row["model_year"],
            ),
            "Normalized candidate kept for later review but not selected in the first 50-model wave.",
        ),
        axis=1,
    )

    ordered_columns = [
        "make_name",
        "make_name_normalized",
        "model_name",
        "model_name_normalized",
        "model_year",
        "trim_name",
        "trim_name_normalized",
        "body_type_raw",
        "body_type_normalized",
        "transmission_raw",
        "transmission_normalized",
        "msrp_base_candidate",
        "source_row_count",
        "source_mmr_median",
        "source_sellingprice_median",
        "source_vin_sample",
        "placeholder_image_url",
        "needs_enrichment",
        "enrichment_missing_fields",
        "selection_status",
        "selection_reason",
        "variant_sort_order",
    ]

    candidate_export = candidate_variants[ordered_columns].assign(
        _selection_rank=lambda frame: frame["selection_status"].map({"selected": 0, "review_pool": 1}).fillna(9)
    ).sort_values(
        [
            "_selection_rank",
            "make_name_normalized",
            "model_name_normalized",
            "variant_sort_order",
            "model_year",
            "trim_name_normalized",
        ],
        ascending=[True, True, True, True, False, True],
    ).drop(columns=["_selection_rank"])

    selected_export = selected_rows[
        [
            "make_name",
            "model_name",
            "model_year",
            "trim_name",
            "body_type_normalized",
            "transmission_normalized",
            "msrp_base_candidate",
            "source_row_count",
            "needs_enrichment",
            "selection_reason",
            "variant_sort_order",
            "source_mmr_median",
            "source_sellingprice_median",
        ]
    ].sort_values(["make_name", "model_name", "variant_sort_order", "model_year"], ascending=[True, True, True, False])

    candidate_export.to_csv(NORMALIZED_CSV, index=False)
    selected_export.to_csv(SELECTED_CSV, index=False)
    return selected_export


def main() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    df = load_and_prepare_raw()
    candidate_variants, candidate_stats = build_candidate_variants(df)
    selected_rows = select_curated_models(candidate_variants)
    selected_export = finalize_outputs(candidate_variants, selected_rows)

    analysis_stats = {
        "unique_make_model": int(df[["make", "model"]].dropna().drop_duplicates().shape[0]),
        "unique_make_model_year": int(df[["make", "model", "year"]].dropna().drop_duplicates().shape[0]),
        "unique_make_model_year_trim": int(df[["make", "model", "year", "trim"]].dropna().drop_duplicates().shape[0]),
        "full_row_duplicates": int(df[RAW_COLUMNS].duplicated().sum()),
        "identity_duplicates": int(df.duplicated(subset=["year", "make", "model", "trim", "body", "transmission"]).sum()),
        "duplicate_vin_rows": int(df["vin"].dropna().duplicated().sum()),
        "invalid_vin_rows": int((df["vin"].dropna().astype("string").str.len() != 17).sum()),
        "body_unique_non_null": int(df["body"].dropna().astype("string").str.strip().nunique()),
        "shifted_transmission_rows": int(
            df["transmission"].astype("string").str.strip().str.lower().isin(BODY_LABELS_FOR_TRANSMISSION_FIX).sum()
        ),
        **candidate_stats,
    }

    excluded_sparse_df = candidate_stats["excluded_sparse_rows"]
    if excluded_sparse_df.empty:
        excluded_examples = pd.DataFrame(
            columns=["make_name", "model_name", "model_year", "trim_name", "source_row_count", "why_excluded"]
        )
    else:
        excluded_examples = excluded_sparse_df.sort_values(
            ["source_row_count", "make_name", "model_name", "model_year"],
            ascending=[False, True, True, False],
        ).head(12)

    ANALYSIS_DOC.write_text(build_analysis_doc(df, candidate_variants, analysis_stats), encoding="utf-8")
    MAPPING_DOC.write_text(build_mapping_doc(), encoding="utf-8")
    REVIEW_DOC.write_text(
        build_review_doc(
            analysis_stats,
            excluded_examples,
            selected_export,
        ),
        encoding="utf-8",
    )

    print(f"Wrote {NORMALIZED_CSV}")
    print(f"Wrote {SELECTED_CSV}")
    print(f"Wrote {ANALYSIS_DOC}")
    print(f"Wrote {MAPPING_DOC}")
    print(f"Wrote {REVIEW_DOC}")
    print(f"Candidate variants: {len(candidate_variants)}")
    print(f"Selected models: {selected_export[['make_name', 'model_name']].drop_duplicates().shape[0]}")
    print(f"Selected variant rows: {len(selected_export)}")


if __name__ == "__main__":
    main()
