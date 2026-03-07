// src/services/ai/compare_variants.service.js
import { clamp } from "./_helpers.js";

const SPEC_WHITELIST = [
    "0_100_kmh",
    "top_speed_kmh",
    "fuel_consumption_l_100km",
    "energy_consumption_kwh_100km",
    "ground_clearance_mm",
    "cargo_capacity_l",
    "towing_capacity_kg",
    "wheel_size_inch",
    "safety_rating",
    "airbags_count",
    "adas_level",
    "lane_keep_assist",
    "adaptive_cruise_control",
    "blind_spot_monitor",
    "charging_dc_kw",
];

function parseFloatSafe(s) {
    if (s == null) return null;
    const cleaned = String(s).replace(/,/g, "").trim();
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
}

function buildProsCons(item) {
    const pros = [];
    const cons = [];

    const s = item.specs ?? {};
    if (s.power_hp != null && s.power_hp >= 250) pros.push("Strong power output (power_hp).");
    if (s.range_km != null && s.range_km >= 450) pros.push("Long EV range (range_km).");
    if (item.avg_rating != null && item.avg_rating >= 4.0) pros.push("Highly rated by users.");
    if (item.latest_price != null) pros.push("Has market price data available.");

    if (s.curb_weight_kg != null && s.curb_weight_kg >= 2200) cons.push("Heavy curb weight.");
    if (item.avg_rating != null && item.avg_rating < 3.0) cons.push("Lower user satisfaction.");
    if (item.latest_price != null && item.latest_price > 80000) cons.push("High market price (relative).");

    return { pros: pros.slice(0, 5), cons: cons.slice(0, 5) };
}

// scoring (deterministic)
function computeScores(items) {
    const priced = items.filter((x) => x.latest_price != null).map((x) => x.latest_price);
    const minP = priced.length ? Math.min(...priced) : null;
    const maxP = priced.length ? Math.max(...priced) : null;

    for (const it of items) {
        const rating_score = it.avg_rating != null ? clamp(it.avg_rating, 0, 5) * 10 : 0; // 0..50

        let price_score = 0;
        if (minP != null && maxP != null && it.latest_price != null) {
            if (minP === maxP) price_score = 17.5;
            else price_score = 35 * (1 - (it.latest_price - minP) / (maxP - minP)); // 0..35
        } else if (minP != null && maxP != null && it.latest_price == null) {
            // mixed null/non-null => neutral
            price_score = 17.5;
        } else {
            // no market prices => fallback msrp_base if available
            price_score = 0;
        }

        let practicality_score = 0;
        if (it.seats != null) practicality_score += it.seats >= 7 ? 6 : it.seats >= 5 ? 4 : 2;
        if (["suv", "cuv", "mpv", "pickup"].includes(it.body_type)) practicality_score += 4;
        if (["hybrid", "ev"].includes(it.fuel_type)) practicality_score += 3;
        if (it.specs?.range_km != null && it.specs.range_km >= 450) practicality_score += 2;
        practicality_score = clamp(practicality_score, 0, 15);

        it._scores = {
            rating_score,
            price_score,
            practicality_score,
            final_score: rating_score + price_score + practicality_score,
        };
    }
}

export async function compareVariants(ctx, input) {
    const variant_ids = input?.variant_ids;
    const market_id = input?.market_id == null ? null : Number(input.market_id);
    const price_type = input?.price_type ?? "avg_market";

    if (!Array.isArray(variant_ids) || variant_ids.length < 2 || variant_ids.length > 5) {
        throw { status: 400, message: "variant_ids must be array length 2..5" };
    }
    const ids = variant_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x));
    if (ids.length !== variant_ids.length) throw { status: 400, message: "variant_ids must be numeric" };
    if (market_id != null && !Number.isInteger(market_id)) throw { status: 400, message: "market_id must be int" };

    const {
        sequelize,
        models: { CarVariants, VariantSpecs, VariantSpecKv, CarReviews },
    } = ctx;

    // 1) base info (join make/model via raw SQL to keep it simple)
    const sqlBase = `
    SELECT
      cv.variant_id, cv.model_id, cv.model_year, cv.trim_name, cv.body_type, cv.fuel_type,
      cv.engine, cv.transmission, cv.drivetrain, cv.seats, cv.doors, cv.msrp_base,
      cm.name AS model_name,
      mk.name AS make_name
    FROM car_variants cv
    JOIN car_models cm ON cm.model_id = cv.model_id
    JOIN car_makes mk ON mk.make_id = cm.make_id
    WHERE cv.variant_id IN (:ids)
  `;
    const [baseRows] = await sequelize.query(sqlBase, { replacements: { ids } });

    // handle missing
    const foundIds = new Set(baseRows.map((r) => Number(r.variant_id)));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length) {
        return {
            status: "partial",
            missing_variant_ids: missing,
            items: baseRows,
            notes: "Some variant_ids not found",
        };
    }

    // 2) structured specs
    const specsRows = await VariantSpecs.findAll({ where: { variant_id: ids } });
    const specsMap = new Map(specsRows.map((s) => [Number(s.variant_id), s.toJSON()])); // safe json

    // 3) kv whitelist
    const kvRows = await VariantSpecKv.findAll({
        where: { variant_id: ids, spec_key: SPEC_WHITELIST },
        order: [["created_at", "DESC"]],
    });
    const kvMap = new Map(); // vid -> key -> item
    for (const r of kvRows) {
        const vid = Number(r.variant_id);
        if (!kvMap.has(vid)) kvMap.set(vid, new Map());
        const m = kvMap.get(vid);
        if (!m.has(r.spec_key)) {
            m.set(r.spec_key, {
                value: r.spec_value,
                unit: r.unit ?? null,
                source: r.source ?? null,
            });
        }
    }

    // 4) latest price per variant (optional)
    let priceMap = new Map();
    if (market_id != null) {
        const sqlPrice = `
      SELECT x.variant_id, x.price
      FROM variant_price_history x
      JOIN (
        SELECT variant_id, MAX(captured_at) AS max_t
        FROM variant_price_history
        WHERE market_id = :market_id AND price_type = :price_type AND variant_id IN (:ids)
        GROUP BY variant_id
      ) t ON t.variant_id = x.variant_id AND t.max_t = x.captured_at
      WHERE x.market_id = :market_id AND x.price_type = :price_type
    `;
        const [prices] = await sequelize.query(sqlPrice, { replacements: { market_id, price_type, ids } });
        priceMap = new Map(prices.map((p) => [Number(p.variant_id), Number(p.price)]));
    }

    // 5) avg rating + count
    const sqlRating = `
    SELECT variant_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
    FROM car_reviews
    WHERE variant_id IN (:ids)
    GROUP BY variant_id
  `;
    const [ratings] = await sequelize.query(sqlRating, { replacements: { ids } });
    const ratingMap = new Map(
        ratings.map((r) => [
            Number(r.variant_id),
            { avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null, review_count: Number(r.review_count || 0) },
        ])
    );

    const items = baseRows.map((b) => {
        const vid = Number(b.variant_id);
        const spec = specsMap.get(vid) ?? null;
        const kv = kvMap.get(vid);
        const kv_selected = kv ? Object.fromEntries(kv.entries()) : {};
        const rr = ratingMap.get(vid) ?? { avg_rating: null, review_count: 0 };

        const item = {
            variant_id: vid,
            make: b.make_name,
            model: b.model_name,
            year: b.model_year,
            trim: b.trim_name,
            body_type: b.body_type,
            fuel_type: b.fuel_type,
            engine: b.engine,
            transmission: b.transmission,
            drivetrain: b.drivetrain,
            seats: b.seats,
            doors: b.doors,
            msrp_base: b.msrp_base != null ? Number(b.msrp_base) : null,
            specs: spec,
            specs_kv_selected: kv_selected,
            latest_price: priceMap.get(vid) ?? null,
            avg_rating: rr.avg_rating,
            review_count: rr.review_count,
        };

        const pc = buildProsCons(item);
        item.pros = pc.pros;
        item.cons = pc.cons;
        return item;
    });

    computeScores(items);

    // comparison table (stable order)
    const tableKeys = [
        "engine",
        "fuel_type",
        "transmission",
        "drivetrain",
        "seats",
        "power_hp",
        "torque_nm",
        "range_km",
        "msrp_base",
        "latest_price",
        "avg_rating",
        ...SPEC_WHITELIST,
    ];

    const comparison_table = {};
    for (const key of tableKeys) {
        const row = {};
        for (const it of items) {
            const vid = it.variant_id;
            let v = null;

            if (key in it) v = it[key];
            else if (it.specs && key in it.specs) v = it.specs[key];
            else if (it.specs_kv_selected && it.specs_kv_selected[key]) v = it.specs_kv_selected[key];
            row[String(vid)] = v;
        }

        // drop row if all null/empty
        const allNull = Object.values(row).every((x) => x == null || (typeof x === "object" && x.value == null));
        if (!allNull) comparison_table[key] = row;
    }

    // recommended
    const sorted = [...items].sort((a, b) => b._scores.final_score - a._scores.final_score);
    const best = sorted[0];

    return {
        items: items.map((x) => ({
            ...x,
            scores: x._scores,
        })),
        comparison_table,
        recommended_variant_id: best?.variant_id ?? null,
        recommendation_reason: best
            ? `Selected by scoring: rating=${best._scores.rating_score.toFixed(1)}, price=${best._scores.price_score.toFixed(
                1
            )}, practicality=${best._scores.practicality_score.toFixed(1)}`
            : null,
        notes: market_id == null ? "market_id not provided; latest_price is null" : "",
    };
}