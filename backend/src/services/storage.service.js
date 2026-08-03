import { bucket } from '../config/firebase.js';
import { appConfig } from '../config/app.js';
import { createId } from '../utils/security.js';

const signedUrlTtlSeconds = Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS || 15 * 60);

export const StorageService = {
  async uploadFile(buffer, originalFilename, mimeType, folder = 'uploads') {
    const safeFolder = sanitizeStoragePath(folder);
    const safeOriginalFilename = sanitizeFilename(originalFilename);
    const fallbackPath = `${safeFolder}/${safeOriginalFilename}`;

    if (!bucket) {
      if (appConfig.env === "production") {
        throw new Error("Firebase Storage is not configured.");
      }
      console.warn("Storage upload bypassed - Firebase not fully configured. Returning local mock URL.");
      return mockUploadResult(fallbackPath, safeOriginalFilename);
    }

    const extension = getExtension(safeOriginalFilename);
    const storagePath = `${safeFolder}/${Date.now()}-${createId('file')}.${extension}`;
    const file = bucket.file(storagePath);

    try {
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: "private, max-age=0, no-store",
          metadata: {
            originalFilename: safeOriginalFilename
          }
        },
        resumable: false,
      });

      return createSignedUploadResult(file, storagePath, safeOriginalFilename);
    } catch (error) {
      if (appConfig.env === "production") {
        throw error;
      }
      console.warn(`Storage upload failed, using local mock URL: ${error.message}`);
      return mockUploadResult(fallbackPath, safeOriginalFilename);
    }
  },

  async getSignedUrl(storagePath) {
    const safePath = sanitizeExistingStoragePath(storagePath);

    if (!bucket) {
      if (appConfig.env === "production") {
        throw new Error("Firebase Storage is not configured.");
      }
      return mockSignedUrlResult(safePath);
    }

    return createSignedUrlResult(bucket.file(safePath), safePath);
  },

  async deleteFile(storagePath) {
    const safePath = sanitizeExistingStoragePath(storagePath);

    if (!bucket) {
      if (appConfig.env === "production") {
        throw new Error("Firebase Storage is not configured.");
      }
      return { storagePath: safePath, deleted: true, skipped: true };
    }

    await bucket.file(safePath).delete({ ignoreNotFound: true });
    return { storagePath: safePath, deleted: true };
  }
};

async function createSignedUploadResult(file, storagePath, filename) {
  const signed = await createSignedUrlResult(file, storagePath);
  return { ...signed, filename };
}

async function createSignedUrlResult(file, storagePath) {
  const expiresAt = new Date(Date.now() + signedUrlTtlSeconds * 1000);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: expiresAt
  });
  return { url, storagePath, expiresAt: expiresAt.toISOString() };
}

function mockUploadResult(storagePath, filename) {
  return { ...mockSignedUrlResult(storagePath), filename };
}

function mockSignedUrlResult(storagePath) {
  return {
    url: `https://mock-storage.local/${storagePath}`,
    storagePath,
    expiresAt: null
  };
}

function sanitizeFilename(filename = "upload.bin") {
  return String(filename || "upload.bin")
    .split(/[\\/]/)
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+/, "")
    .slice(0, 120) || "upload.bin";
}

function sanitizeStoragePath(folder = "uploads") {
  return String(folder || "uploads")
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, ""))
    .filter((segment) => segment !== "." && segment !== "..")
    .filter(Boolean)
    .join("/") || "uploads";
}

function sanitizeExistingStoragePath(storagePath) {
  const safePath = sanitizeStoragePath(storagePath);
  if (!safePath || safePath === "uploads") {
    throw new Error("A valid storage path is required.");
  }
  return safePath;
}

function getExtension(filename) {
  const extension = filename.includes(".") ? filename.split(".").pop() : "";
  return extension && extension.length <= 12 ? extension : "bin";
}
