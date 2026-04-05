from __future__ import annotations

import math
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd
import requests


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
DOCS_DIR = REPO_ROOT / "docs"

NORMALIZED_INPUT = DATA_DIR / "normalized_catalog_seed.csv"
SELECTED_INPUT = DATA_DIR / "selected_50_models.csv"
ENRICHED_OUTPUT = DATA_DIR / "enriched_selected_50_models.csv"
ENRICHMENT_DOC = DOCS_DIR / "catalog-batch2-enrichment.md"
REVIEW_DOC = DOCS_DIR / "catalog-batch2-review-notes.md"

NHTSA_BATCH_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/"
EPA_VEHICLES_CSV_URL = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip"
NHTSA_DOC_URL = "https://vpic.nhtsa.dot.gov/api/"
EPA_DOC_URL = "https://www.fueleconomy.gov/feg/ws/"
NHTSA_BATCH_SIZE = 25

EPA_USECOLS = [
    "id",
    "year",
    "make",
    "model",
    "baseModel",
    "trany",
    "trans_dscr",
    "drive",
    "cylinders",
    "displ",
    "fuelType",
    "fuelType1",
    "fuelType2",
    "city08",
    "highway08",
    "comb08",
    "VClass",
    "atvType",
    "eng_dscr",
    "tCharger",
    "sCharger",
]


def clean_text(value: object) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    text = unicodedata.normalize("NFKC", str(value))
    text = text.replace("\u2018", "'").replace("\u2019", "'").replace("\u2013", "-").replace("\u2014", "-")
    text = re.sub(r"\s+", " ", text).strip()
    if not text or text.lower() in {"nan", "none", "null", "n/a", "na"}:
        return None
    return text


def normalize_key(value: object) -> str:
    text = clean_text(value) or ""
    text = text.lower().replace("&", " and ").replace("w/", "with ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text


def token_set(value: object) -> set[str]:
    text = normalize_key(value)
    return {token for token in text.split("-") if token}


def jaccard_similarity(a: object, b: object) -> float:
    ta = token_set(a)
    tb = token_set(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def almost_equal_number(a: object, b: object, tolerance: float) -> bool:
    try:
        av = float(a)
        bv = float(b)
    except (TypeError, ValueError):
        return False
    return abs(av - bv) <= tolerance


def format_number(value: object) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number.is_integer():
        return f"{int(number):,}"
    return f"{number:,.1f}"


def normalize_drive(value: object) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    lowered = text.lower()
    if "4x4" in lowered or lowered == "4wd":
        return "Four-Wheel Drive (4x4)"
    if "4x2" in lowered or lowered == "2wd":
        return "Two-Wheel Drive (4x2)"
    if "front" in lowered:
        return "Front-Wheel Drive"
    if "rear" in lowered:
        return "Rear-Wheel Drive"
    if "all-wheel" in lowered or lowered == "awd":
        return "All-Wheel Drive"
    if "4-wheel" in lowered or lowered == "4wd":
        return "Four-Wheel Drive"
    if "2-wheel" in lowered:
        return "Two-Wheel Drive"
    return text


def normalize_fuel_type(nhtsa_fuel: object, epa_fuel: object, epa_atv: object) -> str | None:
    atv = clean_text(epa_atv)
    if atv:
        lowered = atv.lower()
        if "plug-in hybrid" in lowered:
            return "Plug-in Hybrid"
        if lowered == "hybrid":
            return "Hybrid"
        if lowered == "ev":
            return "Electric"
        if lowered == "diesel":
            return "Diesel"
    for raw in [nhtsa_fuel, epa_fuel]:
        text = clean_text(raw)
        if not text:
            continue
        lowered = text.lower()
        if "electric" in lowered:
            return "Electric"
        if "plug-in" in lowered:
            return "Plug-in Hybrid"
        if "hybrid" in lowered:
            return "Hybrid"
        if "diesel" in lowered:
            return "Diesel"
        if "premium" in lowered or "gasoline" in lowered or "regular" in lowered:
            return "Gasoline"
        if "ethanol" in lowered or "e85" in lowered or "flex" in lowered:
            return "Flex Fuel"
        if "natural gas" in lowered or "cng" in lowered:
            return "Natural Gas"
    return None


def build_engine_description(decoded: dict[str, object], epa_row: pd.Series | None) -> str | None:
    displacement_l = None
    if clean_text(decoded.get("DisplacementL")):
        try:
            displacement_l = float(decoded["DisplacementL"])
        except (TypeError, ValueError):
            displacement_l = None
    elif epa_row is not None and not pd.isna(epa_row.get("displ")):
        displacement_l = float(epa_row["displ"])

    cylinders = clean_text(decoded.get("EngineCylinders"))
    if not cylinders and epa_row is not None and not pd.isna(epa_row.get("cylinders")):
        cylinders = str(int(float(epa_row["cylinders"])))

    config = clean_text(decoded.get("EngineConfiguration"))
    eng_dscr = clean_text(epa_row.get("eng_dscr")) if epa_row is not None else None
    turbo = epa_row is not None and clean_text(epa_row.get("tCharger")) == "T"
    supercharged = epa_row is not None and clean_text(epa_row.get("sCharger")) == "S"

    parts: list[str] = []
    if displacement_l:
        parts.append(f"{displacement_l:.1f}L")

    if cylinders:
        if config:
            config_lower = config.lower()
            if "v-shaped" in config_lower:
                parts.append(f"V{cylinders}")
            elif "in-line" in config_lower or "inline" in config_lower:
                parts.append(f"I{cylinders}")
            elif "flat" in config_lower:
                parts.append(f"Flat-{cylinders}")
            else:
                parts.append(f"{cylinders}-cyl")
        else:
            parts.append(f"{cylinders}-cyl")

    if turbo:
        parts.append("Turbo")
    if supercharged:
        parts.append("Supercharged")
    if eng_dscr:
        cleaned = eng_dscr.strip("()")
        if cleaned and cleaned not in {"FFS"}:
            parts.append(cleaned)

    if not parts:
        return clean_text(decoded.get("EngineModel"))
    return " ".join(parts)


def build_transmission_detail(decoded: dict[str, object], epa_row: pd.Series | None) -> str | None:
    style = clean_text(decoded.get("TransmissionStyle"))
    speeds = clean_text(decoded.get("TransmissionSpeeds"))
    if style:
        if speeds and speeds not in {"0", ""}:
            return f"{style} {speeds}-speed"
        return style

    if epa_row is not None:
        trany = clean_text(epa_row.get("trany"))
        trans_dscr = clean_text(epa_row.get("trans_dscr"))
        if trany and trans_dscr:
            return f"{trany} ({trans_dscr.strip('()')})"
        return trany or trans_dscr
    return None


def model_matches(row: pd.Series, decoded: dict[str, object], epa_row: pd.Series) -> tuple[bool, float]:
    row_model = row["model_name"]
    decoded_model = clean_text(decoded.get("Model"))
    decoded_series = clean_text(decoded.get("Series"))
    epa_model = clean_text(epa_row.get("model"))
    epa_base = clean_text(epa_row.get("baseModel"))

    candidates = [epa_model, epa_base]
    similarities = [
        jaccard_similarity(row_model, candidate)
        for candidate in candidates
        if candidate
    ]
    similarities.extend(
        jaccard_similarity(decoded_model, candidate)
        for candidate in candidates
        if candidate and decoded_model
    )
    similarities.extend(
        jaccard_similarity(decoded_series, candidate)
        for candidate in candidates
        if candidate and decoded_series
    )

    best = max(similarities) if similarities else 0.0

    row_key = normalize_key(row_model)
    decoded_model_key = normalize_key(decoded_model)
    decoded_series_key = normalize_key(decoded_series)
    epa_model_key = normalize_key(epa_model)
    epa_base_key = normalize_key(epa_base)

    exactish = any(
        key and candidate and (key == candidate or key in candidate or candidate in key)
        for key in [row_key, decoded_model_key, decoded_series_key]
        for candidate in [epa_model_key, epa_base_key]
    )
    return exactish or best >= 0.45, best


def score_epa_candidate(row: pd.Series, decoded: dict[str, object], epa_row: pd.Series) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    decoded_make = normalize_key(decoded.get("Make"))
    decoded_model = clean_text(decoded.get("Model"))
    decoded_series = clean_text(decoded.get("Series"))
    decoded_year = clean_text(decoded.get("ModelYear"))

    if int(float(epa_row["year"])) == int(row["model_year"]):
        score += 35
        reasons.append("year")

    if normalize_key(epa_row["make"]) in {normalize_key(row["make_name"]), decoded_make}:
        score += 25
        reasons.append("make")

    model_ok, model_similarity = model_matches(row, decoded, epa_row)
    if model_ok:
        score += 35
        reasons.append("model")
    elif model_similarity >= 0.25:
        score += 10
        reasons.append("model_partial")

    decoded_cc = decoded.get("DisplacementCC")
    if clean_text(decoded_cc):
        if almost_equal_number(float(decoded_cc), float(epa_row["displ"]) * 1000, 250):
            score += 20
            reasons.append("displacement")

    decoded_cyl = clean_text(decoded.get("EngineCylinders"))
    if decoded_cyl and not pd.isna(epa_row["cylinders"]):
        if int(float(decoded_cyl)) == int(float(epa_row["cylinders"])):
            score += 12
            reasons.append("cylinders")

    decoded_drive = normalize_drive(decoded.get("DriveType"))
    epa_drive = normalize_drive(epa_row.get("drive"))
    if decoded_drive and epa_drive and decoded_drive == epa_drive:
        score += 12
        reasons.append("drive")

    transmission_normalized = clean_text(row.get("transmission_normalized"))
    epa_trany = clean_text(epa_row.get("trany"))
    if transmission_normalized and epa_trany:
        lowered = transmission_normalized.lower()
        if lowered == "automatic" and "automatic" in epa_trany.lower():
            score += 8
            reasons.append("transmission")
        elif lowered == "manual" and "manual" in epa_trany.lower():
            score += 8
            reasons.append("transmission")
        elif lowered == "cvt" and "variable" in epa_trany.lower():
            score += 8
            reasons.append("transmission")

    decoded_fuel = normalize_fuel_type(decoded.get("FuelTypePrimary"), epa_row.get("fuelType1"), epa_row.get("atvType"))
    if decoded_fuel:
        epa_fuel = normalize_fuel_type(None, epa_row.get("fuelType1"), epa_row.get("atvType"))
        if epa_fuel and decoded_fuel == epa_fuel:
            score += 8
            reasons.append("fuel")

    if decoded_model and decoded_year and clean_text(decoded.get("Make")):
        score += 5
        reasons.append("vin_decode")

    return score, reasons


def decode_vins(selected: pd.DataFrame) -> pd.DataFrame:
    prepared_rows = []
    records = selected.to_dict(orient="records")
    for start in range(0, len(records), NHTSA_BATCH_SIZE):
        chunk = records[start : start + NHTSA_BATCH_SIZE]
        payload = ";".join(f"{row['source_vin_sample']},{int(row['model_year'])}" for row in chunk)
        response = requests.post(
            NHTSA_BATCH_URL,
            data={"format": "json", "data": payload},
            timeout=300,
        )
        response.raise_for_status()
        results = response.json()["Results"]
        if len(results) != len(chunk):
            raise RuntimeError(
                f"NHTSA batch decode returned {len(results)} rows for a chunk of {len(chunk)} VINs."
            )
        for source_row, decoded_row in zip(chunk, results):
            item = dict(decoded_row)
            item["_source_vin_sample"] = str(source_row["source_vin_sample"]).lower()
            prepared_rows.append(item)
    decoded = pd.DataFrame(prepared_rows)
    return decoded


def load_epa_dataset(years: set[int], makes: set[str]) -> pd.DataFrame:
    epa = pd.read_csv(
        EPA_VEHICLES_CSV_URL,
        compression="zip",
        low_memory=False,
        usecols=EPA_USECOLS,
    )
    epa = epa[epa["year"].isin(years)].copy()
    epa["make_key"] = epa["make"].map(normalize_key)
    epa = epa[epa["make_key"].isin({normalize_key(make) for make in makes})].copy()
    epa["model_key"] = epa["model"].map(normalize_key)
    epa["base_model_key"] = epa["baseModel"].map(normalize_key)
    epa["drive_norm"] = epa["drive"].map(normalize_drive)
    return epa


def choose_epa_match(row: pd.Series, decoded: dict[str, object], epa: pd.DataFrame) -> tuple[pd.Series | None, str, str]:
    make_keys = {normalize_key(row["make_name"])}
    decoded_make = clean_text(decoded.get("Make"))
    if decoded_make:
        make_keys.add(normalize_key(decoded_make))

    subset = epa[
        (epa["year"] == int(row["model_year"]))
        & (epa["make_key"].isin(make_keys))
    ].copy()
    if subset.empty:
        return None, "no_epa_candidates", "No EPA vehicle rows matched the selected year and make."

    scored_rows = []
    for _, epa_row in subset.iterrows():
        score, reasons = score_epa_candidate(row, decoded, epa_row)
        if score > 0:
            scored_rows.append((score, reasons, epa_row))

    if not scored_rows:
        return None, "no_scored_epa_match", "EPA rows existed for the make/year but none matched strongly enough on model/spec fields."

    scored_rows.sort(key=lambda item: item[0], reverse=True)
    best_score, best_reasons, best_row = scored_rows[0]
    second_score = scored_rows[1][0] if len(scored_rows) > 1 else -999

    if best_score < 70:
        return None, "epa_match_too_weak", f"Best EPA candidate scored only {best_score}."

    if best_score - second_score < 10 and best_score < 100:
        return None, "epa_match_ambiguous", f"Top EPA candidates were too close ({best_score} vs {second_score})."

    return best_row, "epa_match", ",".join(best_reasons)


def build_confidence(
    row: pd.Series,
    decoded: dict[str, object],
    epa_row: pd.Series | None,
    epa_reason: str,
) -> tuple[str, str, str]:
    make_ok = normalize_key(decoded.get("Make")) == normalize_key(row["make_name"])
    year_ok = clean_text(decoded.get("ModelYear")) == str(int(row["model_year"]))
    model_ok, _ = model_matches(row, decoded, epa_row if epa_row is not None else pd.Series(dtype=object))

    if make_ok and year_ok and model_ok and epa_row is not None:
        return "high", "VIN exact + EPA structured match", epa_reason
    if make_ok and year_ok and (model_ok or epa_row is not None):
        return "medium", "VIN decode aligned on make/year with partial trim/model ambiguity", epa_reason
    if make_ok or year_ok or epa_row is not None:
        return "low", "Only partial structured alignment was available", epa_reason
    return "unresolved", "Structured sources did not align safely enough", epa_reason


def build_enriched_record(row: pd.Series, decoded: dict[str, object], epa_row: pd.Series | None, confidence: str, confidence_summary: str, match_key: str, epa_reason: str) -> dict[str, object]:
    fuel_type = normalize_fuel_type(
        decoded.get("FuelTypePrimary"),
        epa_row.get("fuelType1") if epa_row is not None else None,
        epa_row.get("atvType") if epa_row is not None else None,
    )
    drivetrain = normalize_drive(decoded.get("DriveType")) or (
        normalize_drive(epa_row.get("drive")) if epa_row is not None else None
    )
    transmission_detail = build_transmission_detail(decoded, epa_row)
    engine = build_engine_description(decoded, epa_row)

    doors = clean_text(decoded.get("Doors"))
    seats = clean_text(decoded.get("Seats"))
    horsepower = clean_text(decoded.get("EngineHP"))
    cylinders = clean_text(decoded.get("EngineCylinders"))
    engine_cc = clean_text(decoded.get("DisplacementCC"))

    if not cylinders and epa_row is not None and not pd.isna(epa_row.get("cylinders")):
        cylinders = str(int(float(epa_row["cylinders"])))
    if not engine_cc and epa_row is not None and not pd.isna(epa_row.get("displ")):
        engine_cc = str(int(round(float(epa_row["displ"]) * 1000)))

    mpg_city = int(float(epa_row["city08"])) if epa_row is not None and not pd.isna(epa_row.get("city08")) else None
    mpg_highway = int(float(epa_row["highway08"])) if epa_row is not None and not pd.isna(epa_row.get("highway08")) else None
    mpg_combined = int(float(epa_row["comb08"])) if epa_row is not None and not pd.isna(epa_row.get("comb08")) else None
    body_class_refined = clean_text(decoded.get("BodyClass")) or (
        clean_text(epa_row.get("VClass")) if epa_row is not None else None
    )

    source_used_parts = ["NHTSA vPIC VIN decode"]
    if epa_row is not None:
        source_used_parts.append("EPA FuelEconomy vehicles.csv")
    source_used = "; ".join(source_used_parts)

    notes = [confidence_summary]
    if epa_row is None:
        notes.append("EPA MPG match unresolved.")
    if not seats:
        notes.append("Seats not available from the structured VIN sample.")
    if confidence == "medium":
        notes.append("Trim-level alignment is good enough for review but should be spot-checked before import.")
    if confidence == "low":
        notes.append("Manual review recommended before any future import.")

    compare_notes = []
    if fuel_type:
        compare_notes.append(f"Fuel type grounded as {fuel_type}.")
    if drivetrain:
        compare_notes.append(f"Drivetrain grounded as {drivetrain}.")
    if mpg_combined is None:
        compare_notes.append("Combined MPG still missing.")
    if epa_row is not None and confidence in {"high", "medium"}:
        compare_notes.append("MPG data matched from EPA structured records.")

    ready_for_import = bool(
        fuel_type
        and (engine or engine_cc)
        and drivetrain
        and (transmission_detail or clean_text(row.get("transmission_normalized")))
        and clean_text(row.get("body_type_normalized"))
    )

    if confidence == "unresolved":
        enrichment_status = "unresolved"
    elif ready_for_import and confidence in {"high", "medium"}:
        enrichment_status = "enriched"
    else:
        enrichment_status = "partial"

    return {
        **row.to_dict(),
        "fuel_type": fuel_type,
        "engine": engine,
        "drivetrain": drivetrain,
        "doors": int(float(doors)) if doors else None,
        "seats": int(float(seats)) if seats else None,
        "horsepower": float(horsepower) if horsepower else None,
        "cylinders": int(float(cylinders)) if cylinders else None,
        "engine_displacement_cc": int(float(engine_cc)) if engine_cc else None,
        "transmission_detail": transmission_detail,
        "mpg_city": mpg_city,
        "mpg_highway": mpg_highway,
        "mpg_combined": mpg_combined,
        "body_class_refined": body_class_refined,
        "compare_confidence_notes": " ".join(compare_notes) if compare_notes else None,
        "enrichment_status": enrichment_status,
        "enrichment_confidence": confidence,
        "source_used": source_used,
        "match_key_used": match_key,
        "enrichment_notes": " ".join(notes),
        "ready_for_import": ready_for_import,
    }


def build_enrichment_doc(enriched: pd.DataFrame) -> str:
    confidence_counts = enriched["enrichment_confidence"].value_counts().to_dict()
    status_counts = enriched["enrichment_status"].value_counts().to_dict()
    ready_count = int(enriched["ready_for_import"].sum())
    unresolved_count = int((enriched["enrichment_status"] == "unresolved").sum())

    by_source = (
        enriched["source_used"].value_counts().rename_axis("source_used").reset_index(name="count").to_dict(orient="records")
    )

    doc = [
        "# Catalog Batch 2 Enrichment",
        "",
        "## Scope",
        "",
        "Batch 2 enriched the curated 150 selected variants from Batch 1 **offline only**. No database tables were modified and no import script was run.",
        "",
        "## Structured External Sources Used",
        "",
        f"- NHTSA vPIC VIN Decode API: {NHTSA_DOC_URL}",
        f"- EPA FuelEconomy.gov vehicle web services / downloadable vehicle dataset: {EPA_DOC_URL}",
        "",
        "## What Each Source Contributed",
        "",
        "- **NHTSA vPIC**: fuel type, engine displacement, cylinders, horsepower, drivetrain, doors, body class, transmission style when available.",
        "- **EPA FuelEconomy**: city/highway/combined MPG, drive cross-check, transmission detail cross-check, fuel cross-check, vehicle class refinement.",
        "",
        "## Matching Logic",
        "",
        "1. Load the 150 `selection_status=selected` rows from Batch 1.",
        "2. Decode each `source_vin_sample` with NHTSA vPIC using the selected `model_year`.",
        "3. Download the official EPA vehicle dataset and filter it to the selected years and makes.",
        "4. Score EPA candidates using year, make, model/base model similarity, engine displacement, cylinders, drivetrain, transmission, and fuel alignment.",
        "5. Keep the EPA match only when the score is strong enough and clearly ahead of alternative candidates.",
        "",
        "## Confidence Rules",
        "",
        "- `high`: VIN decode aligns on make/year/model family and EPA has a clear structured match.",
        "- `medium`: VIN decode aligns on make/year and mostly aligns on model family, but trim/package ambiguity remains.",
        "- `low`: only partial structured alignment exists; usable for review, not safe for automatic import.",
        "- `unresolved`: no safe structured match for compare-relevant fields.",
        "",
        "## Output Summary",
        "",
        f"- Total enriched rows: **{len(enriched)}**",
        f"- Ready for import (offline assessment only): **{ready_count}**",
        f"- Unresolved rows: **{unresolved_count}**",
        f"- Confidence counts: high={confidence_counts.get('high', 0)}, medium={confidence_counts.get('medium', 0)}, low={confidence_counts.get('low', 0)}, unresolved={confidence_counts.get('unresolved', 0)}",
        f"- Status counts: enriched={status_counts.get('enriched', 0)}, partial={status_counts.get('partial', 0)}, unresolved={status_counts.get('unresolved', 0)}",
        "",
        "## Source Mix",
        "",
        markdown_table(by_source, ["source_used", "count"]),
        "",
        "## What Still Remains For Batch 3 Or Later",
        "",
        "- Manual review on low-confidence rows where trim naming differs between the CSV and VIN decode.",
        f"- Seats remain unresolved on all {len(enriched)} selected rows because the structured VIN sample did not expose them reliably enough to fill automatically.",
        "- Some premium and truck variants still need human confirmation before any future import because multiple EPA records remain close on engine/package details.",
        "- The Nissan Leaf rows stay `ready_for_import=false` under the current rule because official structured sources did not provide a piston-engine-style displacement field.",
        "- Real images are still outside this batch.",
        "",
    ]
    return "\n".join(doc)


def markdown_table(records: list[dict[str, object]], headers: list[str]) -> str:
    if not records:
        return "_No rows._"
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for record in records:
        lines.append("| " + " | ".join(str(record.get(header, "")) for header in headers) + " |")
    return "\n".join(lines)


def build_review_doc(enriched: pd.DataFrame) -> str:
    unresolved = enriched[enriched["enrichment_status"] == "unresolved"][
        ["make_name", "model_name", "model_year", "trim_name", "enrichment_confidence", "enrichment_notes"]
    ].head(20)
    low_conf = enriched[enriched["enrichment_confidence"] == "low"][
        ["make_name", "model_name", "model_year", "trim_name", "match_key_used", "enrichment_notes"]
    ].head(25)

    manual_review = enriched[
        enriched["enrichment_confidence"].isin(["medium", "low", "unresolved"])
        | (~enriched["ready_for_import"])
    ][
        ["make_name", "model_name", "model_year", "trim_name", "enrichment_confidence", "ready_for_import"]
    ].drop_duplicates().head(30)

    doc = [
        "# Catalog Batch 2 Review Notes",
        "",
        "## Rows Still Unresolved",
        "",
        markdown_table(unresolved.to_dict(orient="records"), list(unresolved.columns)),
        "",
        "## Low-Confidence Matches",
        "",
        markdown_table(low_conf.to_dict(orient="records"), list(low_conf.columns)),
        "",
        "## Fields Still Too Risky To Fill Automatically",
        "",
        "- `seats` remains sparse because the VIN sample often does not expose it and Batch 2 avoids guessing from body class.",
        "- Some trim-level distinctions on premium sedans, SUVs, and pickups remain too close to fill blindly when VIN decode and seller-entered trim naming disagree.",
        "- Any spec not present in either NHTSA VIN decode or EPA data remains null by design.",
        "",
        "## Rows Recommended For Manual Review Before Any Future Import",
        "",
        markdown_table(manual_review.to_dict(orient="records"), list(manual_review.columns)),
        "",
    ]
    return "\n".join(doc)


def main() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    selected = pd.read_csv(NORMALIZED_INPUT)
    selected = selected[selected["selection_status"] == "selected"].copy()
    selected = selected.sort_values(["make_name", "model_name", "variant_sort_order", "model_year"]).reset_index(drop=True)

    decode_df = decode_vins(selected)
    decode_lookup = {row["_source_vin_sample"]: row for _, row in decode_df.iterrows()}

    epa = load_epa_dataset(
        years={int(year) for year in selected["model_year"].unique().tolist()},
        makes={str(make) for make in selected["make_name"].unique().tolist()},
    )

    enriched_records = []
    for _, row in selected.iterrows():
        decoded_series = decode_lookup.get(str(row["source_vin_sample"]).lower())
        if decoded_series is None:
            confidence = "unresolved"
            confidence_summary = "VIN decode did not return a row for this source VIN."
            epa_row = None
            match_key = "no_vin_decode"
            epa_reason = "VIN decode unavailable."
            decoded_dict: dict[str, object] = {}
        else:
            decoded_dict = decoded_series.to_dict()
            epa_row, match_key, epa_reason = choose_epa_match(row, decoded_dict, epa)
            confidence, confidence_summary, _ = build_confidence(row, decoded_dict, epa_row, epa_reason)

        enriched_records.append(
            build_enriched_record(
                row,
                decoded_dict,
                epa_row,
                confidence,
                confidence_summary,
                match_key,
                epa_reason,
            )
        )

    enriched = pd.DataFrame(enriched_records)
    ENRICHED_OUTPUT.write_text(enriched.to_csv(index=False), encoding="utf-8")
    ENRICHMENT_DOC.write_text(build_enrichment_doc(enriched), encoding="utf-8")
    REVIEW_DOC.write_text(build_review_doc(enriched), encoding="utf-8")

    print(f"Wrote {ENRICHED_OUTPUT}")
    print(f"Wrote {ENRICHMENT_DOC}")
    print(f"Wrote {REVIEW_DOC}")
    print(f"Rows enriched: {len(enriched)}")
    print(f"Ready for import: {int(enriched['ready_for_import'].sum())}")
    print(enriched['enrichment_confidence'].value_counts().to_string())


if __name__ == "__main__":
    main()
