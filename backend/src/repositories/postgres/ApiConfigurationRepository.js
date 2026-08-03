import { query } from "../../data/db.js";

export const ApiConfigurationRepository = {
  async list() {
    const res = await query("SELECT * FROM api_configurations ORDER BY service_name ASC");
    return res.rows.map(this.mapToModel);
  },
  
  async find(serviceNameOrId) {
    // try finding by service_name first
    let res = await query("SELECT * FROM api_configurations WHERE service_name = $1 LIMIT 1", [serviceNameOrId]);
    if (res.rows.length === 0) {
      // try finding by id if it looks like uuid
      if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(serviceNameOrId)) {
         res = await query("SELECT * FROM api_configurations WHERE id = $1 LIMIT 1", [serviceNameOrId]);
      }
    }
    if (res.rows.length === 0) return null;
    return this.mapToModel(res.rows[0]);
  },
  
  async upsert(serviceName, patch) {
    const existing = await this.find(serviceName);
    if (!existing) {
      const res = await query(
        `INSERT INTO api_configurations (service_name, provider, model_name, api_key_encrypted, is_active, system_prompt) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [serviceName, patch.provider || "gemini", patch.modelName || "", patch.apiKeyEncrypted || "", patch.isActive !== undefined ? patch.isActive : false, patch.systemPrompt || ""]
      );
      return this.mapToModel(res.rows[0]);
    } else {
      const updates = [];
      const values = [];
      let i = 1;
      
      const fields = {
        provider: "provider",
        modelName: "model_name",
        apiKeyEncrypted: "api_key_encrypted",
        isActive: "is_active",
        systemPrompt: "system_prompt"
      };
      
      for (const [jsKey, dbKey] of Object.entries(fields)) {
        if (patch[jsKey] !== undefined) {
          updates.push(`${dbKey} = $${i++}`);
          values.push(patch[jsKey]);
        }
      }
      
      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(existing.id);
        const res = await query(`UPDATE api_configurations SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`, values);
        return this.mapToModel(res.rows[0]);
      }
      return existing;
    }
  },

  mapToModel(row) {
    return {
      id: row.id,
      serviceName: row.service_name,
      provider: row.provider,
      modelName: row.model_name,
      apiKeyEncrypted: row.api_key_encrypted,
      isActive: row.is_active,
      systemPrompt: row.system_prompt,
      updatedAt: row.updated_at
    };
  }
};
