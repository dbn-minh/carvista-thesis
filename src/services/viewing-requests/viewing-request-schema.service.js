import { ensureColumn, runSchemaGuard } from "../shared/schema-guard.service.js";

export function ensureViewingRequestSchema(ctx) {
  return runSchemaGuard("viewing-request-schema", async () => {
    const { sequelize } = ctx;
    await ensureColumn(
      sequelize,
      "viewing_requests",
      "seller_user_id",
      "BIGINT NULL"
    );
    await ensureColumn(
      sequelize,
      "viewing_requests",
      "preferred_viewing_time",
      "DATETIME NULL"
    );
    await ensureColumn(
      sequelize,
      "viewing_requests",
      "notified_at",
      "DATETIME NULL"
    );
  });
}
