import {
  processViewingRequestCreatedNotification,
  processViewingRequestUpdatedNotification,
} from "../notifications/notification-job.service.js";
import { enqueueNotificationJob } from "../queue/queue.service.js";
import { normalizePhoneNumberOrNull } from "../shared/phone-normalization.service.js";
import { ensureViewingRequestSchema } from "./viewing-request-schema.service.js";

const SELLER_FOLLOW_UP_STATUSES = new Set([
  "new",
  "contacted",
  "no_answer",
  "follow_up_needed",
  "scheduled",
  "completed",
  "closed",
]);

export class ViewingRequestService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async dispatchNotificationJob({ type, payload, jobId, fallback }) {
    const queueResult = await enqueueNotificationJob(type, payload, { jobId });
    if (queueResult.queued) {
      console.log("[viewing-request] notification queued", {
        type,
        jobId,
      });
      return {
        queued: true,
        provider: "bullmq",
        fallbackUsed: false,
        result: null,
      };
    }

    let fallbackResult = null;
    try {
      fallbackResult = typeof fallback === "function" ? await fallback() : null;
      console.log("[viewing-request] notification fallback completed inline", {
        type,
        jobId,
      });
    } catch (error) {
      console.warn("[viewing-request] notification fallback failed", {
        type,
        message: error?.message || String(error),
      });
    }

    return {
      queued: false,
      provider: fallbackResult?.notificationProvider ?? null,
      fallbackUsed: true,
      result: fallbackResult,
    };
  }

  async createRequest({
    listingId,
    requesterUserId,
    contactName,
    contactEmail,
    contactPhone,
    preferredContactMethod,
    preferredViewingTime,
    message,
  }) {
    await ensureViewingRequestSchema(this.ctx);

    const {
      Listings,
      ViewingRequests,
      Users,
      CarVariants,
      CarModels,
      CarMakes,
    } = this.ctx.models;

    const listing = await Listings.findByPk(listingId, {
      include: [
        {
          model: CarVariants,
          as: "variant",
          attributes: ["variant_id", "model_year", "trim_name"],
          include: [
            {
              model: CarModels,
              as: "model",
              attributes: ["name"],
              include: [
                {
                  model: CarMakes,
                  as: "make",
                  attributes: ["name"],
                },
              ],
            },
          ],
        },
        {
          model: Users,
          as: "owner",
          attributes: ["user_id", "name", "email", "phone"],
        },
      ],
    });

    if (!listing) {
      throw { status: 404, safe: true, message: "Listing not found" };
    }

    if (listing.owner_id === requesterUserId) {
      throw {
        status: 400,
        safe: true,
        message: "You cannot request a viewing for your own listing.",
      };
    }

    const requester = await Users.findByPk(requesterUserId, {
      attributes: [
        "user_id",
        "name",
        "email",
        "phone",
        "preferred_contact_method",
      ],
    });

    const effectiveContact = {
      contactName: contactName ?? requester?.name ?? null,
      contactEmail: contactEmail ?? requester?.email ?? null,
      contactPhone: normalizePhoneNumberOrNull(contactPhone ?? requester?.phone),
      preferredContactMethod:
        preferredContactMethod ?? requester?.preferred_contact_method ?? null,
    };

    const missingFields = [];
    if (!effectiveContact.contactEmail) missingFields.push("email");
    if (!effectiveContact.contactPhone) missingFields.push("phone");

    if (missingFields.length > 0) {
      throw {
        status: 400,
        safe: true,
        message:
          "Please add your email address and phone number to your profile before sending a viewing request.",
        details: {
          code: "missing_contact_profile",
          missing_fields: missingFields,
        },
      };
    }

    let transaction = null;
    const recentRequests = await ViewingRequests.findAll({
      where: {
        listing_id: listingId,
        buyer_id: requesterUserId,
      },
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    const existingActiveRequest = recentRequests
      .map((item) => normalizeViewingRequest(item))
      .find((item) => isActiveViewingRequestStatus(item.status));

    if (existingActiveRequest) {
      throw {
        status: 409,
        safe: true,
        message: "You already sent a viewing request for this listing.",
        details: {
          code: "request_already_exists",
          request_id: existingActiveRequest.request_id,
          status: existingActiveRequest.status,
        },
      };
    }

    try {
      transaction = await this.ctx.sequelize.transaction();
      const viewingRequest = await ViewingRequests.create(
        {
          listing_id: listingId,
          buyer_id: requesterUserId,
          seller_user_id: listing.owner_id,
          contact_name: effectiveContact.contactName,
          contact_email: effectiveContact.contactEmail,
          contact_phone: effectiveContact.contactPhone,
          preferred_contact_method: effectiveContact.preferredContactMethod,
          preferred_viewing_time: preferredViewingTime ?? null,
          message: message ?? null,
          status: "pending",
          follow_up_status: "new",
          notified_at: null,
        },
        { transaction }
      );
      await transaction.commit();
      transaction = null;

      const notificationResult = await this.dispatchNotificationJob({
        type: "viewingRequestCreated",
        payload: { requestId: viewingRequest.request_id },
        jobId: `viewing-request-created:${viewingRequest.request_id}`,
        fallback: async () =>
          processViewingRequestCreatedNotification(this.ctx, {
            requestId: viewingRequest.request_id,
          }),
      });

      return {
        viewingRequest: normalizeViewingRequest(viewingRequest),
        sellerNotified: Boolean(notificationResult.result?.sellerNotified),
        buyerNotified: Boolean(notificationResult.result?.buyerNotified),
        notificationProvider: notificationResult.provider,
        notificationQueued: notificationResult.queued,
      };
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  async listOutbox(userId) {
    await ensureViewingRequestSchema(this.ctx);
    const items = await this.ctx.models.ViewingRequests.findAll({
      where: { buyer_id: userId },
      order: [["created_at", "DESC"]],
      limit: 50,
    });
    return items.map((item) => normalizeViewingRequest(item));
  }

  async listInbox(ownerId) {
    await ensureViewingRequestSchema(this.ctx);
    const { sequelize } = this.ctx;
    const sql = `
      SELECT vr.*
      FROM viewing_requests vr
      JOIN listings l ON l.listing_id = vr.listing_id
      WHERE l.owner_id = :ownerId
      ORDER BY vr.created_at DESC
      LIMIT 50
    `;
    const [items] = await sequelize.query(sql, { replacements: { ownerId } });
    return items.map((item) => normalizeViewingRequest(item));
  }

  async updateStatus({ requestId, actorUserId, status }) {
    await ensureViewingRequestSchema(this.ctx);
    const { ViewingRequests, Listings } = this.ctx.models;
    let transaction = null;

    try {
      transaction = await this.ctx.sequelize.transaction();
      const vr = await ViewingRequests.findByPk(requestId, { transaction });
      if (!vr) {
        throw { status: 404, safe: true, message: "Request not found" };
      }

      const listing = await Listings.findByPk(vr.listing_id, { transaction });
      const isSeller = listing?.owner_id === actorUserId;
      const isBuyer = vr.buyer_id === actorUserId;

      if (status === "cancelled" && !isBuyer) {
        throw {
          status: 403,
          safe: true,
          message: "Only the buyer can cancel this request.",
        };
      }

      if (status !== "cancelled" && !isSeller) {
        throw {
          status: 403,
          safe: true,
          message: "Only the seller can update this request status.",
        };
      }

      if (vr.status === "cancelled" && status !== "cancelled") {
        throw {
          status: 400,
          safe: true,
          message: "Cancelled requests cannot be updated again.",
        };
      }

      if (status === "cancelled") {
        await vr.update({ status: "cancelled" }, { transaction });
      } else {
        if (!SELLER_FOLLOW_UP_STATUSES.has(status)) {
          throw {
            status: 400,
            safe: true,
            message: "Unsupported viewing request status.",
          };
        }

        await vr.update(
          {
            follow_up_status: status,
            status: vr.status === "cancelled" ? "cancelled" : "pending",
          },
          { transaction }
        );
      }

      await transaction.commit();
      transaction = null;

      if (status !== "cancelled") {
        await this.dispatchNotificationJob({
          type: "viewingRequestUpdated",
          payload: { requestId: vr.request_id, status },
          jobId: `viewing-request-updated:${vr.request_id}:${status}`,
          fallback: async () =>
            processViewingRequestUpdatedNotification(this.ctx, {
              requestId: vr.request_id,
              status,
            }),
        });
      }

      return normalizeViewingRequest(vr);
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }
}

export function createViewingRequestService(ctx) {
  return new ViewingRequestService(ctx);
}

function normalizeViewingRequest(input) {
  const item = typeof input?.toJSON === "function" ? input.toJSON() : input;
  const lifecycleStatus = item?.status || "pending";
  const followUpStatus = item?.follow_up_status || null;

  return {
    ...item,
    lifecycle_status: lifecycleStatus,
    follow_up_status: followUpStatus,
    status: normalizeViewingRequestStatus({
      status: lifecycleStatus,
      follow_up_status: followUpStatus,
    }),
  };
}

function normalizeViewingRequestStatus(item) {
  if (item?.status === "cancelled") return "cancelled";

  if (SELLER_FOLLOW_UP_STATUSES.has(item?.follow_up_status)) {
    return item.follow_up_status;
  }

  if (item?.status === "accepted") return "scheduled";
  if (item?.status === "rejected") return "closed";

  return "new";
}

function isActiveViewingRequestStatus(status) {
  return !["cancelled", "closed", "completed"].includes(String(status || ""));
}
