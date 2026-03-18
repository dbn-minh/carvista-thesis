import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { addVariantPricePoint } from "../services/price.service.js";

export const adminRoutes = Router();
adminRoutes.use("/admin", requireAuth, requireRole("admin"));

// manage users
adminRoutes.get("/admin/users", async (req, res, next) => {
  try {
    const { Users } = req.ctx.models;
    const items = await Users.findAll({ attributes: ["user_id","name","email","phone","role"], limit: 200 });
    res.json({ items });
  } catch (e) { next(e); }
});

const UpdateUserRoleSchema = z.object({
  body: z.object({ role: z.enum(["user","admin"]) }),
  query: z.any(),
  params: z.any(),
});
adminRoutes.patch("/admin/users/:id/role", validate(UpdateUserRoleSchema), async (req, res, next) => {
  try {
    const { Users } = req.ctx.models;
    const id = Number(req.params.id);
    const u = await Users.findByPk(id);
    if (!u) return next({ status: 404, message: "User not found" });
    await u.update({ role: req.validated.body.role });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// view reports
adminRoutes.get("/admin/reports", async (req, res, next) => {
  try {
    const { Reports } = req.ctx.models;
    const items = await Reports.findAll({ order: [["created_at","DESC"]], limit: 100 });
    res.json({ items });
  } catch (e) { next(e); }
});

const UpdateReportSchema = z.object({
  body: z.object({ status: z.enum(["reviewing","resolved","rejected"]) }),
  query: z.any(),
  params: z.any(),
});
adminRoutes.patch("/admin/reports/:id", validate(UpdateReportSchema), async (req, res, next) => {
  try {
    const { Reports } = req.ctx.models;
    const id = Number(req.params.id);
    const r = await Reports.findByPk(id);
    if (!r) return next({ status: 404, message: "Report not found" });

    await r.update({
      status: req.validated.body.status,
      resolved_at: new Date(),
      resolved_by: req.user.userId,
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// update car price -> trigger price drop notifications
const AddPriceSchema = z.object({
  body: z.object({
    market_id: z.number().int(),
    price: z.number(),
    captured_at: z.string().optional(), // ISO
    source: z.string().optional(),
  }),
  query: z.any(),
  params: z.any(),
});
adminRoutes.post("/admin/variants/:id/price", validate(AddPriceSchema), async (req, res, next) => {
  try {
    const variantId = Number(req.params.id);
    const b = req.validated.body;

    const created = await addVariantPricePoint(req.ctx, {
      variantId,
      marketId: b.market_id,
      price: b.price,
      capturedAt: b.captured_at ? new Date(b.captured_at) : new Date(),
      source: b.source ?? "admin",
    });

    res.status(201).json({ price_id: created.price_id });
  } catch (e) { next(e); }
});
