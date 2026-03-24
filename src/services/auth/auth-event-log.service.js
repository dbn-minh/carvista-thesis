import { ensureAuthSchema } from "./auth-schema.service.js";

export class AuthEventLogService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async log({
    userId = null,
    eventType,
    authMethod,
    destinationType = null,
    destinationValue = null,
    providerName = null,
    success = false,
    ipAddress = null,
    metadata = null,
  }) {
    try {
      await ensureAuthSchema(this.ctx);
      await this.ctx.models.AuthEventLogs.create({
        user_id: userId,
        event_type: eventType,
        auth_method: authMethod,
        destination_type: destinationType,
        destination_value: destinationValue,
        provider_name: providerName,
        success,
        ip_address: ipAddress,
        metadata_json: metadata ? JSON.stringify(metadata) : null,
      });
    } catch (error) {
      console.error("[auth-event-log] failed", {
        eventType,
        authMethod,
        success,
        message: error?.message || String(error),
      });
    }
  }
}
