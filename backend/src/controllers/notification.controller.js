import { repositories } from "../repositories/index.js";
import { notificationService } from "../services/notification.service.js";
import { ok } from "../utils/http.js";

export async function getNotifications({ user }) {
  const notifications = await repositories.notifications.listForUser(user.id);
  return ok(notifications);
}

export async function markAsRead({ params, user }) {
  const updated = await repositories.notifications.markAsRead(params.id, user.id);
  return ok(updated);
}

// Admin or System can send notification manually
export async function sendNotification({ body }) {
  // body should have { userId, role, title, message, type }
  const result = await notificationService.send(body);
  return ok(result);
}
