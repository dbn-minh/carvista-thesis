import { ensureColumn, runSchemaGuard } from "../shared/schema-guard.service.js";

export function ensureUserProfileSchema(ctx) {
  return runSchemaGuard("user-profile-schema", async () => {
    const { sequelize } = ctx;

    await ensureColumn(
      sequelize,
      "users",
      "preferred_contact_method",
      "VARCHAR(40) NULL"
    );
  });
}
