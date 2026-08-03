import { appConfig } from "../config/app.js";
import * as adminController from "../controllers/admin.controller.js";
import * as aiController from "../controllers/ai.controller.js";
import * as authController from "../controllers/auth.controller.js";
import * as contactController from "../controllers/contact.controller.js";
import * as counsellorController from "../controllers/counsellor.controller.js";
import * as sessionController from "../controllers/session.controller.js";
import * as userController from "../controllers/user.controller.js";
import * as walletController from "../controllers/wallet.controller.js";
import * as uploadController from "../controllers/upload.controller.js";
import * as publicController from "../controllers/public.controller.js";
import * as notificationController from "../controllers/notification.controller.js";

const p = appConfig.apiPrefix;

export const routes = [
  route("GET", `${p}/health`, health),
  route("GET", `${p}/readiness`, readiness),
  route("GET", `${p}/config/public`, publicController.publicConfig),
  route("POST", `${p}/contact`, contactController.submitContact),
  route("POST", `${p}/upload`, uploadController.uploadFile, ["user", "counsellor", "admin"]),
  route("POST", `${p}/upload/refresh-url`, uploadController.refreshUploadUrl, ["user", "counsellor", "admin"]),
  route("DELETE", `${p}/upload`, uploadController.deleteUpload, ["user", "counsellor", "admin"]),

  // Notifications
  route("GET", `${p}/notifications`, notificationController.getNotifications, ["user", "counsellor", "admin"]),
  route("PUT", `${p}/notifications/:id/read`, notificationController.markAsRead, ["user", "counsellor", "admin"]),
  route("POST", `${p}/notifications/send`, notificationController.sendNotification, ["admin"]),

  route("POST", `${p}/auth/register`, authController.register),
  route("POST", `${p}/auth/login`, authController.login),
  route("POST", `${p}/auth/send-otp`, authController.sendOtp),
  route("POST", `${p}/auth/verify-otp`, authController.verifyOtp),
  route("POST", `${p}/auth/counsellor/register`, authController.registerCounsellor),
  route("POST", `${p}/auth/refresh`, authController.refresh),
  route("POST", `${p}/auth/logout`, authController.logout),

  route("GET", `${p}/user/me`, userController.getMe, ["user", "admin"]),
  route("PUT", `${p}/user/me`, userController.updateMe, ["user", "admin"]),
  route("POST", `${p}/user/mood/log`, userController.logMood, ["user"]),
  route("GET", `${p}/user/mood/history`, userController.getMoodHistory, ["user", "admin"]),

  route("GET", `${p}/counsellors`, counsellorController.listCounsellors),
  route("GET", `${p}/counsellors/map`, counsellorController.mapListings),
  route("GET", `${p}/counsellors/me/slots`, counsellorController.getMySlots, ["counsellor", "admin"]),
  route("PUT", `${p}/counsellors/me/slots`, counsellorController.saveMySlots, ["counsellor", "admin"]),
  route("GET", `${p}/counsellors/:id`, counsellorController.getCounsellor),
  route("GET", `${p}/counsellors/:id/slots`, counsellorController.getSlots),
  route("PUT", `${p}/counsellors/me/status`, counsellorController.updateStatus, ["counsellor", "admin"]),

  route("POST", `${p}/sessions/book`, sessionController.bookSession, ["user"]),
  route("GET", `${p}/sessions/my`, sessionController.mySessions, ["user", "counsellor", "admin"]),
  route("PUT", `${p}/sessions/:id/accept`, sessionController.acceptSession, ["counsellor", "admin"]),
  route("PUT", `${p}/sessions/:id/decline`, sessionController.declineSession, ["counsellor", "admin"]),
  route("PUT", `${p}/sessions/:id/complete`, sessionController.completeSession, ["counsellor", "admin"]),
  route("PUT", `${p}/sessions/:id/cancel`, sessionController.cancelSession, ["user", "admin"]),
  route("GET", `${p}/sessions/:id/rtc-token`, sessionController.generateRtcToken, ["user", "counsellor", "admin"]),

  route("POST", `${p}/ai/chat`, aiController.chat, ["user"]),
  route("POST", `${p}/analysis/dream`, aiController.createDreamReport, ["user"]),
  route("POST", `${p}/analysis/handwriting`, aiController.createHandwritingReport, ["user"]),
  route("POST", `${p}/analysis/signature`, aiController.createSignatureReport, ["user"]),
  route("GET", `${p}/analysis/reports`, aiController.listReports, ["user", "admin"]),
  route("POST", `${p}/analysis/reports/:id/unlock`, aiController.unlockReport, ["user"]),

  route("GET", `${p}/wallet/balance`, walletController.balance, ["user", "counsellor", "admin"]),
  route("POST", `${p}/wallet/topup/initiate`, walletController.initiateTopup, ["user"]),
  route("POST", `${p}/wallet/topup/verify`, walletController.verifyTopup, ["user"]),
  route("GET", `${p}/wallet/transactions`, walletController.transactions, ["user", "counsellor", "admin"]),
  route("POST", `${p}/express/session/pay`, walletController.payExpressSession, ["user"]),
  route("POST", `${p}/payments/webhook`, walletController.paymentWebhook),

  route("GET", `${p}/admin/users`, adminController.users, ["admin"]),
  route("GET", `${p}/admin/counsellors`, adminController.counsellors, ["admin"]),
  route("PUT", `${p}/admin/counsellors/:id/verify`, adminController.verifyCounsellor, ["admin"]),
  route("GET", `${p}/admin/api-config`, adminController.apiConfig, ["admin"]),
  route("PUT", `${p}/admin/api-config/:service`, adminController.updateApiConfig, ["admin"]),
  route("GET", `${p}/admin/services`, adminController.services, ["admin"]),
  route("PUT", `${p}/admin/services/:id`, adminController.updateService, ["admin"]),
  route("GET", `${p}/admin/contacts`, adminController.contacts, ["admin"]),
  route("PUT", `${p}/admin/contacts/:id/status`, adminController.updateContactStatus, ["admin"]),
  route("GET", `${p}/admin/transactions`, adminController.transactions, ["admin"]),
  route("GET", `${p}/admin/analytics/summary`, adminController.analyticsSummary, ["admin"]),
  route("GET", `${p}/admin/crisis-events`, adminController.crisisEvents, ["admin"]),
  route("GET", `${p}/admin/audit-logs`, adminController.auditLogs, ["admin"])
];

async function health() {
  let dbStatus = "healthy";
  try {
    const { pool } = await import("../data/db.js");
    if (pool) {
      await pool.query("SELECT 1");
    }
  } catch (err) {
    dbStatus = "unhealthy";
  }

  return {
    body: {
      success: dbStatus === "healthy",
      data: {
        status: dbStatus === "healthy" ? "ok" : "degraded",
        service: "mindheal-api",
        database: dbStatus
      }
    }
  };
}

async function readiness() {
  let dbStatus = "healthy";
  let redisStatus = "healthy";

  try {
    const { pool } = await import("../data/db.js");
    if (pool) await pool.query("SELECT 1");
  } catch (e) {
    dbStatus = "unhealthy";
  }

  try {
    const { redisClient } = await import("../config/redis.js");
    if (redisClient?.isOpen) await redisClient.ping();
  } catch (e) {
    redisStatus = "degraded";
  }

  const isReady = dbStatus === "healthy";
  return {
    body: {
      success: isReady,
      data: {
        ready: isReady,
        service: "mindheal-api",
        database: dbStatus,
        redis: redisStatus
      }
    }
  };
}

function route(method, path, handler, roles = []) {
  return { method, path, pattern: pathToPattern(path), handler, roles };
}

function pathToPattern(path) {
  const pattern = path
    .replaceAll("/", "\\/")
    .replace(/:([A-Za-z0-9_]+)/g, "(?<$1>[^/]+)");
  return new RegExp(`^${pattern}$`);
}
