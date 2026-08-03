import { query } from "../../data/db.js";

export const UserRepository = {
  async list() {
    const res = await query('SELECT * FROM users');
    return res.rows.map(this.mapUser);
  },
  
  async findById(id) {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapUser(res.rows[0]);
  },
  
  async findByEmailAndRole(email, role) {
    const res = await query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, role]);
    if (res.rows.length === 0) return null;
    return this.mapUser(res.rows[0]);
  },
  
  async findByMobileAndRole(mobile, role) {
    const res = await query('SELECT * FROM users WHERE mobile = $1 AND role = $2', [mobile, role]);
    if (res.rows.length === 0) return null;
    return this.mapUser(res.rows[0]);
  },
  
  async create(user) {
    const res = await query(
      `INSERT INTO users (id, firebase_uid, role, full_name, email, mobile, language_code, avatar_url, is_active, password_hash, date_of_birth, is_guardian_consent_verified, guardian_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        user.id,
        user.firebase_uid || user.firebaseUid || null,
        user.role,
        user.full_name || user.fullName,
        user.email,
        user.mobile || null,
        user.language_code || user.languageCode || 'en',
        user.avatar_url || user.avatarUrl || null,
        true,
        user.password_hash || user.passwordHash || null,
        user.date_of_birth || user.dateOfBirth || null,
        user.is_guardian_consent_verified || user.isGuardianConsentVerified || false,
        user.guardian_email || user.guardianEmail || null
      ]
    );
    return this.mapUser(res.rows[0]);
  },
  
  async update(id, patch) {
    const keys = Object.keys(patch);
    if (keys.length === 0) return this.findById(id);
    
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = keys.map(key => patch[key]);
    
    const res = await query(
      `UPDATE users SET ${setClause}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    
    if (res.rows.length === 0) return null;
    return this.mapUser(res.rows[0]);
  },

  mapUser(row) {
    return {
      id: row.id,
      firebaseUid: row.firebase_uid,
      role: row.role,
      fullName: row.full_name,
      email: row.email,
      mobile: row.mobile,
      languageCode: row.language_code,
      avatarUrl: row.avatar_url,
      isActive: row.is_active,
      passwordHash: row.password_hash,
      dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : null,
      date_of_birth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : null,
      isGuardianConsentVerified: row.is_guardian_consent_verified,
      guardianEmail: row.guardian_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};
