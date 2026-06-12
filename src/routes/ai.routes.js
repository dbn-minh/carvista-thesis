// src/routes/ai.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { aiLimiter } from "../middlewares/rateLimit.middleware.js";
import { compareVariants } from "../services/ai/compare_variants.service.js";
import { chatAdvisor } from "../services/ai/car_advisor_chat.service.js";
import { mapAiHttpError } from "../services/ai/error_mapper.service.js";
import {
  calculateTcoWithCache,
  predictPriceWithCache,
} from "../services/cache/cached-ai.service.js";

export const aiRoutes = Router();
aiRoutes.use(requireAuth);
aiRoutes.use(aiLimiter);

aiRoutes.post("/ai/tco", async (req, res, next) => {
  try {
    let cacheStatus = "bypass";
    const out = await calculateTcoWithCache(req.ctx, req.body, {
      onStatus(status) {
        cacheStatus = status;
      },
    });
    res.set("X-Cache-Status", cacheStatus);
    res.json({
      ...out,
      meta: {
        ...(out?.meta || {}),
        cache: cacheStatus,
      },
    });
  } catch (e) {
    next(mapAiHttpError(e, "calculate_tco"));
  }
});

aiRoutes.post("/ai/predict-price", async (req, res, next) => {
  try {
    let cacheStatus = "bypass";
    const out = await predictPriceWithCache(req.ctx, req.body, {
      onStatus(status) {
        cacheStatus = status;
      },
    });
    res.set("X-Cache-Status", cacheStatus);
    res.json({
      ...out,
      meta: {
        ...(out?.meta || {}),
        cache: cacheStatus,
      },
    });
  } catch (e) {
    next(mapAiHttpError(e, "predict_vehicle_value"));
  }
});

aiRoutes.post("/ai/compare", async (req, res, next) => {
  try {
    const out = await compareVariants(req.ctx, req.body);
    res.json(out);
  } catch (e) {
    next(mapAiHttpError(e, "compare_car"));
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
    next(mapAiHttpError(e, "vehicle_general_qa"));
  }
});
