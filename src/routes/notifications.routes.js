import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

export const notificationsRoutes = Router();

notificationsRoutes.get("/notifications", requireAuth, async (req, res, next) => {
  try {
    const { Notifications } = req.ctx.models;
    const items = await Notifications.findAll({
      where: { user_id: req.user.userId },
      order: [["created_at","DESC"]],
      limit: 50,
    });
    res.json({ items });
  } catch (e) { next(e); }
});

notificationsRoutes.patch("/notifications/:id/read", requireAuth, async (req, res, next) => {
  try {
    const { Notifications } = req.ctx.models;
    const id = Number(req.params.id);

    const n = await Notifications.findByPk(id);
    if (!n) return next({ status: 404, message: "Notification not found" });
    if (n.user_id !== req.user.userId) return next({ status: 403, message: "Forbidden" });

    await n.update({ status: "read", read_at: new Date() });
    res.json({ ok: true });
  } catch (e) { next(e); }
});