import { createNotificationService } from "./notification.service.js";
import { createNotification } from "../notify.service.js";

async function loadViewingRequestBundle(ctx, requestId) {
  const {
    ViewingRequests,
    Listings,
    Users,
    CarVariants,
    CarModels,
    CarMakes,
  } = ctx.models;

  const viewingRequest = await ViewingRequests.findByPk(requestId);
  if (!viewingRequest) return null;

  const listing = await Listings.findByPk(viewingRequest.listing_id, {
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

  const buyer = await Users.findByPk(viewingRequest.buyer_id, {
    attributes: ["user_id", "name", "email", "phone"],
  });

  return {
    viewingRequest,
    listing,
    buyer,
  };
}

function buildListingTitle(listing) {
  if (!listing) return "this car";

  const make = listing.variant?.model?.make?.name;
  const model = listing.variant?.model?.name;
  const trim = listing.variant?.trim_name;
  const year = listing.variant?.model_year;
  return [year, make, model, trim].filter(Boolean).join(" ") || "this car";
}

function humanizeStatus(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function processViewingRequestCreatedNotification(ctx, { requestId }) {
  const bundle = await loadViewingRequestBundle(ctx, Number(requestId));
  if (!bundle?.viewingRequest || !bundle.listing) {
    return {
      ok: false,
      skipped: true,
      reason: "request_or_listing_not_found",
    };
  }

  const { viewingRequest, listing } = bundle;
  const notificationService = createNotificationService(ctx);
  const listingTitle = buildListingTitle(listing);

  await notificationService.createInAppNotification({
    userId: listing.owner_id,
    entityType: "viewing_request",
    entityId: viewingRequest.request_id,
    title: "New viewing request",
    message: `You received a new request for ${listingTitle}.`,
  });

  await notificationService.createInAppNotification({
    userId: viewingRequest.buyer_id,
    entityType: "viewing_request",
    entityId: viewingRequest.request_id,
    title: "Viewing request sent",
    message: `Your viewing request for ${listingTitle} was sent successfully.`,
  });

  let sellerNotified = false;
  let buyerNotified = false;
  let notificationProvider = null;

  try {
    const sellerEmailResult = await notificationService.sendSellerViewingRequestEmail({
      seller: listing.owner,
      listingTitle,
      listingId: listing.listing_id,
      buyerName: viewingRequest.contact_name,
      buyerEmail: viewingRequest.contact_email,
      buyerPhone: viewingRequest.contact_phone,
      preferredViewingTime: viewingRequest.preferred_viewing_time,
      message: viewingRequest.message,
    });

    if (sellerEmailResult.delivered) {
      await viewingRequest.update({ notified_at: new Date() });
      sellerNotified = true;
      notificationProvider = sellerEmailResult.provider || null;
    }
  } catch (error) {
    console.error("[notification-job] viewingRequestCreated seller email failed", {
      requestId: viewingRequest.request_id,
      message: error?.message || String(error),
    });
  }

  try {
    const buyerEmailResult = await notificationService.sendBuyerViewingRequestEmail({
      buyer: {
        name: bundle.buyer?.name ?? viewingRequest.contact_name,
        email: viewingRequest.contact_email ?? bundle.buyer?.email,
      },
      listingTitle,
      listingId: listing.listing_id,
      sellerName: listing.owner?.name,
      preferredViewingTime: viewingRequest.preferred_viewing_time,
      message: viewingRequest.message,
    });

    if (buyerEmailResult.delivered) {
      buyerNotified = true;
      notificationProvider = notificationProvider || buyerEmailResult.provider || null;
    }
  } catch (error) {
    console.error("[notification-job] viewingRequestCreated buyer email failed", {
      requestId: viewingRequest.request_id,
      message: error?.message || String(error),
    });
  }

  return {
    ok: true,
    sellerNotified,
    buyerNotified,
    notificationProvider,
  };
}

export async function processViewingRequestUpdatedNotification(ctx, { requestId, status }) {
  const bundle = await loadViewingRequestBundle(ctx, Number(requestId));
  if (!bundle?.viewingRequest || !bundle.listing) {
    return {
      ok: false,
      skipped: true,
      reason: "request_or_listing_not_found",
    };
  }

  await createNotificationService(ctx).createInAppNotification({
    userId: bundle.viewingRequest.buyer_id,
    entityType: "viewing_request",
    entityId: bundle.viewingRequest.request_id,
    title: "Request update",
    message: `Your request for ${buildListingTitle(bundle.listing)} is now marked as ${humanizeStatus(status)}.`,
  });

  return { ok: true };
}

export async function processPriceDropAlertNotification(
  ctx,
  { variantId, pricePointId, dropRatio, newPrice }
) {
  const { WatchedVariants, Notifications } = ctx.models;

  const watchers = await WatchedVariants.findAll({
    where: { variant_id: Number(variantId) },
  });

  for (const watcher of watchers) {
    await createNotification(
      { Notifications },
      watcher.user_id,
      "price_alert",
      pricePointId ?? null,
      "Price drop alert",
      `A watched variant dropped by ${(Number(dropRatio || 0) * 100).toFixed(1)}%. New price: ${newPrice}.`
    );
  }

  return {
    ok: true,
    watcherCount: watchers.length,
  };
}

export async function processNotificationJob(ctx, { type, payload }) {
  switch (type) {
    case "viewingRequestCreated":
      return processViewingRequestCreatedNotification(ctx, payload);
    case "viewingRequestUpdated":
      return processViewingRequestUpdatedNotification(ctx, payload);
    case "priceDropAlert":
      return processPriceDropAlertNotification(ctx, payload);
    default:
      console.warn("[notification-job] unsupported job type", { type });
      return {
        ok: false,
        skipped: true,
        reason: "unsupported_job_type",
      };
  }
}
