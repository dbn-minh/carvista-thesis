import { env } from "../../config/env.js";
import {
  buildWelcomeEmailTemplate,
  buildViewingRequestBuyerEmail,
  buildViewingRequestSellerEmail,
} from "./email-template.service.js";
import { ConsoleEmailProvider } from "./providers/console-email.provider.js";
import { ResendEmailProvider } from "./providers/resend-email.provider.js";
import { SmtpEmailProvider } from "./providers/smtp-email.provider.js";

export class NotificationService {
  constructor(ctx, { emailProvider } = {}) {
    this.ctx = ctx;
    this.emailProvider = emailProvider || createEmailProvider();
  }

  async createInAppNotification({
    userId,
    entityType,
    entityId,
    title,
    message,
  }) {
    return this.ctx.models.Notifications.create({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId ?? null,
      title: title ?? null,
      message,
      status: "unread",
      read_at: null,
    });
  }

  async sendSellerViewingRequestEmail({
    seller,
    listingTitle,
    listingId,
    buyerName,
    buyerEmail,
    buyerPhone,
    preferredViewingTime,
    message,
  }) {
    if (!seller?.email) {
      return {
        delivered: false,
        provider: this.emailProvider.constructor.name,
        reason: "seller_email_missing",
      };
    }

    const template = buildViewingRequestSellerEmail({
      sellerName: seller.name,
      listingTitle,
      listingId,
      buyerName,
      buyerEmail,
      buyerPhone,
      preferredViewingTime,
      message,
    });

    const delivery = await this.emailProvider.send({
      to: seller.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return {
      delivered: true,
      provider: delivery.provider,
      messageId: delivery.messageId ?? null,
    };
  }

  async sendBuyerViewingRequestEmail({
    buyer,
    listingTitle,
    listingId,
    sellerName,
    preferredViewingTime,
    message,
  }) {
    const buyerEmail = buyer?.email;
    if (!buyerEmail) {
      return {
        delivered: false,
        provider: this.emailProvider.constructor.name,
        reason: "buyer_email_missing",
      };
    }

    const template = buildViewingRequestBuyerEmail({
      buyerName: buyer.name,
      listingTitle,
      listingId,
      sellerName,
      preferredViewingTime,
      message,
    });

    const delivery = await this.emailProvider.send({
      to: buyerEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return {
      delivered: true,
      provider: delivery.provider,
      messageId: delivery.messageId ?? null,
    };
  }

  async sendWelcomeEmail({ user }) {
    const recipientEmail = user?.email;
    if (!recipientEmail || isLocalRecipientEmail(recipientEmail)) {
      return {
        delivered: false,
        provider: this.emailProvider.constructor.name,
        reason: "welcome_email_missing_or_local",
      };
    }

    const template = buildWelcomeEmailTemplate({
      userName: user.name,
    });

    const delivery = await this.emailProvider.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return {
      delivered: true,
      provider: delivery.provider,
      messageId: delivery.messageId ?? null,
    };
  }
}

export function createNotificationService(ctx) {
  return new NotificationService(ctx);
}

export function createEmailProvider() {
  const provider = String(env.notifications.email.provider || "").toLowerCase();

  if (provider === "resend") {
    return new ResendEmailProvider();
  }

  if (provider === "smtp" || provider === "gmail") {
    return new SmtpEmailProvider();
  }

  return new ConsoleEmailProvider();
}

function isLocalRecipientEmail(email) {
  const domain = String(email || "").split("@").pop()?.toLowerCase() || "";
  return domain === "localhost" || domain.endsWith(".local");
}
