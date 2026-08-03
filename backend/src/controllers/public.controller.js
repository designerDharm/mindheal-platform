import { repositories } from "../repositories/index.js";
import { decryptSecret } from "../services/secret.service.js";
import { ok } from "../utils/http.js";

export async function publicConfig() {
  const mapsConfig = await repositories.apiConfigurations.find("google-maps");
  return ok({
    mapsApiKey: mapsConfig && mapsConfig.isActive ? decryptSecret(mapsConfig.apiKeyEncrypted) : null
  });
}
