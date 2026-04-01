export class ImageStorageService {
  async storeListingImages(_payload) {
    throw new Error("storeListingImages must be implemented by a storage provider.");
  }

  async listListingImages(_payload) {
    throw new Error("listListingImages must be implemented by a storage provider.");
  }

  async deleteListingImage(_payload) {
    throw new Error("deleteListingImage must be implemented by a storage provider.");
  }

  async reorderListingImages(_payload) {
    throw new Error("reorderListingImages must be implemented by a storage provider.");
  }

  async resolveListingImageContent(_payload) {
    throw new Error("resolveListingImageContent must be implemented by a storage provider.");
  }

  normalizeListingImageRecord(_record) {
    throw new Error("normalizeListingImageRecord must be implemented by a storage provider.");
  }

  normalizeListingImageRecords(records = []) {
    return records
      .map((record) => this.normalizeListingImageRecord(record))
      .filter(Boolean);
  }
}
