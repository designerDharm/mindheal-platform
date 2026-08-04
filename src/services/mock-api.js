import { appConfig, dashboardSeed } from "../data/mindheal-data.js";

function authHeaders() {
  try {
    const token = localStorage.getItem("mindheal-access-token");
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function getApiBaseUrl() {
  try {
    const defaultUrl = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? "http://localhost:4000/api/v1"
      : "https://mindheal-platform.onrender.com/api/v1";
    return localStorage.getItem("mindheal-api-base-url") || appConfig.apiBaseUrl || defaultUrl;
  } catch {
    return appConfig.apiBaseUrl || "http://localhost:4000/api/v1";
  }
}

async function request(path, options = {}) {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method || "GET",
      headers: { "content-type": "application/json", ...authHeaders(), ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const errMsg = typeof payload.error === "string" ? payload.error : (payload.error?.message || payload.message || "Request failed");
      return { ok: false, error: { message: errMsg } };
    }
    return { ok: true, data: payload.data, meta: payload.meta };
  } catch (error) {
    return { ok: false, error: { message: error.message || "Network request failed" } };
  }
}

async function uploadFile(file) {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${apiBaseUrl}/upload`, {
      method: "POST",
      headers: authHeaders(),
      body: formData
    });
    const payload = await response.json();
    if (!response.ok || payload.success === false) {
      return { ok: false, error: payload.error || { message: "Upload failed" } };
    }
    return { ok: true, data: payload.data };
  } catch (error) {
    return { ok: false, error };
  }
}

export const api = {
  async getState() {
    // Parallel network requests to gather all live data
    const [users, counsellorData, reports, wallet, walletTransactions, analytics, remoteCounsellors, myProfile, moodHistory, serviceCatalog, apiConfigurations, availabilitySlots, mySessions, contactLeads, crisisEvents] = await Promise.all([
      request("/admin/users").catch(() => ({ ok: false })),
      request("/admin/counsellors").catch(() => ({ ok: false })),
      request("/analysis/reports").catch(() => ({ ok: false })),
      request("/wallet/balance").catch(() => ({ ok: false })),
      request("/wallet/transactions").catch(() => ({ ok: false })),
      request("/admin/analytics/summary").catch(() => ({ ok: false })),
      request("/counsellors").catch(() => ({ ok: false })),
      request("/user/me").catch(() => ({ ok: false })),
      request("/user/mood/history").catch(() => ({ ok: false })),
      request("/admin/services").catch(() => ({ ok: false })),
      request("/admin/api-config").catch(() => ({ ok: false })),
      request("/counsellors/me/slots").catch(() => ({ ok: false })),
      request("/sessions/my").catch(() => ({ ok: false })),
      request("/admin/contacts").catch(() => ({ ok: false })),
      request("/admin/crisis-events").catch(() => ({ ok: false }))
    ]);

    const walletBalance = wallet.ok ? Math.round((wallet.data.balancePaise || 0) / 100) : 0;
    const backendReports = reports.ok ? reports.data : [];
    const backendMoodHistory = moodHistory.ok ? moodHistory.data : [];
    const sortedHistory = [...backendMoodHistory].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const latestMood = sortedHistory.at(-1);

    let auth = myProfile.ok ? myProfile.data : null;
    if (!auth) {
      localStorage.removeItem("mindheal-access-token");
    }

    return {
      auth: auth,
      backendStatus: myProfile.ok ? "online" : "offline",
      users: users.ok ? users.data : [],
      counsellors: remoteCounsellors.ok ? remoteCounsellors.data : [],
      counsellorApplications: counsellorData.ok ? counsellorData.data.applications : [],
      servicesCatalog: serviceCatalog.ok ? serviceCatalog.data : [],
      apiConfigurations: apiConfigurations.ok ? apiConfigurations.data : [],
      availabilitySlots: availabilitySlots.ok ? availabilitySlots.data : [],
      sessions: mySessions.ok ? mySessions.data : [],
      contactLeads: contactLeads.ok ? contactLeads.data : [],
      crisisEvents: crisisEvents.ok ? crisisEvents.data : [],
      walletTransactions: walletTransactions.ok ? walletTransactions.data : [],
      analysisSubmissions: backendReports,
      moodHistory: backendMoodHistory,
      dashboard: {
        user: {
          ...dashboardSeed.user,
          walletBalance,
          moodScore: latestMood ? Number(latestMood.score) : dashboardSeed.user.moodScore,
          reportsUnlocked: backendReports.filter((report) => report.isPdfUnlocked).length,
          reports: backendReports.length ? [] : dashboardSeed.user.reports
        },
        counsellor: dashboardSeed.counsellor,
        admin: {
          users: users.ok && Array.isArray(users.data) ? users.data.length : (analytics.ok ? analytics.data.users : 0),
          counsellors: remoteCounsellors.ok && Array.isArray(remoteCounsellors.data) ? remoteCounsellors.data.length : (analytics.ok ? analytics.data.counsellors : 0),
          revenueMonth: walletTransactions.ok && Array.isArray(walletTransactions.data)
            ? walletTransactions.data.reduce((sum, tx) => sum + (tx.amountInr || (tx.amountPaise ? tx.amountPaise / 100 : 0)), 0)
            : (analytics.ok ? analytics.data.revenueMonth || 0 : 0),
          aiMessages: analytics.ok ? analytics.data.aiMessages || 0 : 0,
          pendingVerifications: counsellorData.ok && counsellorData.data?.applications
            ? counsellorData.data.applications.filter(a => a.status === 'pending').length
            : (analytics.ok ? analytics.data.pendingApplications || 0 : 0),
          transactions: walletTransactions.ok ? walletTransactions.data : []
        }
      }
    };
  },

  async signUp(role, payload) {
    const remote = await request(role === "counsellor" ? "/auth/counsellor/register" : "/auth/register", {
      method: "POST",
      body: role === "counsellor" ? {
        fullName: payload.name || payload.fullName,
        email: payload.email,
        mobile: payload.mobile,
        password: payload.password,
        verificationProof: payload.verificationProof,
        licenseNumber: payload.license || payload.licenseNumber,
        specializations: payload.speciality || "Counselling",
        languagesSpoken: payload.languages || "English"
      } : {
        fullName: payload.name || payload.fullName,
        email: payload.email,
        mobile: payload.mobile,
        password: payload.password,
        verificationProof: payload.verificationProof,
        languageCode: payload.language || "en"
      }
    });

    if (remote.ok) {
      if (remote.data.session) {
        localStorage.setItem("mindheal-access-token", remote.data.session.accessToken);
        return remote.data.session.user;
      }
      if (remote.data.accessToken) {
        localStorage.setItem("mindheal-access-token", remote.data.accessToken);
      }
      return remote.data.user || remote.data;
    }
    throw new Error(remote.error?.message || "Sign up failed");
  },

  async login(role, payload) {
    const remote = await request("/auth/login", {
      method: "POST",
      body: { email: payload.email || undefined, mobile: payload.mobile || undefined, password: payload.password, role }
    });

    if (remote.ok) {
      if (remote.data.session) {
        localStorage.setItem("mindheal-access-token", remote.data.session.accessToken);
        return remote.data.session.user;
      }
      if (remote.data.accessToken) {
        localStorage.setItem("mindheal-access-token", remote.data.accessToken);
      }
      return remote.data.user || remote.data;
    }
    throw new Error(remote.error?.message || "Login failed");
  },

  async sendOtp(destination) {
    const isEmail = String(destination).includes("@");
    const remote = await request("/auth/send-otp", {
      method: "POST",
      body: isEmail ? { email: destination } : { mobile: destination }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Failed to send OTP");
  },

  async verifyOtp(challengeId, code, destination) {
    const isEmail = String(destination).includes("@");
    const remote = await request("/auth/verify-otp", {
      method: "POST",
      body: { challengeId, code, [isEmail ? "email" : "mobile"]: destination }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Invalid or expired OTP code.");
  },

  logout() {
    localStorage.removeItem("mindheal-access-token");
    return Promise.resolve(true);
  },

  async updateProfile(payload) {
    const remote = await request("/user/me", { method: "PUT", body: payload });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Profile update failed");
  },

  async submitContact(payload) {
    const remote = await request("/contact", { method: "POST", body: payload });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Submit failed");
  },

  async submitCounsellorApplication(payload) {
    return this.signUp("counsellor", payload);
  },

  async logMood(payload) {
    const remote = await request("/user/mood/log", { method: "POST", body: payload });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Mood log failed");
  },

  async submitAnalysis(payload) {
    const reportType = String(payload.type || "dream").toLowerCase();
    const endpoint = reportType.includes("hand") ? "/analysis/handwriting" : reportType.includes("sign") ? "/analysis/signature" : "/analysis/dream";
    const sampleFile = typeof File !== "undefined" && payload.sampleFile instanceof File && payload.sampleFile.name ? payload.sampleFile : null;
    let inputMediaUrl = payload.inputMediaUrl;

    if (sampleFile) {
      const upload = await uploadFile(sampleFile);
      if (!upload.ok) throw new Error(upload.error?.message || "Sample upload failed");
      inputMediaUrl = upload.data.url;
    }

    const remote = await request(endpoint, {
      method: "POST",
      body: { inputText: payload.description || payload.inputText, inputMediaUrl }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Analysis request failed");
  },

  async unlockReport(id) {
    const remote = await request(`/analysis/reports/${id}/unlock`, { method: "POST" });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Report unlock failed");
  },

  async sendAiMessage(payload) {
    const remote = await request("/ai/chat", {
      method: "POST",
      body: {
        message: payload.message,
        languageCode: payload.languageCode || "en"
      }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "AI chat failed");
  },

  async bookSession(payload) {
    const counsellorId = payload.counsellorId?.startsWith("cns_") ? payload.counsellorId : "cns_priya";
    const remote = await request("/sessions/book", {
      method: "POST",
      body: {
        counsellorId,
        sessionType: payload.sessionType || "video",
        serviceType: payload.serviceType || "counselling",
        scheduledAt: payload.scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: Number(payload.durationMinutes || 60),
        amountInr: Number(payload.amount || payload.amountInr || 900)
      }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Booking failed");
  },

  async getSessions() {
    const remote = await request("/sessions/my");
    if (remote.ok) return remote.data;
    return [];
  },

  async acceptSession(id) {
    const remote = await request(`/sessions/${id}/accept`, { method: "PUT" });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Accept session failed");
  },

  async declineSession(id, reason = "Not available") {
    const remote = await request(`/sessions/${id}/decline`, {
      method: "PUT",
      body: { reason }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Decline session failed");
  },

  async cancelSession(id) {
    const remote = await request(`/sessions/${id}/cancel`, { method: "PUT" });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Cancel session failed");
  },

  async topUpWallet(payload) {
    const amountInr = Number(payload.amountInr || payload.amount || 0);
    const order = await request("/wallet/topup/initiate", {
      method: "POST",
      body: { amountInr }
    });
    if (!order.ok) throw new Error(order.error?.message || "Top up initiation failed");

    const verification = await request("/wallet/topup/verify", {
      method: "POST",
      body: {
        orderId: order.data.id,
        razorpay_order_id: order.data.gatewayOrderId,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: "mock_signature",
        amountInr
      }
    });
    if (verification.ok) return { order: order.data, verification: verification.data };
    throw new Error(verification.error?.message || "Top up verification failed");
  },

  async updateApplicationStatus(id, status) {
    const action = status === "approved" || status === "approve" ? "approve" : status === "rejected" || status === "reject" ? "reject" : status;
    const remote = await request(`/admin/counsellors/${id}/verify`, {
      method: "PUT",
      body: { action }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Update failed");
  },

  async getServices() {
    const remote = await request("/admin/services");
    if (remote.ok) return remote.data;
    return [];
  },

  async updateService(id, payload) {
    const remote = await request(`/admin/services/${id}`, {
      method: "PUT",
      body: payload
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Service update failed");
  },

  async updateApiConfig(serviceName, payload) {
    const body = {
      provider: String(payload.provider || "gemini").toLowerCase(),
      modelName: payload.modelName || "",
      systemPrompt: payload.systemPrompt || "",
      isActive: payload.isActive === true || payload.isActive === "on" || payload.isActive === "true"
    };
    const apiKey = String(payload.apiKeyEncrypted || payload.apiKey || "").trim();
    if (apiKey && !apiKey.includes("*")) {
      body.apiKeyEncrypted = apiKey;
    }

    const remote = await request(`/admin/api-config/${encodeURIComponent(serviceName)}`, {
      method: "PUT",
      body
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "API configuration update failed");
  },

  async updateContactStatus(id, status) {
    const remote = await request(`/admin/contacts/${id}/status`, {
      method: "PUT",
      body: { status }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Contact update failed");
  },

  async saveAvailability(payload) {
    const remote = await request("/counsellors/me/slots", {
      method: "PUT",
      body: payload
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Availability update failed");
  },

  async getConfig() {
    const remote = await request("/config/public");
    if (remote.ok) return remote.data;
    return {};
  },

  async getMapListings() {
    const remote = await request("/counsellors/map");
    if (remote.ok) return remote.data;
    return [];
  },

  async getAuditLogs() {
    const remote = await request("/admin/audit-logs");
    if (remote.ok) return remote.data;
    return [];
  },

  async getCrisisEvents() {
    const remote = await request("/admin/crisis-events");
    if (remote.ok) return remote.data;
    return [];
  },

  async getNotifications() {
    const remote = await request("/notifications");
    if (remote.ok) return remote.data;
    return [];
  },

  async sendNotification(payload) {
    const remote = await request("/notifications/send", {
      method: "POST",
      body: payload
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Failed to send notification");
  },

  async markNotificationRead(id) {
    const remote = await request(`/notifications/${id}/read`, { method: "PUT" });
    if (remote.ok) return remote.data;
    return null;
  },

  initSocket(onNotification, onMessage) {
    if (!window.io) return null;
    const token = localStorage.getItem("mindheal-access-token");
    if (!token) return null;

    const apiBaseUrl = getApiBaseUrl().replace("/api/v1", "");
    const socket = window.io(apiBaseUrl, { auth: { token } });

    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("notification", (notif) => {
      if (onNotification) onNotification(notif);
    });

    socket.on("receive_message", (msg) => {
      if (onMessage) onMessage(msg);
    });

    return socket;
  },

  async payExpressSession(amountInr, plan) {
    const remote = await request("/express/session/pay", {
      method: "POST",
      body: { amountInr, plan }
    });
    if (remote.ok) return remote.data;
    throw new Error(remote.error?.message || "Payment failed");
  }
};
