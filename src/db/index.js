import { Sequelize } from "sequelize";
import { env } from "../config/env.js";
import initModels from "../models/init-models.js";

export function createDb() {
  const baseConfig = {
    dialect: env.db.dialect,
    logging: false,
    pool: {
      max: env.db.poolMax,
      min: env.db.poolMin,
      acquire: env.db.poolAcquireMs,
      idle: env.db.poolIdleMs,
    },
    dialectOptions: env.db.ssl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: env.db.sslRejectUnauthorized,
          },
        }
      : undefined,
  };

  const sequelize = env.db.url
    ? new Sequelize(env.db.url, baseConfig)
    : new Sequelize(env.db.name, env.db.user, env.db.password, {
        ...baseConfig,
        host: env.db.host,
        port: env.db.port,
      });

  const models = initModels(sequelize);

  // Optional stable map by table name
  const tables = {};
  for (const m of Object.values(models)) {
    const tn = m.getTableName?.();
    const tableName = typeof tn === "string" ? tn : tn?.tableName;
    if (tableName) tables[tableName] = m;
  }

  return { sequelize, models, tables };
}
