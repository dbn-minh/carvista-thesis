export const validate = (schema) => (req, _res, next) => {
  try {
    req.validated = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (e) {
    next({ status: 400, message: "Validation error", details: e.errors });
  }
};