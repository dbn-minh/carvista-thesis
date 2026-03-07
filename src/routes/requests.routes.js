import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { createNotification } from "../services/notify.service.js";

export const requestsRoutes = Router();

const CreateRequestSchema = z.object({
  body: z.object({
    message: z.string().optional(),
    contact_name: z.string().optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

requestsRoutes.post("/listings/:id/requests", requireAuth, validate(CreateRequestSchema), async (req, res, next) => {
  try {
    const { Listings, ViewingRequests, Notifications, Users } = req.ctx.models;
    const listingId = Number(req.params.id);

    const listing = await Listings.findByPk(listingId);
    if (!listing) return next({ status: 404, message: "Listing not found" });
    if (listing.owner_id === req.user.userId) return next({ status: 400, message: "Cannot request your own listing" });

    const b = req.validated.body;
    const buyer = await Users.findByPk(req.user.userId);

    const vr = await ViewingRequests.create({
      listing_id: listingId,
      buyer_id: req.user.userId,
      contact_name: b.contact_name ?? buyer?.name ?? null,
      contact_email: b.contact_email ?? buyer?.email ?? null,
      contact_phone: b.contact_phone ?? buyer?.phone ?? null,
      message: b.message ?? null,
      status: "pending",
    });

    await createNotification(
      { Notifications },
      listing.owner_id,
      "viewing_request",
      vr.request_id,
      "New viewing request",
      `You received a new request for listing #${listingId}.`
    );

    res.status(201).json({ request_id: vr.request_id });
  } catch (e) { next(e); }
});

// buyer outbox
requestsRoutes.get("/requests/outbox", requireAuth, async (req, res, next) => {
  try {
    const { ViewingRequests } = req.ctx.models;
    const items = await ViewingRequests.findAll({
      where: { buyer_id: req.user.userId },
      order: [["created_at","DESC"]],
      limit: 50,
    });
    res.json({ items });
  } catch (e) { next(e); }
});

// seller inbox
requestsRoutes.get("/requests/inbox", requireAuth, async (req, res, next) => {
  try {
    const { sequelize } = req.ctx;
    const sql = `
      SELECT vr.*
      FROM viewing_requests vr
      JOIN listings l ON l.listing_id = vr.listing_id
      WHERE l.owner_id = :ownerId
      ORDER BY vr.created_at DESC
      LIMIT 50
    `;
    const [items] = await sequelize.query(sql, { replacements: { ownerId: req.user.userId } });
    res.json({ items });
  } catch (e) { next(e); }
});

const UpdateReqSchema = z.object({
  body: z.object({
    status: z.enum(["accepted","rejected","cancelled"]),
  }),
  query: z.any(),
  params: z.any(),
});

requestsRoutes.patch("/requests/:id/status", requireAuth, validate(UpdateReqSchema), async (req, res, next) => {
  try {
    const { ViewingRequests, Listings, Notifications } = req.ctx.models;
    const id = Number(req.params.id);
    const b = req.validated.body;

    const vr = await ViewingRequests.findByPk(id);
    if (!vr) return next({ status: 404, message: "Request not found" });

    const listing = await Listings.findByPk(vr.listing_id);

    // permissions:
    // seller can accept/reject, buyer can cancel
    const isSeller = listing?.owner_id === req.user.userId;
    const isBuyer = vr.buyer_id === req.user.userId;

    if (b.status === "cancelled" && !isBuyer) return next({ status: 403, message: "Only buyer can cancel" });
    if ((b.status === "accepted" || b.status === "rejected") && !isSeller)
      return next({ status: 403, message: "Only seller can accept/reject" });

    await vr.update({ status: b.status });

    // notify buyer on accept/reject
    if (b.status === "accepted" || b.status === "rejected") {
      await createNotification(
        { Notifications },
        vr.buyer_id,
        "viewing_request",
        vr.request_id,
        "Request update",
        `Your request for listing #${vr.listing_id} was ${b.status}.`
      );
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});