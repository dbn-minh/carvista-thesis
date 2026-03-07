import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

export const listingsRoutes = Router();

listingsRoutes.get("/listings", async (req, res, next) => {
  try {
    const { Listings } = req.ctx.models;
    const { status = "active", ownerId, variantId } = req.query;

    const where = { status };
    if (ownerId) where.owner_id = Number(ownerId);
    if (variantId) where.variant_id = Number(variantId);

    const items = await Listings.findAll({ where, order: [["created_at","DESC"]], limit: 50 });
    res.json({ items });
  } catch (e) { next(e); }
});

listingsRoutes.get("/listings/:id", async (req, res, next) => {
  try {
    const { Listings, ListingImages } = req.ctx.models;
    const id = Number(req.params.id);

    const listing = await Listings.findByPk(id);
    if (!listing) return next({ status: 404, message: "Listing not found" });

    const images = await ListingImages.findAll({ where: { listing_id: id }, order: [["sort_order","ASC"]] });
    res.json({ listing, images });
  } catch (e) { next(e); }
});

const CreateListingSchema = z.object({
  body: z.object({
    variant_id: z.number().int(),
    asking_price: z.number(),
    mileage_km: z.number().int().optional(),
    location_city: z.string().optional(),
    location_country_code: z.string().length(2).optional(),
    description: z.string().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

listingsRoutes.post("/listings", requireAuth, validate(CreateListingSchema), async (req, res, next) => {
  try {
    const { Listings } = req.ctx.models;
    const b = req.validated.body;

    const created = await Listings.create({
      owner_id: req.user.userId,
      variant_id: b.variant_id,
      asking_price: b.asking_price,
      mileage_km: b.mileage_km ?? null,
      location_city: b.location_city ?? null,
      location_country_code: b.location_country_code ?? "VN",
      status: "active",
      description: b.description ?? null,
    });

    res.status(201).json({ listing_id: created.listing_id });
  } catch (e) { next(e); }
});

const UpdateListingSchema = z.object({
  body: z.object({
    asking_price: z.number().optional(),
    mileage_km: z.number().int().optional(),
    location_city: z.string().optional(),
    location_country_code: z.string().length(2).optional(),
    description: z.string().optional(),
    status: z.enum(["active","reserved","sold","hidden"]).optional(),
  }),
  query: z.any(),
  params: z.any(),
});

listingsRoutes.put("/listings/:id", requireAuth, validate(UpdateListingSchema), async (req, res, next) => {
  try {
    const { Listings, ListingPriceHistory } = req.ctx.models;
    const id = Number(req.params.id);

    const listing = await Listings.findByPk(id);
    if (!listing) return next({ status: 404, message: "Listing not found" });
    if (listing.owner_id !== req.user.userId) return next({ status: 403, message: "Forbidden" });

    const b = req.validated.body;

    // record price history if price changes
    if (b.asking_price != null && Number(b.asking_price) !== Number(listing.asking_price)) {
      await ListingPriceHistory.create({ listing_id: id, price: b.asking_price, note: "user_update" });
    }

    await listing.update(b);
    res.json({ ok: true });
  } catch (e) { next(e); }
});