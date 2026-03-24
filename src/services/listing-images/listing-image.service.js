import {
  validateListingImageFiles,
  validateListingImageReferences,
} from "./image-validation.service.js";
import { DbImageStorageService } from "./db-image-storage.service.js";

export class ListingImageService {
  constructor({ storage }) {
    this.storage = storage;
  }

  static fromContext(ctx) {
    return new ListingImageService({
      storage: new DbImageStorageService({
        ListingImages: ctx.models.ListingImages,
        sequelize: ctx.sequelize,
        logger: console,
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
