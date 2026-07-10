import { env } from "../../config/env.js";
import { buildOtpEmailTemplate } from "../notifications/email-template.service.js";
import { createEmailProvider } from "../notifications/notification.service.js";
import { ConsoleSmsProvider } from "./providers/console-sms.provider.js";
import { SpeedSmsProvider } from "./providers/speedsms-sms.provider.js";
import { TwilioSmsProvider } from "./providers/twilio-sms.provider.js";

export class OtpDeliveryService {
  constructor() {
    this.emailProvider = createEmailProvider();
    this.smsProvider = createSmsProvider();
  }

  async sendOtp({ destinationType, destinationValue, code, purpose }) {
    if (destinationType === "email") {
      const template = buildOtpEmailTemplate({
        code,
        expiresInMinutes: env.auth.otpExpiresInMinutes,
        purpose,
      });

      return this.emailProvider.send({
        to: destinationValue,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    }

    const expiryUnit = env.auth.otpExpiresInMinutes === 1 ? "minute" : "minutes";
    const message = `Ma OTP CarVista cua ban la ${code}. Hieu luc trong ${env.auth.otpExpiresInMinutes} ${expiryUnit}.`;
    return this.smsProvider.sendOtp({
      destination: destinationValue,
      message,
    });
  }
}

function createSmsProvider() {
  const provider = String(env.notifications.sms.provider || "console").toLowerCase();

  if (provider === "twilio") {
    return new TwilioSmsProvider();
  }

  if (provider === "speedsms") {
    return new SpeedSmsProvider();
  }

  return new ConsoleSmsProvider();
}
