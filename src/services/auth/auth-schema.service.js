import { runSchemaGuard } from "../shared/schema-guard.service.js";

export function ensureAuthSchema(ctx) {
  return runSchemaGuard("auth-schema", async () => {
    const { OtpChallenges, ExternalIdentities, AuthEventLogs } = ctx.models;
    await OtpChallenges.sync();
    await ExternalIdentities.sync();
    await AuthEventLogs.sync();
  });
}
