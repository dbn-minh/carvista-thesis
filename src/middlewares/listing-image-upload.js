import multer from "multer";
import {
  LISTING_IMAGE_LIMITS,
  createImageValidationError,
  isSupportedListingImageMimeType,
} from "../services/listing-images/image-validation.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: LISTING_IMAGE_LIMITS.maxCount,
    fileSize: LISTING_IMAGE_LIMITS.maxFileSizeBytes,
    fields: 40,
    parts: LISTING_IMAGE_LIMITS.maxCount + 40,
  },
  fileFilter(_req, file, callback) {
    if (!isSupportedListingImageMimeType(file?.mimetype)) {
      callback(createImageValidationError("Only JPG, PNG, and WEBP files are supported."));
      return;
    }

    callback(null, true);
  },
});

export const listingImageUpload = upload.array("images", LISTING_IMAGE_LIMITS.maxCount);
