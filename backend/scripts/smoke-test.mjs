import { Readable } from "node:stream";
import { createApp } from "../src/app.js";

const app = createApp();

async function request(method, path, { body, token, headers = {}, rawBody } = {}) {
  const reqBody = rawBody !== undefined ? rawBody : body ? Buffer.from(JSON.stringify(body)) : null;
  const req = Readable.from(reqBody ? [reqBody] : []);
  req.method = method;
  req.url = path;
  req.headers = {
    ...(rawBody === undefined ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...headers
  };
  req.socket = { remoteAddress: "127.0.0.1" };

  const res = {
    statusCode: 0,
    headers: {},
    payload: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
    },
    end(payload = "") {
      this.payload = payload;
    }
  };

  await app.handle(req, res);

  return {
    status: res.statusCode,
    body: res.payload ? JSON.parse(res.payload) : null
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const health = await request("GET", "/api/v1/health");
assert(health.status === 200 && health.body.data.status === "ok", "Health check failed.");

const blockedAdmin = await request("GET", "/api/v1/admin/users");
assert(blockedAdmin.status === 401, "Admin route should require authentication.");

const mapListings = await request("GET", "/api/v1/counsellors/map");
assert(
  mapListings.status === 200 && Array.isArray(mapListings.body.data) && mapListings.body.data.length >= 1,
  "Counsellor map route failed."
);

const adminLogin = await request("POST", "/api/v1/auth/login", {
  body: { email: "admin@example.com", password: "Password123!", role: "admin" }
});
assert(adminLogin.status === 200 && adminLogin.body.data.accessToken, "Admin login failed.");

const adminUsers = await request("GET", "/api/v1/admin/users", {
  token: adminLogin.body.data.accessToken
});
assert(adminUsers.status === 200, "Admin users route failed.");
assert(!JSON.stringify(adminUsers.body).includes("passwordHash"), "Admin users response leaked password hashes.");

const updatedMapsConfig = await request("PUT", "/api/v1/admin/api-config/Google%20Maps", {
  token: adminLogin.body.data.accessToken,
  body: {
    provider: "Google",
    apiKeyEncrypted: "maps_smoke_key",
    isEnabled: true
  }
});
assert(
  updatedMapsConfig.status === 200 &&
    updatedMapsConfig.body.data.serviceName === "Google Maps" &&
    updatedMapsConfig.body.data.isActive === true &&
    updatedMapsConfig.body.data.apiKeyEncrypted === "maps••••_key",
  "Google Maps config update failed."
);

const adminApiConfig = await request("GET", "/api/v1/admin/api-config", {
  token: adminLogin.body.data.accessToken
});
assert(adminApiConfig.status === 200 && !JSON.stringify(adminApiConfig.body).includes('"maps_smoke_key"'), "Admin API config leaked raw secret.");

const adminServices = await request("GET", "/api/v1/admin/services", {
  token: adminLogin.body.data.accessToken
});
assert(adminServices.status === 200 && adminServices.body.data.some((item) => item.id === "svc_dream"), "Admin services route failed.");

const updatedService = await request("PUT", "/api/v1/admin/services/svc_dream", {
  token: adminLogin.body.data.accessToken,
  body: {
    isActive: false,
    isFree: false,
    priceInr: 59,
    category: "Analysis Reports"
  }
});
assert(
  updatedService.status === 200 &&
    updatedService.body.data.id === "svc_dream" &&
    updatedService.body.data.isActive === false &&
    (updatedService.body.data.priceInr === 59 || updatedService.body.data.pricePaise === 5900),
  "Admin service update route failed."
);

const publicConfig = await request("GET", "/api/v1/config/public");
assert(publicConfig.status === 200 && publicConfig.body.data.mapsApiKey === "maps_smoke_key", "Public config route failed to resolve Google Maps config.");

const contactLead = await request("POST", "/api/v1/contact", {
  body: {
    name: "Smoke Contact",
    email: "contact-smoke@example.com",
    phone: "+919999990000",
    message: "I would like to learn more about MindHeal."
  }
});
assert(contactLead.status === 201 && contactLead.body.data.id, "Contact lead submission failed.");

const adminContacts = await request("GET", "/api/v1/admin/contacts", {
  token: adminLogin.body.data.accessToken
});
assert(
  adminContacts.status === 200 && adminContacts.body.data.some((item) => item.id === contactLead.body.data.id),
  "Admin contacts list route failed."
);

const handledContact = await request("PUT", `/api/v1/admin/contacts/${contactLead.body.data.id}/status`, {
  token: adminLogin.body.data.accessToken,
  body: { status: "handled" }
});
assert(handledContact.status === 200 && handledContact.body.data.status === "handled", "Admin contact status update failed.");

const updatedChatConfig = await request("PUT", "/api/v1/admin/api-config/AI%20Counselling%20Chat", {
  token: adminLogin.body.data.accessToken,
  body: {
    provider: "openai",
    modelName: "mock-chat-model",
    apiKeyEncrypted: "chat_smoke_key",
    isActive: true
  }
});
assert(
  updatedChatConfig.status === 200
    && updatedChatConfig.body.data.serviceName === "AI Counselling Chat"
    && updatedChatConfig.body.data.provider === "openai"
    && updatedChatConfig.body.data.apiKeyEncrypted !== "chat_smoke_key",
  "AI chat config update should normalize provider and mask stored keys."
);

const adminApiConfigs = await request("GET", "/api/v1/admin/api-config", {
  token: adminLogin.body.data.accessToken
});
assert(
  adminApiConfigs.status === 200
    && adminApiConfigs.body.data.some((config) => config.serviceName === "AI Counselling Chat" && config.modelName === "mock-chat-model"),
  "Admin API config list route failed."
);

const counsellorSignup = await request("POST", "/api/v1/auth/counsellor/register", {
  body: {
    fullName: "Smoke Test Counsellor",
    email: "smoke-counsellor@example.com",
    password: "Password123!",
    licenseNumber: "SMOKE-123",
    specializations: "CBT"
  }
});
assert(counsellorSignup.status === 201 && counsellorSignup.body.data.application.id, "Counsellor signup failed.");

const verification = await request("PUT", `/api/v1/admin/counsellors/${counsellorSignup.body.data.application.id}/verify`, {
  token: adminLogin.body.data.accessToken,
  body: { action: "approve" }
});
assert(verification.status === 200 && verification.body.data.status === "approved", "Counsellor verification route failed.");

const userLogin = await request("POST", "/api/v1/auth/login", {
  body: { email: "user@example.com", password: "Password123!", role: "user" }
});
assert(userLogin.status === 200 && userLogin.body.data.accessToken, "User login failed.");
const userId = userLogin.body.data.user.id;

const forbiddenAdmin = await request("GET", "/api/v1/admin/users", {
  token: userLogin.body.data.accessToken
});
assert(forbiddenAdmin.status === 403, "User token should not access admin route.");

const wallet = await request("GET", "/api/v1/wallet/balance", {
  token: userLogin.body.data.accessToken
});
assert(wallet.status === 200 && Number.isInteger(wallet.body.data.balancePaise), "Wallet balance route failed.");

const topupOrder = await request("POST", "/api/v1/wallet/topup/initiate", {
  token: userLogin.body.data.accessToken,
  body: { amountInr: 500 }
});
assert(topupOrder.status === 201 && topupOrder.body.data.gatewayOrderId, "Wallet top-up initiation failed.");

const topupVerification = await request("POST", "/api/v1/wallet/topup/verify", {
  token: userLogin.body.data.accessToken,
  body: {
    orderId: topupOrder.body.data.id,
    razorpay_order_id: topupOrder.body.data.gatewayOrderId,
    razorpay_payment_id: "pay_smoke",
    razorpay_signature: "mock_signature",
    amountInr: 99999
  }
});
assert(topupVerification.status === 200 && topupVerification.body.data.verified === true, "Wallet top-up verification failed.");

const walletAfterTopup = await request("GET", "/api/v1/wallet/balance", {
  token: userLogin.body.data.accessToken
});
assert(walletAfterTopup.body.data.balancePaise === wallet.body.data.balancePaise + 50000, "Wallet top-up did not credit balance.");

const duplicateTopupVerification = await request("POST", "/api/v1/wallet/topup/verify", {
  token: userLogin.body.data.accessToken,
  body: {
    orderId: topupOrder.body.data.id,
    razorpay_order_id: topupOrder.body.data.gatewayOrderId,
    razorpay_payment_id: "pay_smoke_duplicate",
    razorpay_signature: "mock_signature",
    amountInr: 500
  }
});
assert(duplicateTopupVerification.status === 200 && duplicateTopupVerification.body.data.ledgerEntry === null, "Duplicate top-up verification should be idempotent.");

const walletAfterDuplicateTopup = await request("GET", "/api/v1/wallet/balance", {
  token: userLogin.body.data.accessToken
});
assert(walletAfterDuplicateTopup.body.data.balancePaise === walletAfterTopup.body.data.balancePaise, "Duplicate top-up verification should not credit twice.");

const webhookOrder = await request("POST", "/api/v1/wallet/topup/initiate", {
  token: userLogin.body.data.accessToken,
  body: { amountInr: 250 }
});
assert(webhookOrder.status === 201 && webhookOrder.body.data.gatewayOrderId, "Webhook top-up order initiation failed.");

const webhookPayload = {
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_webhook_smoke",
        order_id: webhookOrder.body.data.gatewayOrderId,
        amount: webhookOrder.body.data.amountPaise
      }
    }
  }
};
const webhookPayment = await request("POST", "/api/v1/payments/webhook", {
  body: webhookPayload,
  headers: { "x-razorpay-signature": "mock_webhook_signature" }
});
assert(webhookPayment.status === 200 && webhookPayment.body.data.settled === true && webhookPayment.body.data.ledgerEntry, "Payment webhook should settle matching top-up order.");

const walletAfterWebhook = await request("GET", "/api/v1/wallet/balance", {
  token: userLogin.body.data.accessToken
});
assert(walletAfterWebhook.body.data.balancePaise === walletAfterDuplicateTopup.body.data.balancePaise + 25000, "Payment webhook did not credit wallet.");

const duplicateWebhookPayment = await request("POST", "/api/v1/payments/webhook", {
  body: webhookPayload,
  headers: { "x-razorpay-signature": "mock_webhook_signature" }
});
assert(duplicateWebhookPayment.status === 200 && duplicateWebhookPayment.body.data.ledgerEntry === null, "Duplicate payment webhook should not credit twice.");

const walletAfterDuplicateWebhook = await request("GET", "/api/v1/wallet/balance", {
  token: userLogin.body.data.accessToken
});
assert(walletAfterDuplicateWebhook.body.data.balancePaise === walletAfterWebhook.body.data.balancePaise, "Duplicate payment webhook changed wallet balance.");

const badAmountWebhook = await request("POST", "/api/v1/payments/webhook", {
  body: {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_webhook_bad_amount",
          order_id: webhookOrder.body.data.gatewayOrderId,
          amount: webhookOrder.body.data.amountPaise + 100
        }
      }
    }
  },
  headers: { "x-razorpay-signature": "mock_webhook_signature" }
});
assert(badAmountWebhook.status === 400, "Payment webhook should reject amount mismatches.");

const moodLog = await request("POST", "/api/v1/user/mood/log", {
  token: userLogin.body.data.accessToken,
  body: { score: 8, note: "Slept better after journaling." }
});
assert(moodLog.status === 201 && moodLog.body.data.score === 8, "Mood log route failed.");

const moodHistory = await request("GET", "/api/v1/user/mood/history", {
  token: userLogin.body.data.accessToken
});
assert(moodHistory.status === 200 && moodHistory.body.data.some((item) => item.id === moodLog.body.data.id), "Mood history route failed.");

const uploadBoundary = "----mindheal-smoke-boundary";
const uploadBody = Buffer.from(
  [
    `--${uploadBoundary}`,
    `Content-Disposition: form-data; name="file"; filename="smoke.pdf"`,
    "Content-Type: application/pdf",
    "",
    "%PDF-1.4 smoke test",
    `--${uploadBoundary}--`,
    ""
  ].join("\r\n")
);
const upload = await request("POST", "/api/v1/upload", {
  token: userLogin.body.data.accessToken,
  rawBody: uploadBody,
  headers: {
    "content-type": `multipart/form-data; boundary=${uploadBoundary}`,
    "content-length": String(uploadBody.length)
  }
});
assert(upload.status === 200 && upload.body.data.url && upload.body.data.filename === "smoke.pdf", "Upload route failed.");

const handwriting = await request("POST", "/api/v1/analysis/handwriting", {
  token: userLogin.body.data.accessToken,
  body: {
    inputText: "A short handwritten note sample for stress indicators.",
    inputMediaUrl: upload.body.data.url
  }
});
assert(
  handwriting.status === 201 && handwriting.body.data.reportType === "handwriting" && handwriting.body.data.inputMediaUrl === upload.body.data.url,
  "Media-backed handwriting analysis should preserve uploaded sample URL."
);

const aiChat = await request("POST", "/api/v1/ai/chat", {
  token: userLogin.body.data.accessToken,
  body: { message: "I feel worried before sleep.", languageCode: "en" }
});
assert(aiChat.status === 200 && aiChat.body.data.response && aiChat.body.data.safety.riskLevel === "low", "AI chat route failed.");

const dream = await request("POST", "/api/v1/analysis/dream", {
  token: userLogin.body.data.accessToken,
  body: { inputText: "I walked through a quiet garden and found a locked door." }
});
assert(dream.status === 201 && dream.body.data.reportType === "dream", "Dream analysis route failed.");

const walletBeforeUnlock = await request("GET", "/api/v1/wallet/balance", {
  token: userLogin.body.data.accessToken
});
assert(walletBeforeUnlock.status === 200, "Wallet balance before report unlock failed.");

const unlockedReport = await request("POST", `/api/v1/analysis/reports/${dream.body.data.id}/unlock`, {
  token: userLogin.body.data.accessToken
});
assert(
  unlockedReport.status === 200 && unlockedReport.body.data.isPdfUnlocked === true && unlockedReport.body.data.pdfUrl,
  "Report unlock route failed."
);

const walletAfterUnlock = await request("GET", "/api/v1/wallet/balance", {
  token: userLogin.body.data.accessToken
});
assert(
  walletAfterUnlock.status === 200 && walletAfterUnlock.body.data.balancePaise === walletBeforeUnlock.body.data.balancePaise - 4900,
  "Report unlock did not debit wallet correctly."
);

const unlockedAgain = await request("POST", `/api/v1/analysis/reports/${dream.body.data.id}/unlock`, {
  token: userLogin.body.data.accessToken
});
assert(unlockedAgain.status === 200 && unlockedAgain.body.data.isPdfUnlocked === true, "Unlocked report should be reusable.");

const walletAfterSecondUnlock = await request("GET", "/api/v1/wallet/balance", {
  token: userLogin.body.data.accessToken
});
assert(walletAfterSecondUnlock.body.data.balancePaise === walletAfterUnlock.body.data.balancePaise, "Unlocked report should not debit wallet twice.");

const walletTransactions = await request("GET", "/api/v1/wallet/transactions", {
  token: userLogin.body.data.accessToken
});
assert(
  walletTransactions.status === 200
    && walletTransactions.body.data.some((entry) => entry.direction === "credit" && entry.entryType === "wallet_topup")
    && walletTransactions.body.data.some((entry) => entry.direction === "debit" && entry.entryType === "pdf_unlock" && entry.referenceId === dream.body.data.id),
  "Wallet transaction history should include top-up credits and report unlock debits."
);

const booking = await request("POST", "/api/v1/sessions/book", {
  token: userLogin.body.data.accessToken,
  body: {
    counsellorId: "cns_priya",
    sessionType: "video",
    scheduledAt: (() => { const d = new Date(Date.now() + 24 * 60 * 60 * 1000); d.setUTCHours(11, 0, 0, 0); return d.toISOString(); })(),
    durationMinutes: 60,
    amountInr: 900
  }
});
assert(booking.status === 201 && booking.body.data.counsellorUserId === "usr_counsellor_priya", "Session booking route failed.");

const userRtcToken = await request("GET", `/api/v1/sessions/${booking.body.data.id}/rtc-token`, {
  token: userLogin.body.data.accessToken
});
assert(userRtcToken.status === 200 && userRtcToken.body.data.token && userRtcToken.body.data.channelName === booking.body.data.id, "User RTC token route failed.");

const forbiddenAccept = await request("PUT", `/api/v1/sessions/${booking.body.data.id}/accept`, {
  token: userLogin.body.data.accessToken
});
assert(forbiddenAccept.status === 403, "User should not accept a counsellor session request.");

const counsellorLogin = await request("POST", "/api/v1/auth/login", {
  body: { email: "priya.counsellor@example.com", password: "Password123!", role: "counsellor" }
});
assert(counsellorLogin.status === 200 && counsellorLogin.body.data.accessToken, "Counsellor login failed.");

const counsellorStatus = await request("PUT", "/api/v1/counsellors/me/status", {
  token: counsellorLogin.body.data.accessToken,
  body: { status: "Busy" }
});
assert(counsellorStatus.status === 200 && counsellorStatus.body.data.id === "cns_priya" && counsellorStatus.body.data.status === "Busy", "Counsellor status update route failed.");

const savedSlots = await request("PUT", "/api/v1/counsellors/me/slots", {
  token: counsellorLogin.body.data.accessToken,
  body: {
    slots: [
      { date: "2026-06-07", startTime: "10:00", endTime: "11:00", sessionType: "video" },
      { date: "2026-06-08", startTime: "12:00", endTime: "13:00", sessionType: "audio" }
    ]
  }
});
console.log("DEBUG: savedSlots status =", savedSlots.status, "body =", JSON.stringify(savedSlots.body));
assert(savedSlots.status === 200 && savedSlots.body.data.length >= 2, "Counsellor availability save route failed.");

const publicSlots = await request("GET", "/api/v1/counsellors/cns_priya/slots");
assert(
  publicSlots.status === 200 &&
    publicSlots.body.data.some((slot) => slot.date === "2026-06-07" && slot.startTime === "10:00") &&
    publicSlots.body.data.some((slot) => slot.sessionType === "audio"),
  "Public counsellor slots route failed."
);

const counsellorSessions = await request("GET", "/api/v1/sessions/my", {
  token: counsellorLogin.body.data.accessToken
});
assert(counsellorSessions.status === 200 && counsellorSessions.body.data.some((item) => item.id === booking.body.data.id), "Counsellor session list failed.");

const counsellorRtcToken = await request("GET", `/api/v1/sessions/${booking.body.data.id}/rtc-token`, {
  token: counsellorLogin.body.data.accessToken
});
assert(counsellorRtcToken.status === 200 && counsellorRtcToken.body.data.uid === "usr_counsellor_priya", "Counsellor RTC token route failed.");

const acceptedSession = await request("PUT", `/api/v1/sessions/${booking.body.data.id}/accept`, {
  token: counsellorLogin.body.data.accessToken
});
assert(acceptedSession.status === 200 && acceptedSession.body.data.status === "confirmed", "Counsellor session accept route failed.");

const counsellorSessionsAfterAccept = await request("GET", "/api/v1/sessions/my", {
  token: counsellorLogin.body.data.accessToken
});
assert(
  counsellorSessionsAfterAccept.status === 200 &&
    counsellorSessionsAfterAccept.body.data.some((item) => item.id === booking.body.data.id && item.status === "confirmed"),
  "Counsellor session list did not reflect accepted session."
);

const cancelledSession = await request("PUT", `/api/v1/sessions/${booking.body.data.id}/cancel`, {
  token: userLogin.body.data.accessToken
});
assert(cancelledSession.status === 200 && cancelledSession.body.data.status === "cancelled", "User session cancel route failed.");

const notification = await request("POST", "/api/v1/notifications/send", {
  token: adminLogin.body.data.accessToken,
  body: {
    userId,
    role: "user",
    title: "Smoke test notification",
    message: "Notification route is connected.",
    type: "info"
  }
});
assert(notification.status === 200 && notification.body.data.id, "Admin notification send route failed.");

const notifications = await request("GET", "/api/v1/notifications", {
  token: userLogin.body.data.accessToken
});
assert(notifications.status === 200 && notifications.body.data.length === 1, "User notifications route failed.");

const readNotification = await request("PUT", `/api/v1/notifications/${notification.body.data.id}/read`, {
  token: userLogin.body.data.accessToken
});
assert(readNotification.status === 200 && readNotification.body.data.read === true, "Notification read route failed.");

const auditLogs = await request("GET", "/api/v1/admin/audit-logs", {
  token: adminLogin.body.data.accessToken
});
assert(auditLogs.status === 200 && auditLogs.body.data.length >= 1, "Admin audit logs route failed.");

console.log("MindHeal backend smoke tests passed.");
