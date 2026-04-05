import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middlewares/auth.js";
import { listingImageUpload } from "../middlewares/listing-image-upload.js";
import { validate } from "../middlewares/validate.js";
import { buildListingPageIntelligence } from "../services/ai/page_intelligence.service.js";
import { parsePreferenceProfileQuery } from "../services/ai/user_preference_profile.service.js";
import { LISTING_IMAGE_LIMITS } from "../services/listing-images/image-validation.service.js";
import { createListingImageService } from "../services/listing-images/listing-image.service.js";

export const listingsRoutes = Router();

const BODY_TYPES = [
  "sedan",
  "hatchback",
  "suv",
  "cuv",
  "mpv",
  "pickup",
  "coupe",
  "convertible",
  "wagon",
  "van",
  "other",
];

const FUEL_TYPES = ["gasoline", "diesel", "hybrid", "phev", "ev", "other"];

const LISTING_STATUSES = ["active", "hidden", "reserved", "sold"];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeVehicleName(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseJsonField(value, message) {
  if (value == null) return undefined;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    throw {
      status: 400,
      safe: true,
      message,
    };
  }
}

function coerceNumber(value) {
  if (value == null || value === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function parseNumber(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

const OptionalTrimmedString = z.preprocess((value) => {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : undefined;
}, z.string().optional());

const OptionalInteger = z.preprocess((value) => coerceNumber(value), z.number().int().min(0).optional());
const RequiredPositiveNumber = z.preprocess((value) => coerceNumber(value), z.number().positive());
const OptionalPositiveInteger = z.preprocess((value) => coerceNumber(value), z.number().int().positive().optional());

const CustomVehicleSchema = z.object({
  make: z.preprocess((value) => normalizeText(value), z.string().min(1)),
  model: z.preprocess((value) => normalizeText(value), z.string().min(1)),
  year: z.preprocess((value) => coerceNumber(value), z.number().int().min(1900).max(2100)),
  trim_name: OptionalTrimmedString,
  body_type: z.preprocess(
    (value) => {
      const normalized = normalizeText(value).toLowerCase();
      return normalized || undefined;
    },
    z.enum(BODY_TYPES).optional()
  ),
  transmission: OptionalTrimmedString,
  fuel_type: z.preprocess(
    (value) => {
      const normalized = normalizeText(value).toLowerCase();
      return normalized || undefined;
    },
    z.enum(FUEL_TYPES).optional()
  ),
  drivetrain: OptionalTrimmedString,
  engine: OptionalTrimmedString,
  vin: OptionalTrimmedString,
});

const CreateListingBodySchema = z
  .object({
    variant_id: OptionalPositiveInteger,
    asking_price: RequiredPositiveNumber,
    mileage_km: OptionalInteger,
    location_city: z.preprocess((value) => normalizeText(value), z.string().min(1)),
    location_country_code: z.preprocess(
      (value) => normalizeText(value).toUpperCase(),
      z.string().length(2)
    ),
    description: OptionalTrimmedString,
    status: z.preprocess(
      (value) => {
        const normalized = normalizeText(value).toLowerCase();
        return normalized || undefined;
      },
      z.enum(LISTING_STATUSES).optional()
    ),
    image_urls: z.array(z.string()).max(LISTING_IMAGE_LIMITS.maxCount).optional(),
    custom_vehicle: CustomVehicleSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.variant_id && !body.custom_vehicle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a catalog vehicle or provide custom vehicle details.",
        path: ["variant_id"],
      });
    }
  });

const ListingIdParamsSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: z.preprocess((value) => Number(value), z.number().int().positive()),
  }),
});

const ListingImageParamsSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: z.preprocess((value) => Number(value), z.number().int().positive()),
    imageId: z.preprocess((value) => Number(value), z.number().int().positive()),
  }),
});

const ReorderListingImagesSchema = z.object({
  body: z.object({
    image_ids: z
      .array(z.preprocess((value) => Number(value), z.number().int().positive()))
      .min(1),
  }),
  query: z.any(),
  params: z.object({
    id: z.preprocess((value) => Number(value), z.number().int().positive()),
  }),
});

function normalizeCreateListingPayload(body) {
  return {
    ...body,
    custom_vehicle: parseJsonField(body.custom_vehicle, "Custom vehicle details are malformed."),
    image_urls: parseJsonField(body.image_urls, "Listing image references are malformed."),
  };
}

function buildListingTitle(variant) {
  if (!variant) return null;

  const make = variant.model?.make?.name;
  const model = variant.model?.name;
  const trim = variant.trim_name;

  return [make, model, trim].filter(Boolean).join(" ").trim() || null;
}

async function loadOwnedListing(ctx, listingId, userId) {
  const listing = await ctx.models.Listings.findByPk(listingId);
  if (!listing) {
    throw { status: 404, safe: true, message: "Listing not found." };
  }

  if (listing.owner_id !== userId) {
    throw {
      status: 403,
      safe: true,
      message: "You can only manage images for your own listings.",
    };
  }

  return listing;
}

async function resolveVariantForListing(models, payload) {
  if (payload.variant_id) {
    return {
      variantId: payload.variant_id,
      customVehicleCreated: false,
    };
  }

  const custom = payload.custom_vehicle;
  if (!custom) {
    return {
      variantId: null,
      customVehicleCreated: false,
    };
  }

  const { CarMakes, CarModels, CarVariants } = models;
  const makeName = normalizeVehicleName(custom.make);
  const modelName = normalizeVehicleName(custom.model);
  const trimName = normalizeText(custom.trim_name) || "Custom listing";

  const [make] = await CarMakes.findOrCreate({
    where: { name: makeName },
    defaults: {
      name: makeName,
      country_of_origin: null,
      is_placeholder: true,
    },
  });

  const [model] = await CarModels.findOrCreate({
    where: {
      make_id: make.make_id,
      name: modelName,
    },
    defaults: {
      make_id: make.make_id,
      name: modelName,
      segment: null,
      is_placeholder: true,
    },
  });

  const [variant, created] = await CarVariants.findOrCreate({
    where: {
      model_id: model.model_id,
      model_year: custom.year,
      trim_name: trimName,
    },
    defaults: {
      model_id: model.model_id,
      model_year: custom.year,
      trim_name: trimName,
      body_type: custom.body_type ?? "other",
      engine: normalizeText(custom.engine) || null,
      transmission: normalizeText(custom.transmission) || null,
      drivetrain: normalizeText(custom.drivetrain) || null,
      fuel_type: custom.fuel_type ?? "other",
      is_placeholder: true,
    },
  });

  if (!created) {
    const updates = {};
    if ((!variant.body_type || variant.body_type === "other") && custom.body_type) {
      updates.body_type = custom.body_type;
    }
    if ((!variant.fuel_type || variant.fuel_type === "other") && custom.fuel_type) {
      updates.fuel_type = custom.fuel_type;
    }
    if (!variant.transmission && custom.transmission) {
      updates.transmission = normalizeText(custom.transmission);
    }
    if (!variant.drivetrain && custom.drivetrain) {
      updates.drivetrain = normalizeText(custom.drivetrain);
    }
    if (!variant.engine && custom.engine) updates.engine = normalizeText(custom.engine);
    if (Object.keys(updates).length > 0) {
      await variant.update(updates);
    }
  }

  return {
    variantId: variant.variant_id,
    customVehicleCreated: created,
  };
}

listingsRoutes.get("/listings", async (req, res, next) => {
  try {
    const {
      Listings,
      ListingImages,
      VariantImages,
      CarVariants,
      CarModels,
      CarMakes,
    } = req.ctx.models;
    const { status = "active", ownerId, variantId } = req.query;

    const where = { status };
    if (ownerId) where.owner_id = Number(ownerId);
    if (variantId) where.variant_id = Number(variantId);

    const rows = await Listings.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit: 50,
      include: [
        {
          model: CarVariants,
          as: "variant",
          attributes: [
            "variant_id",
            "model_year",
            "trim_name",
            "body_type",
            "fuel_type",
            "transmission",
            "engine",
          ],
          include: [
            {
              model: CarModels,
              as: "model",
              attributes: ["model_id", "name"],
              include: [
                {
                  model: CarMakes,
                  as: "make",
                  attributes: ["make_id", "name"],
                },
              ],
            },
          ],
        },
      ],
    });

    const listingIds = rows.map((row) => row.listing_id);
    const variantIds = rows.map((row) => row.variant_id);

    const [listingImageRows, variantImageRows] = await Promise.all([
      listingIds.length > 0
        ? ListingImages.findAll({
            where: { listing_id: { [Op.in]: listingIds } },
            order: [
              ["listing_id", "ASC"],
              ["sort_order", "ASC"],
            ],
          })
        : Promise.resolve([]),
      variantIds.length > 0
        ? VariantImages.findAll({
            where: { variant_id: { [Op.in]: variantIds } },
            order: [
              ["variant_id", "ASC"],
              ["sort_order", "ASC"],
            ],
          })
        : Promise.resolve([]),
    ]);

    const listingImageService = createListingImageService(req.ctx);
    const listingImageMap = new Map();
    for (const image of listingImageService.normalizeRecords(listingImageRows)) {
      const existing = listingImageMap.get(image.listing_id) || [];
      existing.push(image.url);
      listingImageMap.set(image.listing_id, existing);
    }

    const variantImageMap = new Map();
    for (const image of variantImageRows) {
      const existing = variantImageMap.get(image.variant_id) || [];
      existing.push(image.url);
      variantImageMap.set(image.variant_id, existing);
    }

    const items = rows.map((row) => {
      const plain = row.get({ plain: true });
      const listingPhotos = listingImageMap.get(row.listing_id) || [];
      const catalogPhotos = variantImageMap.get(row.variant_id) || [];
      const images = listingPhotos.length > 0 ? listingPhotos : catalogPhotos;
      const photoSource =
        listingPhotos.length > 0 ? "listing" : images.length > 0 ? "catalog" : "none";

      return {
        listing_id: plain.listing_id,
        owner_id: plain.owner_id,
        variant_id: plain.variant_id,
        asking_price: plain.asking_price,
        mileage_km: plain.mileage_km,
        location_city: plain.location_city,
        location_country_code: plain.location_country_code,
        description: plain.description,
        status: plain.status,
        created_at: plain.created_at,
        title: buildListingTitle(plain.variant),
        model_year: plain.variant?.model_year ?? null,
        trim_name: plain.variant?.trim_name ?? null,
        body_type: plain.variant?.body_type ?? null,
        fuel_type: plain.variant?.fuel_type ?? null,
        transmission: plain.variant?.transmission ?? null,
        engine: plain.variant?.engine ?? null,
        make_name: plain.variant?.model?.make?.name ?? null,
        model_name: plain.variant?.model?.name ?? null,
        seller_type: "Private seller",
        photo_source: photoSource,
        image_count: images.length,
        cover_image: images[0] ?? null,
        thumbnail: images[0] ?? null,
        images,
      };
    });

    res.json({ items });
  } catch (e) { next(e); }
});

listingsRoutes.get("/listings/:id", async (req, res, next) => {
  try {
    const { Listings, Users, CarVariants, CarModels, CarMakes, VariantImages } = req.ctx.models;
    const listingImageService = createListingImageService(req.ctx);
    const id = Number(req.params.id);

    const listing = await Listings.findByPk(id, {
      include: [
        {
          model: CarVariants,
          as: "variant",
          attributes: [
            "variant_id",
            "model_year",
            "trim_name",
            "body_type",
            "fuel_type",
            "transmission",
            "engine",
          ],
          include: [
            {
              model: CarModels,
              as: "model",
              attributes: ["model_id", "name"],
              include: [
                {
                  model: CarMakes,
                  as: "make",
                  attributes: ["make_id", "name"],
                },
              ],
            },
          ],
        },
      ],
    });
    if (!listing) return next({ status: 404, message: "Listing not found" });

    const plain = listing.get({ plain: true });
    const listingImages = await listingImageService.listImages(id);
    const variantImages =
      listingImages.length === 0 && listing.variant_id
        ? await VariantImages.findAll({
            where: { variant_id: listing.variant_id },
            order: [["sort_order", "ASC"]],
          })
        : [];

    const normalizedImages =
      listingImages.length > 0
        ? listingImages
        : variantImages.map((image) => ({
            listing_id: listing.listing_id,
            listing_image_id: null,
            url: image.url,
            provider: image.provider || "placeholder",
            sortOrder: image.sort_order ?? null,
            storage: "catalog_variant",
            createdAt: image.created_at ?? null,
          }));

    const seller = await Users.findByPk(listing.owner_id, {
      attributes: ["user_id", "name", "email", "phone", "preferred_contact_method"],
    });

    const firstImage = normalizedImages[0]?.url ?? null;

    res.json({
      listing: {
        ...plain,
        title: buildListingTitle(plain.variant),
        model_year: plain.variant?.model_year ?? null,
        trim_name: plain.variant?.trim_name ?? null,
        body_type: plain.variant?.body_type ?? null,
        fuel_type: plain.variant?.fuel_type ?? null,
        transmission: plain.variant?.transmission ?? null,
        engine: plain.variant?.engine ?? null,
        make_name: plain.variant?.model?.make?.name ?? null,
        model_name: plain.variant?.model?.name ?? null,
        seller_type: plain.seller_type ?? null,
        photo_source:
          listingImages.length > 0
            ? "listing"
            : normalizedImages.length > 0
              ? "catalog"
              : "none",
        image_count: normalizedImages.length,
        cover_image: firstImage,
        thumbnail: firstImage,
      },
      images: normalizedImages,
      seller: seller ? seller.get({ plain: true }) : null,
    });
  } catch (e) { next(e); }
});

listingsRoutes.get("/listings/:id/images", validate(ListingIdParamsSchema), async (req, res, next) => {
  try {
    const listingImageService = createListingImageService(req.ctx);
    const items = await listingImageService.listImages(req.validated.params.id);
    res.json({ items });
  } catch (e) { next(e); }
});

listingsRoutes.get("/listings/:id/images/:imageId", async (req, res, next) => {
  try {
    const listingId = Number(req.params.id);
    const imageId = Number(req.params.imageId);

    if (!Number.isFinite(listingId) || !Number.isFinite(imageId)) {
      return next({ status: 400, safe: true, message: "Invalid listing image request." });
    }

    const listingImageService = createListingImageService(req.ctx);
    const imageContent = await listingImageService.resolveImageContent(listingId, imageId);

    if (!imageContent) {
      return next({ status: 404, safe: true, message: "Listing image not found." });
    }

    if (imageContent.kind === "redirect") {
      return res.redirect(imageContent.url);
    }

    res.set("Cache-Control", "public, max-age=86400");
    res.type(imageContent.mimeType);
    return res.send(imageContent.buffer);
  } catch (e) { next(e); }
});

listingsRoutes.post(
  "/listings/:id/images",
  requireAuth,
  listingImageUpload,
  validate(ListingIdParamsSchema),
  async (req, res, next) => {
    try {
      const listingId = req.validated.params.id;
      await loadOwnedListing(req.ctx, listingId, req.user.userId);

      const uploadedFiles = Array.isArray(req.files) ? req.files : [];
      if (uploadedFiles.length === 0) {
        return next({
          status: 400,
          safe: true,
          message: "Select at least one image to upload for this listing.",
        });
      }

      const listingImageService = createListingImageService(req.ctx);
      const items = await listingImageService.persistUploadedImages(listingId, uploadedFiles);

      res.status(201).json({
        listing_id: listingId,
        image_count: items.length,
        items,
      });
    } catch (e) { next(e); }
  }
);

listingsRoutes.delete(
  "/listings/:id/images/:imageId",
  requireAuth,
  validate(ListingImageParamsSchema),
  async (req, res, next) => {
    try {
      const { id, imageId } = req.validated.params;
      await loadOwnedListing(req.ctx, id, req.user.userId);

      const listingImageService = createListingImageService(req.ctx);
      const removed = await listingImageService.deleteImage(id, imageId);

      if (!removed) {
        return next({ status: 404, safe: true, message: "Listing image not found." });
      }

      res.json({ ok: true, removed });
    } catch (e) { next(e); }
  }
);

listingsRoutes.patch(
  "/listings/:id/images/reorder",
  requireAuth,
  validate(ReorderListingImagesSchema),
  async (req, res, next) => {
    try {
      const listingId = req.validated.params.id;
      await loadOwnedListing(req.ctx, listingId, req.user.userId);

      const listingImageService = createListingImageService(req.ctx);
      const items = await listingImageService.reorderImages(
        listingId,
        req.validated.body.image_ids
      );

      res.json({ listing_id: listingId, items });
    } catch (e) { next(e); }
  }
);

listingsRoutes.get("/listings/:id/ai-insights", async (req, res, next) => {
  try {
    const listingId = Number(req.params.id);
    if (!Number.isFinite(listingId)) {
      return next({ status: 400, safe: true, message: "Invalid listing id." });
    }

    const marketId = parseNumber(req.query.marketId, 1);
    const ownershipYears = parseNumber(req.query.ownershipYears, 5);
    const kmPerYear = parseNumber(req.query.kmPerYear, null);
    const profile = parsePreferenceProfileQuery(req.query);

    const intelligence = await buildListingPageIntelligence(req.ctx, {
      listingId,
      marketId,
      ownershipYears,
      kmPerYear,
      profile,
    });

    res.json(intelligence);
  } catch (e) { next(e); }
});

listingsRoutes.post("/listings", requireAuth, listingImageUpload, async (req, res, next) => {
  let created = null;

  try {
    const { Listings } = req.ctx.models;
    const listingImageService = createListingImageService(req.ctx);
    const normalizedPayload = normalizeCreateListingPayload(req.body);
    const b = CreateListingBodySchema.parse(normalizedPayload);
    const { variantId, customVehicleCreated } = await resolveVariantForListing(req.ctx.models, b);

    if (!variantId) {
      return next({ status: 400, message: "A valid vehicle selection is required." });
    }

    created = await Listings.create({
      owner_id: req.user.userId,
      variant_id: variantId,
      asking_price: b.asking_price,
      mileage_km: b.mileage_km ?? null,
      location_city: b.location_city ?? null,
      location_country_code: b.location_country_code ?? "VN",
      status: b.status ?? "active",
      description: b.description ?? null,
    });

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    let storedImages = [];
    if (uploadedFiles.length > 0) {
      storedImages = await listingImageService.persistUploadedImages(created.listing_id, uploadedFiles);
    } else if (Array.isArray(b.image_urls) && b.image_urls.length > 0) {
      storedImages = await listingImageService.persistImageReferences(created.listing_id, b.image_urls);
    }

    const detailPath = `/listings/${created.listing_id}`;

    res.status(201).json({
      listing_id: created.listing_id,
      variant_id: variantId,
      custom_vehicle_created: customVehicleCreated,
      image_count: storedImages.length,
      detail_path: detailPath,
      detail_url: `${env.frontendUrl}${detailPath}`,
    });
  } catch (e) {
    if (created?.listing_id) {
      try {
        await created.destroy();
      } catch (cleanupError) {
        console.warn("[listings:create] Failed to roll back listing after image upload error", {
          listingId: created.listing_id,
          message: cleanupError?.message,
        });
      }
    }

    if (e instanceof z.ZodError) {
      return next({
        status: 400,
        safe: true,
        message: e.issues[0]?.message || "Listing details are incomplete.",
        details: e.issues,
      });
    }

    next(e);
  }
});

const UpdateListingSchema = z.object({
  body: z.object({
    asking_price: z.number().optional(),
    mileage_km: z.number().int().optional(),
    location_city: z.string().optional(),
    location_country_code: z.string().length(2).optional(),
    description: z.string().optional(),
    status: z.enum(["active","reserved","sold","hidden"]).optional(),
  }),
  query: z.any(),
  params: z.any(),
});

listingsRoutes.put("/listings/:id", requireAuth, validate(UpdateListingSchema), async (req, res, next) => {
  try {
    const { Listings, ListingPriceHistory } = req.ctx.models;
    const id = Number(req.params.id);

    const listing = await Listings.findByPk(id);
    if (!listing) return next({ status: 404, message: "Listing not found" });
    if (listing.owner_id !== req.user.userId) return next({ status: 403, message: "Forbidden" });

    const b = req.validated.body;

    // record price history if price changes
    if (b.asking_price != null && Number(b.asking_price) !== Number(listing.asking_price)) {
      await ListingPriceHistory.create({ listing_id: id, price: b.asking_price, note: "user_update" });
    }

    await listing.update(b);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
