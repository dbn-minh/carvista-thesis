import { env } from "../../../config/env.js";

export class TwilioSmsProvider {
  async sendOtp({ destination, message }) {
    const { twilioAccountSid, twilioAuthToken, twilioFromNumber } = env.notifications.sms;

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      throw {
        status: 503,
        safe: true,
        message: "SMS delivery is not configured yet. Please try again later.",
      };
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: destination,
      From: twilioFromNumber,
      Body: message,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${twilioAccountSid}:${twilioAuthToken}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw {
        status: 502,
        safe: true,
        message: "SMS delivery is temporarily unavailable. Please try again later.",
        details: payload,
      };
    }

    return {
      provider: "twilio",
      messageId: payload?.sid || null,
    };
  }
}
