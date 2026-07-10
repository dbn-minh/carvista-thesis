import nodemailer from "nodemailer";

import { env } from "../../../config/env.js";

export class SmtpEmailProvider {
  constructor({ transporter, config = env.notifications.email } = {}) {
    this.config = config;
    this.transporter = transporter || createSmtpTransporter(config);
  }

  async send({ to, subject, html, text }) {
    assertSmtpConfigured(this.config);

    const delivery = await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject,
      html,
      text,
    });

    return {
      provider: "smtp",
      messageId: delivery?.messageId || null,
    };
  }
}

function createSmtpTransporter(config) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

function assertSmtpConfigured(config) {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    throw {
      status: 503,
      safe: true,
      message:
        "Email delivery is not configured yet. Please try again later.",
    };
  }
}
