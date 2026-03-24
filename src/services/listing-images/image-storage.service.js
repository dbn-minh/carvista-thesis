export class ImageStorageService {
  async storeListingImages(_payload) {
    throw new Error("storeListingImages must be implemented by a storage provider.");
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
