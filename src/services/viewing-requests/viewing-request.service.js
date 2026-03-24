import { createNotificationService } from "../notifications/notification.service.js";
import { ensureViewingRequestSchema } from "./viewing-request-schema.service.js";

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
      attributes: ["user_id", "name", "email", "phone"],
    });

    const viewingRequest = await ViewingRequests.create({
      listing_id: listingId,
      buyer_id: requesterUserId,
      seller_user_id: listing.owner_id,
      contact_name: contactName ?? requester?.name ?? null,
      contact_email: contactEmail ?? requester?.email ?? null,
      contact_phone: contactPhone ?? requester?.phone ?? null,
      preferred_viewing_time: preferredViewingTime ?? null,
      message: message ?? null,
      status: "pending",
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
        buyerName: viewingRequest.contact_name,
        buyerEmail: viewingRequest.contact_email,
        buyerPhone: viewingRequest.contact_phone,
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
      viewingRequest,
      sellerNotified,
      notificationProvider,
    };
  }

  async listOutbox(userId) {
    await ensureViewingRequestSchema(this.ctx);
    return this.ctx.models.ViewingRequests.findAll({
      where: { buyer_id: userId },
      order: [["created_at", "DESC"]],
      limit: 50,
    });
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
    return items;
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

    if ((status === "accepted" || status === "rejected") && !isSeller) {
      throw {
        status: 403,
        safe: true,
        message: "Only the seller can update this request status.",
      };
    }

    await vr.update({ status });

    if (status === "accepted" || status === "rejected") {
      await this.notificationService.createInAppNotification({
        userId: vr.buyer_id,
        entityType: "viewing_request",
        entityId: vr.request_id,
        title: "Request update",
        message: `Your request for listing #${vr.listing_id} was ${status}.`,
      });
    }

    return vr;
  }
}

export function createViewingRequestService(ctx) {
  return new ViewingRequestService(ctx);
}

function buildListingTitle(listing) {
  const make = listing.variant?.model?.make?.name;
  const model = listing.variant?.model?.name;
  const trim = listing.variant?.trim_name;
  const year = listing.variant?.model_year;
  const parts = [year, make, model, trim].filter(Boolean);
  return parts.join(" ") || `Listing #${listing.listing_id}`;
}
