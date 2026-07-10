import { env } from "../../../config/env.js";

const SPEEDSMS_SUCCESS_CODE = "00";

export class SpeedSmsProvider {
  constructor({ config = env.notifications.sms, fetchImpl = fetch } = {}) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async sendOtp({ destination, message }) {
    const {
      speedSmsAccessToken,
      speedSmsApiBaseUrl,
      speedSmsSmsType,
      speedSmsSender,
    } = this.config;

    if (!speedSmsAccessToken) {
      throw {
        status: 503,
        safe: true,
        message: "SMS delivery is not configured yet. Please try again later.",
      };
    }

    const endpoint = new URL(
      `${String(speedSmsApiBaseUrl || "https://api.speedsms.vn/index.php").replace(/\/+$/, "")}/sms/send`
    );
    endpoint.search = new URLSearchParams({
      "access-token": speedSmsAccessToken,
      to: formatSpeedSmsPhone(destination),
      content: message,
      type: String(speedSmsSmsType || 4),
      sender: speedSmsSender || "Verify",
    }).toString();

    const response = await this.fetchImpl(endpoint.toString(), {
      method: "GET",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status !== "success" || payload?.code !== SPEEDSMS_SUCCESS_CODE) {
      const errorCode = payload?.code || response.status;
      const errorMessage = payload?.message || response.statusText || "SpeedSMS delivery failed";

      console.warn("[notifications:sms:speedsms] delivery failed", {
        code: errorCode,
        message: errorMessage,
        invalidPhone: payload?.invalidPhone || payload?.data?.invalidPhone || [],
      });

      throw {
        status: 502,
        safe: true,
        message: "SMS delivery is temporarily unavailable. Please try again later.",
        details: {
          provider: "speedsms",
          code: errorCode,
          message: errorMessage,
          invalidPhone: payload?.invalidPhone || payload?.data?.invalidPhone || [],
        },
      };
    }

    return {
      provider: "speedsms",
      messageId: payload?.data?.tranId ? String(payload.data.tranId) : null,
    };
  }
}

function formatSpeedSmsPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) return `84${digits.slice(1)}`;
  return digits;
}
