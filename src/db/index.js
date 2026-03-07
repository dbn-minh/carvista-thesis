import { Sequelize } from "sequelize";
import { env } from "../config/env.js";
import initModels from "../models/init-models.js";

export function createDb() {
  const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
    host: env.db.host,
    port: env.db.port,
    dialect: "mysql",
    logging: false,
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