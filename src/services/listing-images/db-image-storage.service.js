import { ImageStorageService } from "./image-storage.service.js";
import { ensureColumn, runSchemaGuard } from "../shared/schema-guard.service.js";

const DB_INLINE_STORAGE = "db_inline";
const EXTERNAL_URL_STORAGE = "external_url";
const CLOUDINARY_STORAGE = "cloudinary";
const STORAGE_VERSION = 2;

export class DbImageStorageService extends ImageStorageService {
  constructor({
    ListingImages,
    sequelize,
    logger = console,
    mediaProvider = null,
    allowInlineUploadFallback = false,
  }) {
    super();
    this.ListingImages = ListingImages;
    this.sequelize = sequelize;
    this.logger = logger;
    this.mediaProvider = mediaProvider;
    this.allowInlineUploadFallback = allowInlineUploadFallback;
  }

  async storeListingImages({ listingId, files = [], imageUrls = [] }) {
    if (!listingId) {
      throw new Error("listingId is required to store listing images.");
    }

    if ((!Array.isArray(files) || files.length === 0) && (!Array.isArray(imageUrls) || imageUrls.length === 0)) {
      return [];
    }

    await this.ensureSchemaReady();
    const startOrder = await this.getNextSortOrder(listingId);
    const rows = [];
    const uploadedAssets = [];

    try {
      if (Array.isArray(files) && files.length > 0) {
        if (this.mediaProvider?.isConfigured?.()) {
          for (let index = 0; index < files.length; index += 1) {
            const image = await this.mediaProvider.uploadListingImage({
              listingId,
              file: files[index],
              sortOrder: startOrder + index,
            });

            uploadedAssets.push(image);
            rows.push({
              listing_id: listingId,
              url: image.secureUrl,
              provider: image.provider,
              public_id: image.publicId,
              asset_id: image.assetId,
              width: image.width,
              height: image.height,
              format: image.format,
              bytes: image.bytes,
              sort_order: startOrder + index,
            });
          }
        } else if (this.allowInlineUploadFallback) {
          rows.push(
            ...files.map((file, index) => ({
              listing_id: listingId,
              url: serializeDbInlineImage(file),
              provider: DB_INLINE_STORAGE,
              public_id: null,
              asset_id: null,
              width: null,
              height: null,
              format: null,
              bytes: Number(file?.size || 0) || null,
              sort_order: startOrder + index,
            }))
          );
        } else {
          throw {
            status: 503,
            safe: true,
            message:
              "Image uploads are not configured yet. Add Cloudinary credentials before uploading listing photos.",
          };
        }
      }

      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        rows.push(
          ...imageUrls.map((imageUrl, index) => ({
            listing_id: listingId,
            url: imageUrl,
            provider: EXTERNAL_URL_STORAGE,
            public_id: null,
            asset_id: null,
            width: null,
            height: null,
            format: inferFormatFromUrl(imageUrl),
            bytes: null,
            sort_order: startOrder + files.length + index,
          }))
        );
      }

      const created = await this.ListingImages.bulkCreate(rows);
      return this.normalizeListingImageRecords(created);
    } catch (error) {
      await cleanupUploadedAssets(this.mediaProvider, uploadedAssets, this.logger);
      throw error;
    }
  }

  async listListingImages({ listingId }) {
    const rows = await this.ListingImages.findAll({
      where: { listing_id: listingId },
      order: [["sort_order", "ASC"]],
    });
    return this.normalizeListingImageRecords(rows);
  }

  normalizeListingImageRecord(record) {
    const plain = typeof record?.get === "function" ? record.get({ plain: true }) : record;
    const storedValue = typeof plain?.url === "string" ? plain.url : null;
    if (!storedValue || !storedValue.trim()) return null;

    const listingId = plain?.listing_id ?? null;
    const imageId = plain?.listing_image_id ?? null;
    const normalizedLegacy = parseStoredImageValue(storedValue);

    if (normalizedLegacy?.isInline) {
      const publicUrl =
        listingId && imageId ? buildListingImageUrl(listingId, imageId) : null;

      return publicUrl
        ? {
            listing_id: listingId,
            listing_image_id: imageId,
            url: publicUrl,
            mimeType: normalizedLegacy.mimeType,
            size: normalizedLegacy.size,
            fileName: normalizedLegacy.fileName,
            sortOrder: Number(plain?.sort_order ?? 0),
            storage: normalizedLegacy.storage,
            provider: normalizedLegacy.storage,
            publicId: null,
            assetId: null,
            width: null,
            height: null,
            format: null,
            bytes: normalizedLegacy.size,
            createdAt: normalizedLegacy.createdAt,
          }
        : null;
    }

    return {
      listing_id: listingId,
      listing_image_id: imageId,
      url: storedValue.trim(),
      mimeType: inferMimeType(storedValue, plain?.format),
      size: toNullableNumber(plain?.bytes),
      fileName: null,
      sortOrder: Number(plain?.sort_order ?? 0),
      storage: plain?.provider || EXTERNAL_URL_STORAGE,
      provider: plain?.provider || EXTERNAL_URL_STORAGE,
      publicId: plain?.public_id ?? null,
      assetId: plain?.asset_id ?? null,
      width: toNullableNumber(plain?.width),
      height: toNullableNumber(plain?.height),
      format: plain?.format ?? inferFormatFromUrl(storedValue),
      bytes: toNullableNumber(plain?.bytes),
      createdAt: null,
    };
  }

  async resolveListingImageContent({ listingId, imageId }) {
    const row = await this.ListingImages.findOne({
      where: {
        listing_id: listingId,
        listing_image_id: imageId,
      },
    });

    if (!row) return null;

    const plain = row.get({ plain: true });
    const storedValue = typeof plain?.url === "string" ? plain.url : null;
    if (!storedValue) return null;

    const normalized = parseStoredImageValue(storedValue);
    if (normalized?.isInline && normalized?.base64) {
      return {
        kind: "buffer",
        mimeType: normalized.mimeType || "application/octet-stream",
        buffer: Buffer.from(normalized.base64, "base64"),
        fileName: normalized.fileName || `listing-image-${imageId}`,
      };
    }

    return {
      kind: "redirect",
      url: storedValue.trim(),
    };
  }

  async deleteListingImage({ listingId, imageId }) {
    const row = await this.ListingImages.findOne({
      where: {
        listing_id: listingId,
        listing_image_id: imageId,
      },
    });

    if (!row) {
      return null;
    }

    const plain = row.get({ plain: true });
    if (plain?.provider === CLOUDINARY_STORAGE && plain?.public_id) {
      await this.mediaProvider?.deleteAsset?.(plain.public_id);
    }

    await row.destroy();
    return this.normalizeListingImageRecord(plain);
  }

  async reorderListingImages({ listingId, imageIds = [] }) {
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      throw {
        status: 400,
        safe: true,
        message: "Provide the listing image ids in the order you want them saved.",
      };
    }

    const uniqueIds = Array.from(new Set(imageIds.map((value) => Number(value)).filter(Number.isFinite)));
    if (uniqueIds.length !== imageIds.length) {
      throw {
        status: 400,
        safe: true,
        message: "Each listing image may only appear once in the reorder payload.",
      };
    }

    const rows = await this.ListingImages.findAll({
      where: {
        listing_id: listingId,
      },
      order: [["sort_order", "ASC"]],
    });

    if (rows.length !== uniqueIds.length) {
      throw {
        status: 400,
        safe: true,
        message: "The reorder payload must include every image for this listing.",
      };
    }

    const rowMap = new Map(rows.map((row) => [Number(row.listing_image_id), row]));
    for (const imageId of uniqueIds) {
      if (!rowMap.has(imageId)) {
        throw {
          status: 400,
          safe: true,
          message: "The reorder payload contains an image that does not belong to this listing.",
        };
      }
    }

    await this.sequelize.transaction(async (transaction) => {
      await Promise.all(
        uniqueIds.map((imageId, index) =>
          rowMap.get(imageId).update({ sort_order: index }, { transaction })
        )
      );
    });

    return this.listListingImages({ listingId });
  }

  async ensureSchemaReady() {
    if (!this.sequelize) return;

    await runSchemaGuard("listing-images-cloud-metadata", async () => {
      try {
        const [rows] = await this.sequelize.query(`
          SELECT DATA_TYPE AS dataType
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'listing_images'
            AND COLUMN_NAME = 'url'
          LIMIT 1
        `);

        const dataType = String(rows?.[0]?.dataType || "").toLowerCase();
        if (dataType && dataType !== "longtext") {
          await this.sequelize.query("ALTER TABLE listing_images MODIFY COLUMN url LONGTEXT NOT NULL");
        }

        await ensureColumn(this.sequelize, "listing_images", "provider", "VARCHAR(32) NULL");
        await ensureColumn(this.sequelize, "listing_images", "public_id", "VARCHAR(255) NULL");
        await ensureColumn(this.sequelize, "listing_images", "asset_id", "VARCHAR(255) NULL");
        await ensureColumn(this.sequelize, "listing_images", "width", "INT NULL");
        await ensureColumn(this.sequelize, "listing_images", "height", "INT NULL");
        await ensureColumn(this.sequelize, "listing_images", "format", "VARCHAR(32) NULL");
        await ensureColumn(this.sequelize, "listing_images", "bytes", "BIGINT NULL");
      } catch (error) {
        this.logger.warn?.("[listing-images] Could not ensure cloud metadata columns", {
          message: error?.message,
        });
      }
    });
  }

  async getNextSortOrder(listingId) {
    const row = await this.ListingImages.findOne({
      where: { listing_id: listingId },
      order: [["sort_order", "DESC"]],
    });

    if (!row) return 0;
    return Number(row.sort_order ?? 0) + 1;
  }
}

function serializeDbInlineImage(file) {
  const mimeType = file?.mimetype || file?.type || "application/octet-stream";
  const fileName = file?.originalname || file?.name || `listing-image-${Date.now()}`;
  const buffer = Buffer.isBuffer(file?.buffer) ? file.buffer : Buffer.from([]);

  return JSON.stringify({
    version: STORAGE_VERSION,
    storage: DB_INLINE_STORAGE,
    mimeType,
    fileName,
    size: Number(file?.size || buffer.length || 0),
    base64: buffer.toString("base64"),
    createdAt: new Date().toISOString(),
  });
}

function parseStoredImageValue(value) {
  const trimmed = value.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.storage === DB_INLINE_STORAGE && parsed?.base64) {
        return {
          mimeType: parsed.mimeType || null,
          size: Number(parsed.size || 0) || null,
          fileName: parsed.fileName || null,
          storage: parsed.storage,
          createdAt: parsed.createdAt || null,
          base64: parsed.base64,
          isInline: true,
        };
      }
    } catch {
      return null;
    }
  }

  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || null,
      size: null,
      fileName: null,
      storage: DB_INLINE_STORAGE,
      createdAt: null,
      base64: dataUrlMatch[2],
      isInline: true,
    };
  }

  return null;
}

function inferMimeType(value, format) {
  if (format) return `image/${String(format).toLowerCase()}`;
  if (/\.png(\?|$)/i.test(value)) return "image/png";
  if (/\.webp(\?|$)/i.test(value)) return "image/webp";
  if (/\.jpe?g(\?|$)/i.test(value)) return "image/jpeg";
  return null;
}

function inferFormatFromUrl(value) {
  const match = String(value || "").match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match?.[1]?.toLowerCase() || null;
}

function toNullableNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function buildListingImageUrl(listingId, imageId) {
  return `/api/listings/${listingId}/images/${imageId}`;
}

async function cleanupUploadedAssets(mediaProvider, uploadedAssets = [], logger = console) {
  const publicIds = uploadedAssets
    .map((asset) => asset?.publicId)
    .filter((value) => typeof value === "string" && value.trim().length > 0);

  if (!mediaProvider?.deleteAsset || publicIds.length === 0) {
    return;
  }

  const results = await Promise.allSettled(publicIds.map((publicId) => mediaProvider.deleteAsset(publicId)));
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    logger.warn?.("[listing-images] Failed to clean up one or more uploaded assets", {
      attempted: publicIds.length,
      failed: failures.length,
    });
  }
}
