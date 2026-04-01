export const LISTING_IMAGE_LIMITS = {
  maxCount: 10,
  maxFileSizeBytes: 8 * 1024 * 1024,
  maxTotalSizeBytes: 60 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
};

export function validateListingImageFiles(files = []) {
  if (!Array.isArray(files)) {
    throw createImageValidationError("Malformed image payload.");
  }

  if (files.length > LISTING_IMAGE_LIMITS.maxCount) {
    throw createImageValidationError(
      `You can upload up to ${LISTING_IMAGE_LIMITS.maxCount} images per listing.`
    );
  }

  let totalSize = 0;

  for (const file of files) {
    if (!isSupportedListingImageMimeType(file?.mimetype || file?.type)) {
      throw createImageValidationError("Only JPG, PNG, and WEBP files are supported.");
    }

    if (Number(file?.size || 0) > LISTING_IMAGE_LIMITS.maxFileSizeBytes) {
      throw createImageValidationError(
        "One of your processed photos is still too large. Please upload a slightly smaller image."
      );
    }

    totalSize += Number(file?.size || 0);
  }

  if (totalSize > LISTING_IMAGE_LIMITS.maxTotalSizeBytes) {
    throw createImageValidationError(
      "Your photo batch is too large overall. Please upload fewer images or smaller files."
    );
  }

  return true;
}

export function validateListingImageReferences(imageUrls = []) {
  if (!Array.isArray(imageUrls)) {
    throw createImageValidationError("Malformed image payload.");
  }

  if (imageUrls.length > LISTING_IMAGE_LIMITS.maxCount) {
    throw createImageValidationError(
      `You can upload up to ${LISTING_IMAGE_LIMITS.maxCount} images per listing.`
    );
  }

  for (const imageUrl of imageUrls) {
    if (
      typeof imageUrl !== "string" ||
      !imageUrl.trim() ||
      !/^https?:\/\//.test(imageUrl)
    ) {
      throw createImageValidationError(
        "Images must be valid remote image URLs."
      );
    }
  }

  return true;
}

export function isSupportedListingImageMimeType(mimeType) {
  return typeof mimeType === "string" && LISTING_IMAGE_LIMITS.allowedMimeTypes.includes(mimeType);
}

export function createImageValidationError(message, details) {
  return {
    status: 400,
    safe: true,
    message,
    details,
  };
}
