import { query } from "../../data/db.js";

export const ServicesCatalogRepository = {
  async list() {
    const res = await query("SELECT * FROM services_catalog ORDER BY name ASC");
    return res.rows.map(this.mapToModel);
  },
  
  async update(id, patch) {
    const updates = [];
    const values = [];
    let i = 1;
    
    const fields = {
      name: "name",
      description: "description",
      category: "category",
      icon: "icon",
      isActive: "is_active",
      isFree: "is_free",
      pricePaise: "price_paise",
      apiConfigId: "api_config_id"
    };
    
    for (const [jsKey, dbKey] of Object.entries(fields)) {
      if (patch[jsKey] !== undefined) {
        updates.push(`${dbKey} = $${i++}`);
        values.push(patch[jsKey]);
      }
    }
    
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(id);
      const res = await query(`UPDATE services_catalog SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`, values);
      if (res.rows.length === 0) return null;
      return this.mapToModel(res.rows[0]);
    }
    
    const res = await query("SELECT * FROM services_catalog WHERE id = $1 LIMIT 1", [id]);
    if (res.rows.length === 0) return null;
    return this.mapToModel(res.rows[0]);
  },

  mapToModel(row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      icon: row.icon,
      isActive: row.is_active,
      isFree: row.is_free,
      pricePaise: row.price_paise,
      apiConfigId: row.api_config_id,
      updatedAt: row.updated_at
    };
  }
};
