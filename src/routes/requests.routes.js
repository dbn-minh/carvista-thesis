import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { createViewingRequestService } from "../services/viewing-requests/viewing-request.service.js";

export const requestsRoutes = Router();

const CreateRequestSchema = z.object({
  body: z.object({
    message: z.string().optional(),
    contact_name: z.string().optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().optional(),
    preferred_contact_method: z.enum(["phone", "email", "phone_or_email"]).optional(),
    preferred_viewing_time: z.string().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

requestsRoutes.post(
  "/listings/:id/requests",
  requireAuth,
  validate(CreateRequestSchema),
  async (req, res, next) => {
    try {
      const listingId = Number(req.params.id);
      const viewingRequestService = createViewingRequestService(req.ctx);
      const payload = req.validated.body;
      const result = await viewingRequestService.createRequest({
        listingId,
        requesterUserId: req.user.userId,
        contactName: payload.contact_name,
        contactEmail: payload.contact_email,
        contactPhone: payload.contact_phone,
        preferredContactMethod: payload.preferred_contact_method,
        preferredViewingTime: payload.preferred_viewing_time,
        message: payload.message,
      });

      res.status(201).json({
        request_id: result.viewingRequest.request_id,
        request: result.viewingRequest,
        seller_notified: result.sellerNotified,
        notification_provider: result.notificationProvider,
      });
    } catch (e) {
      next(e);
    }
  }
);

requestsRoutes.get("/requests/outbox", requireAuth, async (req, res, next) => {
  try {
    const viewingRequestService = createViewingRequestService(req.ctx);
    const items = await viewingRequestService.listOutbox(req.user.userId);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

requestsRoutes.get("/requests/inbox", requireAuth, async (req, res, next) => {
  try {
    const viewingRequestService = createViewingRequestService(req.ctx);
    const items = await viewingRequestService.listInbox(req.user.userId);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

const UpdateReqSchema = z.object({
  body: z.object({
    status: z.enum([
      "new",
      "contacted",
      "no_answer",
      "follow_up_needed",
      "scheduled",
      "completed",
      "closed",
      "cancelled",
    ]),
  }),
  query: z.any(),
  params: z.any(),
});

requestsRoutes.patch(
  "/requests/:id/status",
  requireAuth,
  validate(UpdateReqSchema),
  async (req, res, next) => {
    try {
      const viewingRequestService = createViewingRequestService(req.ctx);
      await viewingRequestService.updateStatus({
        requestId: Number(req.params.id),
        actorUserId: req.user.userId,
        status: req.validated.body.status,
      });

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);
