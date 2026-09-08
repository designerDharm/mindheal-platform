import busboy from "busboy";
import { StorageService } from "../services/storage.service.js";
import { repositories } from "../repositories/index.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const maxUploadBytes = 10 * 1024 * 1024;

export function uploadFile(context) {
  return new Promise((resolve) => {
    // If we reach here, app.js should not have consumed the stream for multipart.
    const bb = busboy({
      headers: context.req.headers,
      limits: { fileSize: maxUploadBytes, files: 1 }
    });
    let fileBuffer = null;
    let filename = '';
    let mimeType = '';
    let uploadError = null;

    bb.on('file', (name, file, info) => {
      filename = info.filename;
      mimeType = info.mimeType;
      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
      file.on('limit', () => {
        uploadError = apiError(413, "PAYLOAD_TOO_LARGE", "File must be 10MB or smaller.");
      });
    });

    bb.on('close', async () => {
      try {
        if (uploadError) return resolve(uploadError);
        if (!fileBuffer) {
          return resolve(apiError(400, "BAD_REQUEST", "No file uploaded."));
        }
        const validation = validateUploadFile(fileBuffer, mimeType);
        if (!validation.valid) {
          return resolve(apiError(400, "UNSUPPORTED_FILE_TYPE", "Upload must be a JPG, PNG, PDF, or DOCX file."));
        }

        // Peer talk security validations
        const url = new URL(context.req.url || "", "http://localhost");
        const peerSessionId = context.req.headers["x-peer-session-id"] || url.searchParams.get("peerSessionId");
        
        if (peerSessionId) {
          const session = await repositories.peerSessions.findById(peerSessionId);
          if (!session) {
            return resolve(apiError(404, "SESSION_NOT_FOUND", "Peer session not found."));
          }

          const currentUser = context.user || context.req?.user;
          if (!currentUser) {
            return resolve(apiError(401, "UNAUTHORIZED", "User context not found."));
          }

          const listenerProfile = await repositories.peerListenerProfiles.findById(session.listenerProfileId);
          if (!listenerProfile) {
            return resolve(apiError(404, "LISTENER_NOT_FOUND", "Listener profile not found."));
          }

          if (session.requesterUserId !== currentUser.id && listenerProfile.userId !== currentUser.id) {
            return resolve(apiError(403, "FORBIDDEN", "You are not authorized for this session."));
          }

          // Enforce 5-minute timer gate
          const timeElapsedSeconds = (Date.now() - new Date(session.startedAt).getTime()) / 1000;
          if (timeElapsedSeconds < 300) {
            return resolve(apiError(403, "GATE_LOCKED", "File sharing is locked during the first 5 minutes."));
          }

          // Enforce dual consent
          const consents = await repositories.peerSessionConsents.findBySessionId(session.id);
          const reqConsent = consents.find(c => c.userId === session.requesterUserId && c.capability === "file_sharing" && c.consentStatus === "granted");
          const listConsent = consents.find(c => c.userId === listenerProfile.userId && c.capability === "file_sharing" && c.consentStatus === "granted");

          if (!reqConsent || !listConsent) {
            return resolve(apiError(403, "CONSENT_REQUIRED", "Both users must grant file sharing consent."));
          }
        }

        // Clean/Strip EXIF metadata for images
        if (mimeType === "image/jpeg") {
          fileBuffer = stripJpegExif(fileBuffer);
        }

        const upload = await StorageService.uploadFile(fileBuffer, filename, mimeType, 'uploads');
        resolve({
          status: 200,
          body: { success: true, data: { ...upload, filename: upload.filename || filename } }
        });
      } catch (err) {
        console.error("Upload error:", err);
        resolve(apiError(500, "UPLOAD_FAILED", "Failed to upload file to storage."));
      }
    });
    
    bb.on('error', (err) => {
      console.error("Busboy error:", err);
      resolve(apiError(500, "UPLOAD_PARSE_FAILED", "Upload parsing failed."));
    });

    context.req.pipe(bb);
  });
}

export async function refreshUploadUrl({ body = {} }) {
  const storagePath = readStoragePath(body);
  if (!storagePath) {
    return apiError(400, "BAD_REQUEST", "storagePath is required.");
  }

  try {
    return {
      status: 200,
      body: { success: true, data: await StorageService.getSignedUrl(storagePath) }
    };
  } catch (error) {
    console.error("Signed URL refresh error:", error);
    return apiError(400, "INVALID_STORAGE_PATH", "Unable to refresh the upload URL.");
  }
}

export async function deleteUpload({ body = {} }) {
  const storagePath = readStoragePath(body);
  if (!storagePath) {
    return apiError(400, "BAD_REQUEST", "storagePath is required.");
  }

  try {
    return {
      status: 200,
      body: { success: true, data: await StorageService.deleteFile(storagePath) }
    };
  } catch (error) {
    console.error("Upload delete error:", error);
    return apiError(400, "INVALID_STORAGE_PATH", "Unable to delete the upload.");
  }
}

export function validateUploadFile(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return { valid: false, reason: "empty" };
  }
  if (!allowedMimeTypes.has(mimeType)) {
    return { valid: false, reason: "mime" };
  }

  const signatures = {
    "image/jpeg": isJpeg,
    "image/png": isPng,
    "application/pdf": isPdf,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": isDocx
  };
  return signatures[mimeType]?.(buffer)
    ? { valid: true }
    : { valid: false, reason: "signature" };
}

function isJpeg(buffer) {
  return buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
}

function isPng(buffer) {
  return buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
}

function isPdf(buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isZipContainer(buffer) {
  return buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[2] === 0x07 && buffer[3] === 0x08));
}

function isDocx(buffer) {
  if (!isZipContainer(buffer)) return false;
  const entries = getZipEntryNames(buffer);
  return entries.has("[Content_Types].xml") &&
    entries.has("_rels/.rels") &&
    entries.has("word/document.xml");
}

function getZipEntryNames(buffer) {
  const entries = new Set();
  let offset = 0;

  while (offset <= buffer.length - 46) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      offset += 1;
      continue;
    }

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > buffer.length) break;

    entries.add(buffer.subarray(nameStart, nameEnd).toString("utf8"));
    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function readStoragePath(body) {
  return typeof body.storagePath === "string" ? body.storagePath.trim() : "";
}

function apiError(status, code, message) {
  return { status, body: { success: false, error: { code, message } } };
}

function stripJpegExif(buffer) {
  if (!isJpeg(buffer)) return buffer;
  try {
    let i = 2;
    const cleaned = [buffer.subarray(0, 2)];
    while (i < buffer.length - 1) {
      if (buffer[i] === 0xFF) {
        const marker = buffer[i + 1];
        if (marker === 0xD9) {
          cleaned.push(buffer.subarray(i));
          break;
        }
        if (marker === 0xE1) {
          const length = buffer.readUInt16BE(i + 2);
          i += 2 + length;
          continue;
        }
        const length = buffer.readUInt16BE(i + 2);
        cleaned.push(buffer.subarray(i, i + 2 + length));
        i += 2 + length;
      } else {
        i++;
      }
    }
    return Buffer.concat(cleaned);
  } catch (err) {
    console.error("Failed to strip EXIF, returning original buffer:", err);
    return buffer;
  }
}
