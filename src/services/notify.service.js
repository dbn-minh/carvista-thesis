import { NotificationService } from "./notifications/notification.service.js";

export async function createNotification(
  ctxOrModels,
  userId,
  entityType,
  entityId,
  title,
  message
) {
  const notificationsModel =
    ctxOrModels?.models?.Notifications || ctxOrModels?.Notifications || null;

  if (!notificationsModel) {
    throw new Error("Notifications model is not available.");
  }

  if (ctxOrModels?.models) {
    const notificationService = new NotificationService(ctxOrModels);
    return notificationService.createInAppNotification({
      userId,
      entityType,
      entityId,
      title,
      message,
    });
  }

  return notificationsModel.create({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId ?? null,
    title: title ?? null,
    message,
    status: "unread",
    read_at: null,
  });
}
