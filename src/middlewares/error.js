export function notFound(_req, _res, next) {
  next({ status: 404, message: "Not found" });
}

export function errorHandler(err, _req, res, _next) {
  const mapped = mapUploadError(err);
  const status = mapped.status || err.status || 500;
  const isServerError = status >= 500;
  const safeMessage =
    isServerError && !mapped.safe && !err.safe
      ? "Something went wrong while processing the request."
      : mapped.message || err.message || "Request failed";

  if (isServerError) {
    console.error("[HTTP:errorHandler]", {
      status,
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(status).json({
    message: safeMessage,
    details: mapped.details || err.details,
  });
}

function mapUploadError(err) {
  if (err?.type === "entity.too.large") {
    return {
      status: 413,
      safe: true,
      message: "Your upload is too large. Please use fewer images or smaller files.",
    };
  }

  if (err?.code === "LIMIT_FILE_SIZE") {
    return {
      status: 413,
      safe: true,
      message: "One of your images is too large. Please upload a smaller file.",
    };
  }

  if (err?.code === "LIMIT_FILE_COUNT" || err?.code === "LIMIT_UNEXPECTED_FILE") {
    return {
      status: 400,
      safe: true,
      message: "Too many images were selected for this listing.",
    };
  }

  return {
    status: err?.status,
    safe: err?.safe,
    message: err?.message,
    details: err?.details,
  };
}
