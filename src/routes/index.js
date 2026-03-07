import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { catalogRoutes } from "./catalog.routes.js";
import { listingsRoutes } from "./listings.routes.js";
import { requestsRoutes } from "./requests.routes.js";
import { reviewsRoutes } from "./reviews.routes.js";
import { watchlistRoutes } from "./watchlist.routes.js";
import { notificationsRoutes } from "./notifications.routes.js";
import { reportsRoutes } from "./reports.routes.js";
import { adminRoutes } from "./admin.routes.js";
import { aiRoutes } from "./ai.routes.js";   // ✅ add

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ ok: true }));

apiRouter.use(authRoutes);
apiRouter.use(catalogRoutes);
apiRouter.use(listingsRoutes);
apiRouter.use(requestsRoutes);
apiRouter.use(reviewsRoutes);
apiRouter.use(watchlistRoutes);
apiRouter.use(notificationsRoutes);
apiRouter.use(reportsRoutes);
apiRouter.use(adminRoutes);
apiRouter.use(aiRoutes);
