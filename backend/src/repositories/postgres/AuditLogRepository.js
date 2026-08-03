import { query } from "../../data/db.js";

export const AuditLogRepository = {
  async create(payload) {
    const res = await query(
      "INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [payload.userId, payload.action, payload.entity, payload.entityId, payload.details ? JSON.stringify(payload.details) : null]
    );
    return res.rows[0];
  },
  
  async list(limit = 50, offset = 0) {
    const res = await query(
      "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    return res.rows;
  }
};
