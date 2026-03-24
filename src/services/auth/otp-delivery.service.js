import { env } from "../../config/env.js";
import { buildOtpEmailTemplate } from "../notifications/email-template.service.js";
import { createEmailProvider } from "../notifications/notification.service.js";
import { ConsoleSmsProvider } from "./providers/console-sms.provider.js";
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

    const message = `Your CarVista verification code is ${code}. It expires in ${env.auth.otpExpiresInMinutes} minutes.`;
    return this.smsProvider.sendOtp({
      destination: destinationValue,
      message,
    });
  }
}

function createSmsProvider() {
  if (env.notifications.sms.provider === "twilio") {
    return new TwilioSmsProvider();
  }

  return new ConsoleSmsProvider();
}
