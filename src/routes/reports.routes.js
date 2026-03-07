import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

export const reportsRoutes = Router();

const CreateReportSchema = z.object({
  body: z.object({
    entity_type: z.enum(["listing","car_review","seller_review","user"]),
    entity_id: z.number().int(),
    reason: z.string().min(3),
  }),
  query: z.any(),
  params: z.any(),
});

reportsRoutes.post("/reports", requireAuth, validate(CreateReportSchema), async (req, res, next) => {
  try {
    const { Reports } = req.ctx.models;
    const b = req.validated.body;

    const created = await Reports.create({
      reporter_id: req.user.userId,
      entity_type: b.entity_type,
      entity_id: b.entity_id,
      reason: b.reason,
      status: "pending",
      resolved_at: null,
      resolved_by: null,
    });

    res.status(201).json({ report_id: created.report_id });
  } catch (e) { next(e); }
});