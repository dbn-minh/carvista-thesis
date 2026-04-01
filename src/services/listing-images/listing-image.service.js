import { env } from "../../config/env.js";
import {
  validateListingImageFiles,
  validateListingImageReferences,
} from "./image-validation.service.js";
import { DbImageStorageService } from "./db-image-storage.service.js";
import { CloudinaryService } from "../media/cloudinary.service.js";

export class ListingImageService {
  constructor({ storage }) {
    this.storage = storage;
  }

  static fromContext(ctx) {
    const mediaProvider =
      env.media.provider === "cloudinary"
        ? new CloudinaryService({
            cloudName: env.media.cloudinary.cloudName,
            apiKey: env.media.cloudinary.apiKey,
            apiSecret: env.media.cloudinary.apiSecret,
            folder: env.media.cloudinary.folder,
            enabled: true,
          })
        : null;

    return new ListingImageService({
      storage: new DbImageStorageService({
        ListingImages: ctx.models.ListingImages,
        sequelize: ctx.sequelize,
        logger: console,
        mediaProvider,
        allowInlineUploadFallback: env.media.provider === "db_legacy",
      }),
    });
  }

  async persistUploadedImages(listingId, files = []) {
    validateListingImageFiles(files);
    return this.storage.storeListingImages({ listingId, files });
  }

  async persistImageReferences(listingId, imageUrls = []) {
    validateListingImageReferences(imageUrls);
    return this.storage.storeListingImages({ listingId, imageUrls });
  }

  async listImages(listingId) {
    return this.storage.listListingImages({ listingId });
  }

  async deleteImage(listingId, imageId) {
    return this.storage.deleteListingImage({ listingId, imageId });
  }

  async reorderImages(listingId, imageIds = []) {
    return this.storage.reorderListingImages({ listingId, imageIds });
  }

  async resolveImageContent(listingId, imageId) {
    return this.storage.resolveListingImageContent({ listingId, imageId });
  }

  normalizeRecords(records = []) {
    return this.storage.normalizeListingImageRecords(records);
  }
}

export function createListingImageService(ctx) {
  return ListingImageService.fromContext(ctx);
}
