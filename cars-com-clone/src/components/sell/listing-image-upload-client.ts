const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_COUNT = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 24 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const TARGET_TYPE = "image/webp";
const TARGET_QUALITY = 0.82;

export const LISTING_IMAGE_CLIENT_LIMITS = {
  maxCount: MAX_FILE_COUNT,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  maxTotalUploadBytes: MAX_TOTAL_UPLOAD_BYTES,
};

export type ListingImageUploadClientError = {
  code:
    | "too_many_files"
    | "unsupported_type"
    | "file_too_large"
    | "batch_too_large"
    | "processing_failed";
  message: string;
};

export function validateSelectedImageFiles(
  files: File[],
  existingCount: number
): ListingImageUploadClientError[] {
  const errors: ListingImageUploadClientError[] = [];

  if (existingCount + files.length > MAX_FILE_COUNT) {
    errors.push({
      code: "too_many_files",
      message: `You can upload up to ${MAX_FILE_COUNT} images per listing.`,
    });
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push({
        code: "unsupported_type",
        message: "Only JPG, PNG, and WEBP files are supported.",
      });
      break;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push({
        code: "file_too_large",
        message: "This image is too large. Please upload a smaller file.",
      });
      break;
    }
  }

  return errors;
}

export function validatePreparedListingImages(
  files: File[]
): ListingImageUploadClientError[] {
  const errors: ListingImageUploadClientError[] = [];
  const totalSize = files.reduce((sum, file) => sum + Number(file.size || 0), 0);

  if (files.length > MAX_FILE_COUNT) {
    errors.push({
      code: "too_many_files",
      message: `You can upload up to ${MAX_FILE_COUNT} images per listing.`,
    });
  }

  if (totalSize > MAX_TOTAL_UPLOAD_BYTES) {
    errors.push({
      code: "batch_too_large",
      message: "Your photo batch is too large overall. Please use fewer images or smaller files.",
    });
  }

  return errors;
}

export async function optimizeListingImageFile(file: File): Promise<File> {
  const drawable = await loadDrawableImage(file);

  const { width, height } = resizeDimensions(drawable.width, drawable.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not process image preview.");
  }

  context.drawImage(drawable.source, 0, 0, width, height);
  drawable.dispose();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, TARGET_TYPE, TARGET_QUALITY);
  });

  if (!blob) {
    throw new Error("Could not optimize image.");
  }

  return new File([blob], replaceExtension(file.name, ".webp"), {
    type: TARGET_TYPE,
    lastModified: Date.now(),
  });
}

export function createObjectPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeObjectPreviewUrl(url: string | null | undefined) {
  if (url) URL.revokeObjectURL(url);
}

export function getSafeImageSrc(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resizeDimensions(width: number, height: number) {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { width, height };
  }

  if (width >= height) {
    const scale = MAX_DIMENSION / width;
    return {
      width: MAX_DIMENSION,
      height: Math.round(height * scale),
    };
  }

  const scale = MAX_DIMENSION / height;
  return {
    width: Math.round(width * scale),
    height: MAX_DIMENSION,
  };
}

function replaceExtension(name: string, extension: string) {
  return name.replace(/\.[^/.]+$/, "") + extension;
}

async function loadDrawableImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  const previewUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not process image preview."));
      element.src = previewUrl;
    });

    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      dispose: () => {},
    };
  } finally {
    URL.revokeObjectURL(previewUrl);
  }
}
