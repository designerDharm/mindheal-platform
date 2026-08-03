import { repositories } from "../repositories/index.js";
import { getIO } from "../socket.js";

export const notificationService = {
  /**
   * Sends a real-time notification via WebSockets and persists it to the database.
   * @param {Object} payload 
   * @param {string} payload.userId Target user ID
   * @param {string} payload.role Target user role ('user', 'counsellor', 'admin')
   * @param {string} payload.title Notification title
   * @param {string} payload.message Notification body
   * @param {string} payload.type Notification type ('alert', 'info', 'success', 'warning')
   */
  async send(payload) {
    // 1. Persist to DB (SSoT)
    const notification = await repositories.notifications.create(payload);

    // 2. Emit via WebSockets if user is connected
    try {
      const io = getIO();
      io.to(payload.userId).emit("notification", notification);
    } catch (err) {
      // Socket not initialized or user not connected
      console.log(`[Notification] Failed to emit via WebSocket: ${err.message}`);
    }

    return notification;
  }
};
