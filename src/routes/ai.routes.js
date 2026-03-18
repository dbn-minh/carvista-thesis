// src/routes/ai.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { calculateTco } from "../services/ai/tco.service.js";
import { predictPrice } from "../services/ai/predict_price.service.js";
import { compareVariants } from "../services/ai/compare_variants.service.js";
import { chatAdvisor } from "../services/ai/car_advisor_chat.service.js";

export const aiRoutes = Router();
aiRoutes.use(requireAuth);

aiRoutes.post("/ai/tco", async (req, res, next) => {
  try {
    const out = await calculateTco(req.ctx, req.body);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

aiRoutes.post("/ai/predict-price", async (req, res, next) => {
  try {
    const out = await predictPrice(req.ctx, req.body);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

aiRoutes.post("/ai/compare", async (req, res, next) => {
  try {
    const out = await compareVariants(req.ctx, req.body);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

aiRoutes.post("/ai/chat", async (req, res, next) => {
  try {
    const out = await chatAdvisor(req.ctx, {
      ...req.body,
      user_id: req.user.userId,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});
