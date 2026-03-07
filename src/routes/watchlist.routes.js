import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

export const watchlistRoutes = Router();

// watched variants
watchlistRoutes.post("/watchlist/variants/:id", requireAuth, async (req, res, next) => {
  try {
    const { WatchedVariants, SavedLogs } = req.ctx.models;
    const variantId = Number(req.params.id);

    await WatchedVariants.findOrCreate({ where: { user_id: req.user.userId, variant_id: variantId } });
    await SavedLogs.create({ user_id: req.user.userId, entity_type: "variant", entity_id: variantId, action: "saved" });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

watchlistRoutes.delete("/watchlist/variants/:id", requireAuth, async (req, res, next) => {
  try {
    const { WatchedVariants, SavedLogs } = req.ctx.models;
    const variantId = Number(req.params.id);

    await WatchedVariants.destroy({ where: { user_id: req.user.userId, variant_id: variantId } });
    await SavedLogs.create({ user_id: req.user.userId, entity_type: "variant", entity_id: variantId, action: "unsaved" });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

watchlistRoutes.get("/watchlist/variants", requireAuth, async (req, res, next) => {
  try {
    const { WatchedVariants } = req.ctx.models;
    const items = await WatchedVariants.findAll({ where: { user_id: req.user.userId } });
    res.json({ items });
  } catch (e) { next(e); }
});

// saved listings
watchlistRoutes.post("/watchlist/listings/:id", requireAuth, async (req, res, next) => {
  try {
    const { SavedListings, SavedLogs } = req.ctx.models;
    const listingId = Number(req.params.id);

    await SavedListings.findOrCreate({ where: { user_id: req.user.userId, listing_id: listingId } });
    await SavedLogs.create({ user_id: req.user.userId, entity_type: "listing", entity_id: listingId, action: "saved" });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

watchlistRoutes.delete("/watchlist/listings/:id", requireAuth, async (req, res, next) => {
  try {
    const { SavedListings, SavedLogs } = req.ctx.models;
    const listingId = Number(req.params.id);

    await SavedListings.destroy({ where: { user_id: req.user.userId, listing_id: listingId } });
    await SavedLogs.create({ user_id: req.user.userId, entity_type: "listing", entity_id: listingId, action: "unsaved" });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

watchlistRoutes.get("/watchlist/listings", requireAuth, async (req, res, next) => {
  try {
    const { SavedListings } = req.ctx.models;
    const items = await SavedListings.findAll({ where: { user_id: req.user.userId } });
    res.json({ items });
  } catch (e) { next(e); }
});