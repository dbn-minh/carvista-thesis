export function notFound(_req, _res, next) {
  next({ status: 404, message: "Not found" });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Internal Server Error",
    details: err.details,
    stack: status === 500 ? err.stack : undefined,
  });
}