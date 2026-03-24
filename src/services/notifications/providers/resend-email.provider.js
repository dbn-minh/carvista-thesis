import { env } from "../../../config/env.js";

export class ResendEmailProvider {
  async send({ to, subject, html, text }) {
    if (!env.notifications.email.resendApiKey) {
      throw {
        status: 503,
        safe: true,
        message:
          "Email delivery is not configured yet. Please try again later.",
      };
    }

    const response = await fetch(env.notifications.email.resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.notifications.email.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.notifications.email.from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw {
        status: 502,
        safe: true,
        message:
          "Email delivery is temporarily unavailable. The request was still saved.",
        details: payload,
      };
    }

    return {
      provider: "resend",
      messageId: payload?.id || null,
    };
  }
}
