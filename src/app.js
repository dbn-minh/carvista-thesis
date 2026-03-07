import express from "express";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { fileURLToPath } from "url";

import { apiRouter } from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/error.js";

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  // attach db ctx
  app.use((req, _res, next) => {
    req.ctx = db; // { sequelize, models, tables }
    next();
  });

  // Swagger
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const yamlPath = path.join(__dirname, "swagger", "openapi.yaml");
  const doc = YAML.parse(fs.readFileSync(yamlPath, "utf8"));

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(doc));
  app.get("/api-docs.yaml", (_req, res) => res.type("text/yaml").send(fs.readFileSync(yamlPath, "utf8")));

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}