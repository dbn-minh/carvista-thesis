import { Router } from "express";
import { calculateTco } from "../services/ai/tco.service.js";
import { buildVariantPageIntelligence } from "../services/ai/page_intelligence.service.js";
import { parsePreferenceProfileQuery } from "../services/ai/user_preference_profile.service.js";

export const catalogRoutes = Router();

function parseNumber(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function isTruthyFlag(value) {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function buildCompareReadyClause(alias = "cv", specAlias = "vs") {
  return `
    ${alias}.body_type IS NOT NULL
    AND ${alias}.body_type <> ''
    AND ${alias}.body_type <> 'other'
    AND ${alias}.fuel_type IS NOT NULL
    AND ${alias}.fuel_type <> ''
    AND ${alias}.fuel_type <> 'other'
    AND ${alias}.transmission IS NOT NULL
    AND ${alias}.transmission <> ''
    AND (
      ${alias}.fuel_type = 'ev'
      OR (
        ${alias}.drivetrain IS NOT NULL
        AND ${alias}.drivetrain <> ''
        AND (
          (${alias}.engine IS NOT NULL AND ${alias}.engine <> '')
          OR ${specAlias}.displacement_cc IS NOT NULL
        )
      )
    )
  `;
}

catalogRoutes.get("/catalog/makes", async (req, res, next) => {
  try {
    const { CarMakes } = req.ctx.models;
    const items = await CarMakes.findAll({ order: [["name","ASC"]] });
    res.json({ items });
  } catch (e) { next(e); }
});

catalogRoutes.get("/catalog/models", async (req, res, next) => {
  try {
    const { CarModels } = req.ctx.models;
    const { makeId } = req.query;
    const where = makeId ? { make_id: Number(makeId) } : {};
    const items = await CarModels.findAll({ where, order: [["name","ASC"]] });
    res.json({ items });
  } catch (e) { next(e); }
});

catalogRoutes.get("/catalog/variants", async (req, res, next) => {
  try {
    const { sequelize } = req.ctx;
    const { make, model, year, fuel, bodyType, q, compareReady } = req.query;
    const compareReadyOnly = isTruthyFlag(compareReady);

    const where = [];
    const params = {};

    if (make) { where.push("mk.name = :make"); params.make = make; }
    if (model) { where.push("cm.name = :model"); params.model = model; }
    if (year) { where.push("cv.model_year = :year"); params.year = Number(year); }
    if (fuel) { where.push("cv.fuel_type = :fuel"); params.fuel = fuel; }
    if (bodyType) { where.push("cv.body_type = :bodyType"); params.bodyType = bodyType; }
    if (q) {
      where.push(`(
        cm.name LIKE :q
        OR mk.name LIKE :q
        OR cv.trim_name LIKE :q
        OR CONCAT_WS(' ', cv.model_year, mk.name, cm.name, cv.trim_name) LIKE :q
        OR CONCAT_WS(' ', mk.name, cm.name, cv.trim_name) LIKE :q
        OR CONCAT_WS(' ', cv.model_year, mk.name, cm.name) LIKE :q
        OR CONCAT_WS(' ', mk.name, cm.name) LIKE :q
      )`);
      params.q = `%${q}%`;
    }
    if (compareReadyOnly) {
      where.push(buildCompareReadyClause("cv", "vs"));
    }

    const sql = `
      SELECT
        cv.variant_id, cv.model_year, cv.trim_name, cv.body_type, cv.fuel_type,
        cv.engine, cv.transmission, cv.drivetrain, cv.msrp_base,
        cm.model_id, cm.name AS model_name,
        mk.make_id, mk.name AS make_name,
        ${compareReadyOnly ? "TRUE" : buildCompareReadyClause("cv", "vs")} AS compare_ready
      FROM car_variants cv
      JOIN car_models cm ON cm.model_id = cv.model_id
      JOIN car_makes mk ON mk.make_id = cm.make_id
      LEFT JOIN variant_specs vs ON vs.variant_id = cv.variant_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY mk.name, cm.name, cv.model_year DESC, cv.trim_name
      LIMIT 200
    `;
    const [items] = await sequelize.query(sql, { replacements: params });
    res.json({ items });
  } catch (e) { next(e); }
});

catalogRoutes.get("/catalog/variants/:id", async (req, res, next) => {
  try {
    const { sequelize, models: { VariantSpecs, VariantSpecKv, VariantImages } } = req.ctx;
    const id = Number(req.params.id);
    const compareReadyOnly = isTruthyFlag(req.query.compareReady);

    const sql = `
      SELECT
        cv.*,
        cm.name AS model_name,
        mk.name AS make_name,
        ${buildCompareReadyClause("cv", "vs")} AS compare_ready
      FROM car_variants cv
      JOIN car_models cm ON cm.model_id = cv.model_id
      JOIN car_makes mk ON mk.make_id = cm.make_id
      LEFT JOIN variant_specs vs ON vs.variant_id = cv.variant_id
      WHERE cv.variant_id = :id
      LIMIT 1
    `;
    const [rows] = await sequelize.query(sql, { replacements: { id } });
    const variant = rows[0] ?? null;
    if (!variant) return next({ status: 404, message: "Variant not found" });
    if (compareReadyOnly && !variant.compare_ready) {
      return next({
        status: 404,
        safe: true,
        message: "This vehicle is not available as a compare-ready catalog variant.",
      });
    }

    const spec = await VariantSpecs.findByPk(id);
    const kv = await VariantSpecKv.findAll({ where: { variant_id: id }, limit: 50, order: [["spec_key","ASC"]] });
    const images = await VariantImages.findAll({ where: { variant_id: id }, order: [["sort_order","ASC"]] });

    res.json({ variant, spec, kv, images });
  } catch (e) { next(e); }
});

catalogRoutes.get("/catalog/variants/:id/ai-insights", async (req, res, next) => {
  try {
    const variantId = Number(req.params.id);
    if (!Number.isFinite(variantId)) {
      return next({ status: 400, safe: true, message: "Invalid variant id." });
    }

    const marketId = parseNumber(req.query.marketId, 1);
    const ownershipYears = parseNumber(req.query.ownershipYears, 5);
    const kmPerYear = parseNumber(req.query.kmPerYear, null);
    const profile = parsePreferenceProfileQuery(req.query);

    const intelligence = await buildVariantPageIntelligence(req.ctx, {
      variantId,
      marketId,
      ownershipYears,
      kmPerYear,
      profile,
    });

    res.json(intelligence);
  } catch (e) { next(e); }
});

catalogRoutes.get("/catalog/variants/:id/price-history", async (req, res, next) => {
  try {
    const { VariantPriceHistory } = req.ctx.models;
    const variantId = Number(req.params.id);
    const marketId = Number(req.query.marketId);
    const limit = Number(req.query.limit || 50);

    const items = await VariantPriceHistory.findAll({
      where: { variant_id: variantId, market_id: marketId },
      order: [["captured_at","DESC"]],
      limit,
    });

    res.json({ items: items.reverse() });
  } catch (e) { next(e); }
});

catalogRoutes.get("/catalog/variants/:id/ownership-summary", async (req, res, next) => {
  try {
    const { CarVariants, TcoProfiles, VariantPriceHistory } = req.ctx.models;
    const variantId = Number(req.params.id);
    const marketId = Number(req.query.marketId || 1);
    const ownershipYears = Number(req.query.ownershipYears || 5);
    const kmPerYear = req.query.kmPerYear == null ? null : Number(req.query.kmPerYear);

    const variant = await CarVariants.findByPk(variantId);
    if (!variant) return next({ status: 404, message: "Variant not found" });

    const latestMarketPrice = await VariantPriceHistory.findOne({
      where: {
        variant_id: variantId,
        market_id: marketId,
        price_type: "avg_market",
      },
      order: [["captured_at", "DESC"]],
    });

    const basePrice =
      latestMarketPrice?.price != null
        ? Number(latestMarketPrice.price)
        : variant.msrp_base != null
          ? Number(variant.msrp_base)
          : null;

    if (!Number.isFinite(basePrice) || basePrice == null) {
      return res.status(400).json({
        status: "error",
        code: "BASE_PRICE_UNAVAILABLE",
        message: "No usable market price or MSRP is available for this variant.",
      });
    }

    const profile = await TcoProfiles.findOne({
      where: { market_id: marketId },
      order: [["profile_id", "ASC"]],
    });

    if (!profile) {
      return res.status(404).json({
        status: "error",
        code: "PROFILE_NOT_FOUND",
        message: `No TCO profile exists for market ${marketId}.`,
      });
    }

    const estimate = await calculateTco(req.ctx, {
      profile_id: profile.profile_id,
      base_price: basePrice,
      ownership_years: ownershipYears,
      km_per_year: kmPerYear,
    });

    res.json({
      variant_id: variantId,
      market_id: marketId,
      ownership_years: ownershipYears,
      base_price_source: latestMarketPrice?.price != null ? "avg_market_latest" : "msrp_base",
      estimate,
    });
  } catch (e) { next(e); }
});
