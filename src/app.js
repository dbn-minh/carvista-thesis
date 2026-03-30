import express from "express";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { fileURLToPath } from "url";

import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/error.js";

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (env.cors.allowedOrigins.includes(origin)) return true;
  return env.cors.allowedOriginPatterns.some((pattern) => {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(origin);
  });
}

export function createApp(db) {
  const app = express();
  if (env.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: env.cors.credentials,
    })
  );
  app.use(express.json({ limit: env.jsonLimit }));
  app.use(morgan(env.logFormat));

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

  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "carvista-api",
      docs_url: `${env.appPublicUrl}/api-docs`,
    });
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "carvista-api",
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(doc));
  app.get("/api-docs.yaml", (_req, res) => res.type("text/yaml").send(fs.readFileSync(yamlPath, "utf8")));

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
