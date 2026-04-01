import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";

export class CloudinaryService {
  constructor({
    cloudName,
    apiKey,
    apiSecret,
    folder = "carvista",
    enabled = true,
  }) {
    this.cloudName = cloudName || "";
    this.apiKey = apiKey || "";
    this.apiSecret = apiSecret || "";
    this.folder = folder || "carvista";
    this.enabled = Boolean(enabled);

    if (this.isConfigured()) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
    }
  }

  isConfigured() {
    return Boolean(this.enabled && this.cloudName && this.apiKey && this.apiSecret);
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw {
        status: 503,
        safe: true,
        message:
          "Image uploads are not configured yet. Add Cloudinary credentials before uploading listing photos.",
      };
    }
  }

  async uploadListingImage({ listingId, file, sortOrder = 0 }) {
    this.assertConfigured();

    if (!Buffer.isBuffer(file?.buffer) || file.buffer.length === 0) {
      throw {
        status: 400,
        safe: true,
        message: "One of the selected images could not be processed.",
      };
    }

    const folder = `${this.folder}/listings/${listingId}`;
    const publicId = buildPublicId(file?.originalname || file?.name, sortOrder);

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: "image",
          overwrite: false,
          invalidate: true,
          use_filename: false,
          unique_filename: true,
        },
        (error, uploadResult) => {
          if (error) {
            reject({
              status: 502,
              safe: true,
              message: "Image upload failed while talking to Cloudinary.",
              details: error?.message || error,
            });
            return;
          }

          resolve(uploadResult);
        }
      );

      Readable.from([file.buffer]).pipe(stream);
    });

    return {
      provider: "cloudinary",
      secureUrl: result.secure_url,
      publicId: result.public_id || null,
      assetId: result.asset_id || null,
      width: Number.isFinite(Number(result.width)) ? Number(result.width) : null,
      height: Number.isFinite(Number(result.height)) ? Number(result.height) : null,
      format: result.format || null,
      bytes: Number.isFinite(Number(result.bytes)) ? Number(result.bytes) : null,
    };
  }

  async deleteAsset(publicId) {
    if (!publicId || !this.isConfigured()) return;

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  }
}

function buildPublicId(fileName, sortOrder) {
  const stem = String(fileName || "listing-image")
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const prefix = stem || "listing-image";
  return `${prefix}-${sortOrder}-${Date.now()}`;
}
