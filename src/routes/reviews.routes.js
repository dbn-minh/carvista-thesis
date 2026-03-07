import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

export const reviewsRoutes = Router();

// car reviews
const CreateCarReviewSchema = z.object({
  body: z.object({
    variant_id: z.number().int(),
    rating: z.number().int().min(1).max(5),
    title: z.string().optional(),
    comment: z.string().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

reviewsRoutes.post("/reviews/cars", requireAuth, validate(CreateCarReviewSchema), async (req, res, next) => {
  try {
    const { CarReviews } = req.ctx.models;
    const b = req.validated.body;

    // unique (user_id, variant_id) - will throw if duplicated
    const created = await CarReviews.create({
      user_id: req.user.userId,
      variant_id: b.variant_id,
      rating: b.rating,
      title: b.title ?? null,
      comment: b.comment ?? null,
    });

    res.status(201).json({ car_review_id: created.car_review_id });
  } catch (e) { next(e); }
});

reviewsRoutes.get("/reviews/cars", async (req, res, next) => {
  try {
    const { CarReviews } = req.ctx.models;
    const variantId = Number(req.query.variantId);
    const items = await CarReviews.findAll({
      where: { variant_id: variantId },
      order: [["created_at","DESC"]],
      limit: 50,
    });
    res.json({ items });
  } catch (e) { next(e); }
});

// seller reviews
const CreateSellerReviewSchema = z.object({
  body: z.object({
    seller_id: z.number().int(),
    listing_id: z.number().int().optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

reviewsRoutes.post("/reviews/sellers", requireAuth, validate(CreateSellerReviewSchema), async (req, res, next) => {
  try {
    const { SellerReviews } = req.ctx.models;
    const b = req.validated.body;

    const created = await SellerReviews.create({
      seller_id: b.seller_id,
      buyer_id: req.user.userId,
      listing_id: b.listing_id ?? null,
      rating: b.rating,
      comment: b.comment ?? null,
    });

    res.status(201).json({ seller_review_id: created.seller_review_id });
  } catch (e) { next(e); }
});

reviewsRoutes.get("/reviews/sellers", async (req, res, next) => {
  try {
    const { SellerReviews } = req.ctx.models;
    const sellerId = Number(req.query.sellerId);
    const items = await SellerReviews.findAll({
      where: { seller_id: sellerId },
      order: [["created_at","DESC"]],
      limit: 50,
    });
    res.json({ items });
  } catch (e) { next(e); }
});