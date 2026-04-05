import { createNotificationService } from "../notifications/notification.service.js";
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
    this.notificationService = createNotificationService(ctx);
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
      contactPhone: contactPhone ?? requester?.phone ?? null,
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

    const viewingRequest = await ViewingRequests.create({
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
    });

    const listingTitle = buildListingTitle(listing);

    await this.notificationService.createInAppNotification({
      userId: listing.owner_id,
      entityType: "viewing_request",
      entityId: viewingRequest.request_id,
      title: "New viewing request",
      message: `You received a new request for ${listingTitle}.`,
    });

    let sellerNotified = false;
    let notificationProvider = null;

    try {
      const emailResult = await this.notificationService.sendSellerViewingRequestEmail({
        seller: listing.owner,
        listingTitle,
        listingId,
        buyerName: effectiveContact.contactName,
        buyerEmail: effectiveContact.contactEmail,
        buyerPhone: effectiveContact.contactPhone,
        preferredViewingTime: viewingRequest.preferred_viewing_time,
        message: viewingRequest.message,
      });

      if (emailResult.delivered) {
        await viewingRequest.update({ notified_at: new Date() });
        sellerNotified = true;
        notificationProvider = emailResult.provider || null;
      }
    } catch (error) {
      console.error("[viewing-request] seller email delivery failed", {
        listingId,
        requestId: viewingRequest.request_id,
        message: error?.message || String(error),
      });
    }

    return {
      viewingRequest: normalizeViewingRequest(viewingRequest),
      sellerNotified,
      notificationProvider,
    };
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
    const vr = await ViewingRequests.findByPk(requestId);
    if (!vr) {
      throw { status: 404, safe: true, message: "Request not found" };
    }

    const listing = await Listings.findByPk(vr.listing_id);
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
      await vr.update({ status: "cancelled" });
    } else {
      if (!SELLER_FOLLOW_UP_STATUSES.has(status)) {
        throw {
          status: 400,
          safe: true,
          message: "Unsupported viewing request status.",
        };
      }

      await vr.update({
        follow_up_status: status,
        status: vr.status === "cancelled" ? "cancelled" : "pending",
      });
    }

    if (status !== "cancelled") {
      const listing = await Listings.findByPk(vr.listing_id);
      await this.notificationService.createInAppNotification({
        userId: vr.buyer_id,
        entityType: "viewing_request",
        entityId: vr.request_id,
        title: "Request update",
        message: `Your request for ${buildListingTitle(listing)} is now marked as ${humanizeStatus(status)}.`,
      });
    }

    return normalizeViewingRequest(vr);
  }
}

export function createViewingRequestService(ctx) {
  return new ViewingRequestService(ctx);
}

function buildListingTitle(listing) {
  if (!listing) return "this car";
  const make = listing.variant?.model?.make?.name;
  const model = listing.variant?.model?.name;
  const trim = listing.variant?.trim_name;
  const year = listing.variant?.model_year;
  const parts = [year, make, model, trim].filter(Boolean);
  return parts.join(" ") || "this car";
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

function humanizeStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
