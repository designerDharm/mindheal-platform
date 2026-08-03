import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { appConfig } from "../config/app.js";

const encryptedPrefix = "enc:v1:";

export function encryptSecret(value = "") {
  if (!value) return "";
  const key = getEncryptionKey();
  if (!key) {
    console.warn("API config encryption key is not configured. Storing local development secret as plaintext.");
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    encryptedPrefix.slice(0, -1),
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(":");
}

export function decryptSecret(value = "") {
  if (!value) return "";
  if (!isEncryptedSecret(value)) return value;

  const key = getEncryptionKey();
  if (!key) {
    throw new Error("API config encryption key is required to decrypt stored secrets.");
  }

  const [, , iv, tag, ciphertext] = String(value).split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function isEncryptedSecret(value = "") {
  return String(value).startsWith(encryptedPrefix);
}

function getEncryptionKey() {
  const raw = process.env.API_CONFIG_ENCRYPTION_KEY || "";
  if (!raw) {
    if (appConfig.env === "production") {
      throw new Error("API_CONFIG_ENCRYPTION_KEY must be configured in production.");
    }
    return null;
  }
  if (raw.length < 32 || /change-me|example|your_/i.test(raw)) {
    throw new Error("API_CONFIG_ENCRYPTION_KEY is too weak.");
  }
  return createHash("sha256").update(raw).digest();
}
