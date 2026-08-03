import { query } from "../../data/db.js";

export const NotificationRepository = {
  async create(payload) {
    const res = await query(
      "INSERT INTO notifications (user_id, role, title, message, type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [payload.userId, payload.role, payload.title, payload.message, payload.type]
    );
    return res.rows[0];
  },
  
  async listForUser(userId) {
    const res = await query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [userId]
    );
    return res.rows;
  },
  
  async markAsRead(id, userId) {
    const res = await query(
      "UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId]
    );
    return res.rows[0];
  }
};
