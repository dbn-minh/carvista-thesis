import { ImageStorageService } from "./image-storage.service.js";

const DB_INLINE_STORAGE = "db_inline";
const STORAGE_VERSION = 1;

let ensureListingImagesColumnCapacityPromise = null;

export class DbImageStorageService extends ImageStorageService {
  constructor({ ListingImages, sequelize, logger = console }) {
    super();
    this.ListingImages = ListingImages;
    this.sequelize = sequelize;
    this.logger = logger;
  }

  async storeListingImages({ listingId, files = [], imageUrls = [] }) {
    if (!listingId) {
      throw new Error("listingId is required to store listing images.");
    }

    if ((!Array.isArray(files) || files.length === 0) && (!Array.isArray(imageUrls) || imageUrls.length === 0)) {
      return [];
    }

    await this.ensureColumnCapacity();

    const rows = [
      ...files.map((file, index) => ({
        listing_id: listingId,
        url: serializeDbInlineImage(file),
        sort_order: index,
      })),
      ...imageUrls.map((imageUrl, index) => ({
        listing_id: listingId,
        url: imageUrl,
        sort_order: files.length + index,
      })),
    ];

    await this.ListingImages.bulkCreate(rows);
    return rows;
  }

  normalizeListingImageRecord(record) {
    const plain = typeof record?.get === "function" ? record.get({ plain: true }) : record;
    const storedValue = typeof plain?.url === "string" ? plain.url : null;
    if (!storedValue || !storedValue.trim()) return null;

    const normalized = parseStoredImageValue(storedValue);
    const listingId = plain?.listing_id ?? null;
    const imageId = plain?.listing_image_id ?? null;
    const publicUrl =
      normalized?.isInline && listingId && imageId
        ? buildListingImageUrl(listingId, imageId)
        : normalized?.url;
    if (!publicUrl) return null;

    return {
      listing_id: listingId,
      listing_image_id: imageId,
      url: publicUrl,
      mimeType: normalized.mimeType,
      size: normalized.size,
      fileName: normalized.fileName,
      sortOrder: Number(plain?.sort_order ?? normalized.sortOrder ?? 0),
      storage: normalized.storage,
      createdAt: normalized.createdAt,
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

    if (typeof normalized?.url === "string" && /^https?:\/\//.test(normalized.url)) {
      return {
        kind: "redirect",
        url: normalized.url,
      };
    }

    return null;
  }

  async ensureColumnCapacity() {
    if (!this.sequelize) return;

    if (!ensureListingImagesColumnCapacityPromise) {
      ensureListingImagesColumnCapacityPromise = ensureListingImagesColumnCapacity(
        this.sequelize,
        this.logger
      );
    }

    await ensureListingImagesColumnCapacityPromise;
  }
}

async function ensureListingImagesColumnCapacity(sequelize, logger) {
  try {
    const [rows] = await sequelize.query(`
      SELECT DATA_TYPE AS dataType
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'listing_images'
        AND COLUMN_NAME = 'url'
      LIMIT 1
    `);

    const dataType = String(rows?.[0]?.dataType || "").toLowerCase();
    if (dataType && dataType !== "longtext") {
      await sequelize.query("ALTER TABLE listing_images MODIFY COLUMN url LONGTEXT NOT NULL");
    }
  } catch (error) {
    logger.warn?.("[listing-images] Could not ensure LONGTEXT storage for listing_images.url", {
      message: error?.message,
    });
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
          url: null,
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
      // Fall through to legacy handling.
    }
  }

  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    return {
      url: null,
      mimeType: dataUrlMatch[1] || null,
      size: null,
      fileName: null,
      storage: DB_INLINE_STORAGE,
      createdAt: null,
      base64: dataUrlMatch[2],
      isInline: true,
    };
  }

  return {
    url: trimmed,
    mimeType: inferMimeType(trimmed),
    size: null,
    fileName: null,
    storage: trimmed.startsWith("data:") ? DB_INLINE_STORAGE : "external_url",
    createdAt: null,
    base64: null,
    isInline: false,
  };
}

function inferMimeType(value) {
  const match = value.match(/^data:([^;]+);base64,/i);
  if (match?.[1]) return match[1];
  if (/\.png(\?|$)/i.test(value)) return "image/png";
  if (/\.webp(\?|$)/i.test(value)) return "image/webp";
  if (/\.jpe?g(\?|$)/i.test(value)) return "image/jpeg";
  return null;
}

export function buildListingImageUrl(listingId, imageId) {
  return `/api/listings/${listingId}/images/${imageId}`;
}
