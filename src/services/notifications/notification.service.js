import { env } from "../../config/env.js";
import { buildViewingRequestSellerEmail } from "./email-template.service.js";
import { ConsoleEmailProvider } from "./providers/console-email.provider.js";
import { ResendEmailProvider } from "./providers/resend-email.provider.js";

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
}

export function createNotificationService(ctx) {
  return new NotificationService(ctx);
}

export function createEmailProvider() {
  if (env.notifications.email.provider === "resend") {
    return new ResendEmailProvider();
  }

  return new ConsoleEmailProvider();
}
