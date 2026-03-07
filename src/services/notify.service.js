export async function createNotification({ Notifications }, userId, entityType, entityId, title, message) {
  return Notifications.create({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId ?? null,
    title: title ?? null,
    message,
    status: "unread",
    read_at: null,
  });
}