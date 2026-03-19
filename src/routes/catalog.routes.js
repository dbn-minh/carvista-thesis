import { Router } from "express";
import { calculateTco } from "../services/ai/tco.service.js";

export const catalogRoutes = Router();

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
    const { make, model, year, fuel, bodyType, q } = req.query;

    const where = [];
    const params = {};

    if (make) { where.push("mk.name = :make"); params.make = make; }
    if (model) { where.push("cm.name = :model"); params.model = model; }
    if (year) { where.push("cv.model_year = :year"); params.year = Number(year); }
    if (fuel) { where.push("cv.fuel_type = :fuel"); params.fuel = fuel; }
    if (bodyType) { where.push("cv.body_type = :bodyType"); params.bodyType = bodyType; }
    if (q) { where.push("(cm.name LIKE :q OR mk.name LIKE :q OR cv.trim_name LIKE :q)"); params.q = `%${q}%`; }

    const sql = `
      SELECT
        cv.variant_id, cv.model_year, cv.trim_name, cv.body_type, cv.fuel_type,
        cv.engine, cv.transmission, cv.drivetrain, cv.msrp_base,
        cm.model_id, cm.name AS model_name,
        mk.make_id, mk.name AS make_name
      FROM car_variants cv
      JOIN car_models cm ON cm.model_id = cv.model_id
      JOIN car_makes mk ON mk.make_id = cm.make_id
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

    const sql = `
      SELECT
        cv.*,
        cm.name AS model_name,
        mk.name AS make_name
      FROM car_variants cv
      JOIN car_models cm ON cm.model_id = cv.model_id
      JOIN car_makes mk ON mk.make_id = cm.make_id
      WHERE cv.variant_id = :id
      LIMIT 1
    `;
    const [rows] = await sequelize.query(sql, { replacements: { id } });
    const variant = rows[0] ?? null;
    if (!variant) return next({ status: 404, message: "Variant not found" });

    const spec = await VariantSpecs.findByPk(id);
    const kv = await VariantSpecKv.findAll({ where: { variant_id: id }, limit: 50, order: [["spec_key","ASC"]] });
    const images = await VariantImages.findAll({ where: { variant_id: id }, order: [["sort_order","ASC"]] });

    res.json({ variant, spec, kv, images });
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
      order: [["captured_at","ASC"]],
      limit,
    });

    res.json({ items });
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
