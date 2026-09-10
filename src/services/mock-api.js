import { appConfig, dashboardSeed } from "../data/mindheal-data.js";
import { openRazorpayCheckout } from "../utils/checkout.js";

export function getAccessToken() {
  try {
    return sessionStorage.getItem("mindheal-access-token") || localStorage.getItem("mindheal-access-token") || null;
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  try {
    return sessionStorage.getItem("mindheal-refresh-token") || localStorage.getItem("mindheal-refresh-token") || null;
  } catch {
    return null;
  }
}

export function isSessionPersistent() {
  try {
    if (sessionStorage.getItem("mindheal-access-token")) return false;
    if (localStorage.getItem("mindheal-access-token")) return true;
    return localStorage.getItem("mindheal-auth-storage") === "local";
  } catch {
    return false;
  }
}

export function getCachedAuthUser() {
  try {
    const raw = sessionStorage.getItem("mindheal-auth-user") || localStorage.getItem("mindheal-auth-user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCachedAuthUser(user, persistent = null) {
  try {
    if (!user) return;
    const isPersist = persistent !== null ? persistent : isSessionPersistent();
    const targetStorage = isPersist ? localStorage : sessionStorage;
    targetStorage.setItem("mindheal-auth-user", JSON.stringify(user));
  } catch (err) {
    console.error("[Auth] Failed to cache auth user:", err);
  }
}

export function saveAuthSession(sessionData, persistent = false) {
  try {
    const accessToken = sessionData?.accessToken || sessionData?.session?.accessToken;
    const refreshToken = sessionData?.refreshToken || sessionData?.session?.refreshToken;
    const user = sessionData?.user || sessionData?.session?.user;

    const targetStorage = persistent ? localStorage : sessionStorage;
    const otherStorage = persistent ? sessionStorage : localStorage;

    otherStorage.removeItem("mindheal-access-token");
    otherStorage.removeItem("mindheal-refresh-token");
    otherStorage.removeItem("mindheal-auth-user");

    if (accessToken) targetStorage.setItem("mindheal-access-token", accessToken);
    if (refreshToken) targetStorage.setItem("mindheal-refresh-token", refreshToken);
    if (user) targetStorage.setItem("mindheal-auth-user", JSON.stringify(user));

    if (persistent) {
      localStorage.setItem("mindheal-auth-storage", "local");
    } else {
      localStorage.removeItem("mindheal-auth-storage");
    }
  } catch (err) {
    console.error("[Auth] Failed to save auth session:", err);
  }
}

export const SENSITIVE_STORAGE_KEYS = [
  "cbt-daily-diary",
  "cbt-thought-diary",
  "cbt-exposure-hierarchy",
  "cbt-behavioral-activation",
  "cbt-worry-time",
  "mindheal-ai-chat",
  "mindheal-thought-mirror-sessions",
  "mindheal-unsent-letters",
  "mindheal-grounding-sessions"
];

export function clearPrivateUserData(userId = null) {
  try {
    const storages = [];
    try { if (typeof sessionStorage !== "undefined" && sessionStorage) storages.push(sessionStorage); } catch {}
    try { if (typeof localStorage !== "undefined" && localStorage) storages.push(localStorage); } catch {}

    for (const storage of storages) {
      for (const base of SENSITIVE_STORAGE_KEYS) {
        storage.removeItem(base);
        storage.removeItem(`${base}:guest`);
        storage.removeItem(`${base}_guest`);
      }

      const keysToRemove = [];
      const len = typeof storage.length === "number" ? storage.length : 0;
      for (let i = 0; i < len; i++) {
        const k = typeof storage.key === "function" ? storage.key(i) : null;
        if (!k) continue;

        const isSensitive = SENSITIVE_STORAGE_KEYS.some(
          (base) => k === base || k.startsWith(`${base}:`) || k.startsWith(`${base}_`)
        );
        const isUserScoped = k.startsWith("usr_") || k.includes(":usr_") || k.startsWith("mindheal-user-");

        if (isSensitive || isUserScoped) {
          if (!userId || k.includes(userId)) {
            keysToRemove.push(k);
          }
        }
      }

      for (const k of keysToRemove) {
        storage.removeItem(k);
      }
    }
  } catch (err) {
    console.error("[Auth] Failed to clear private user data:", err);
  }
}

export function clearAuthSession() {
  try {
    sessionStorage.removeItem("mindheal-access-token");
    sessionStorage.removeItem("mindheal-refresh-token");
    sessionStorage.removeItem("mindheal-auth-user");
    localStorage.removeItem("mindheal-access-token");
    localStorage.removeItem("mindheal-refresh-token");
    localStorage.removeItem("mindheal-auth-storage");
    localStorage.removeItem("mindheal-auth-user");
  } catch (err) {
    console.error("[Auth] Failed to clear auth session:", err);
  }
  clearPrivateUserData();
}

function authHeaders() {
  try {
    const token = getAccessToken();
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

let activeRefreshPromise = null;

export async function refreshAuthSession() {
  if (activeRefreshPromise) return activeRefreshPromise;

  activeRefreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const apiBaseUrl = getApiBaseUrl();
      let signal;
      let timeoutId = null;
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        signal = AbortSignal.timeout(8000);
      } else if (typeof AbortController !== "undefined") {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(new Error("Refresh timeout")), 8000);
        signal = controller.signal;
      }

      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        signal
      }).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.success && payload.data) {
        const persistent = isSessionPersistent();
        saveAuthSession(payload.data, persistent);
        return payload.data;
      } else {
        // Only clear session if server explicitly rejected credentials with 401/403 or explicit expired/invalid token
        if (response.status === 401 || response.status === 403 || payload.error?.code === "TOKEN_EXPIRED" || payload.error?.code === "INVALID_TOKEN") {
          clearAuthSession();
        }
        return null;
      }
    } catch {
      // Network failure, timeout, or 503 connection drop: PRESERVE session
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function request(path, options = {}) {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const timeoutMs = options.timeoutMs || 8000;
    let signal = options.signal;
    let timeoutId = null;

    if (!signal) {
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        signal = AbortSignal.timeout(timeoutMs);
      } else if (typeof AbortController !== "undefined") {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(new Error("Request deadline exceeded")), timeoutMs);
        signal = controller.signal;
      }
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method || "GET",
      credentials: "include",
      headers: { "content-type": "application/json", ...authHeaders(), ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal
    }).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh") && !path.startsWith("/auth/logout") && !options._retry) {
      const refreshed = await refreshAuthSession();
      if (refreshed) {
        return request(path, { ...options, _retry: true });
      }
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const errMsg = typeof payload.error === "string" ? payload.error : (payload.error?.message || payload.message || "Request failed");
      return {
        ok: false,
        status: response.status,
        isServerError: response.status >= 500,
        isNetworkError: false,
        isTimeout: false,
        error: { message: errMsg, code: payload.error?.code, status: response.status }
      };
    }
    return { ok: true, status: response.status, data: payload.data, meta: payload.meta };
  } catch (error) {
    const isTimeout = error.name === "TimeoutError" || error.name === "AbortError" || error.message?.includes("deadline") || error.message?.includes("timeout");
    return {
      ok: false,
      status: 0,
      isServerError: false,
      isNetworkError: true,
      isTimeout,
      error: { message: isTimeout ? "Request deadline exceeded" : (error.message || "Network request failed"), code: isTimeout ? "DEADLINE_EXCEEDED" : "NETWORK_ERROR", status: 0 }
    };
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
  async getAuthProfile() {
    const token = getAccessToken();
    if (!token) return null;
    const res = await request("/user/me").catch(() => ({ ok: false, isNetworkError: true, status: 0 }));
    if (res.ok && res.data) {
      saveCachedAuthUser(res.data);
      return res.data;
    }
    if (res.status === 401) {
      clearAuthSession();
      return null;
    }
    // Network error or 503 outage: preserve session and return cached user
    return getCachedAuthUser();
  },

  async getState(options = {}) {
    const path = options.path || (typeof window !== "undefined" && window.location ? (window.location.hash.replace(/^#/, "") || "/") : "/");
    const token = getAccessToken();
    const cachedUser = getCachedAuthUser();

    let auth = null;
    let backendStatus = "online";
    let isOutage = false;

    if (token) {
      const myProfile = await request("/user/me").catch(() => ({ ok: false, isNetworkError: true, status: 0 }));
      if (myProfile.ok && myProfile.data) {
        auth = myProfile.data;
        saveCachedAuthUser(auth);
        backendStatus = "online";
      } else if (myProfile.status === 401) {
        clearAuthSession();
        auth = null;
      } else if (myProfile.status >= 500 || myProfile.isNetworkError || myProfile.isTimeout) {
        isOutage = true;
        backendStatus = "outage";
        auth = cachedUser || { id: "cached-session", role: options.role || "user", offline: true };
      } else {
        auth = cachedUser;
      }
    } else {
      auth = null;
    }

    const currentRole = options.role || auth?.role || "guest";
    const isAdminPanel = path.startsWith("/panel/admin") && currentRole === "admin";
    const isCounsellorPanel = path.startsWith("/panel/counsellor") && currentRole === "counsellor";
    const isUserPanel = path.startsWith("/panel/user") && currentRole === "user";
    const isCounsellorDir = path.includes("counsellor") || path === "/" || path === "";
    const isPeerTalk = path.includes("peer-talk");

    // Dynamic, role- & route-aware request map
    const fetchPromises = {};

    // Only fetch admin endpoints when on admin panel with admin role
    if (isAdminPanel && !isOutage) {
      fetchPromises.users = request("/admin/users").catch(() => ({ ok: false }));
      fetchPromises.counsellorData = request("/admin/counsellors").catch(() => ({ ok: false }));
      fetchPromises.analytics = request("/admin/analytics/summary").catch(() => ({ ok: false }));
      fetchPromises.serviceCatalog = request("/admin/services").catch(() => ({ ok: false }));
      fetchPromises.apiConfigurations = request("/admin/api-config").catch(() => ({ ok: false }));
      fetchPromises.contactLeads = request("/admin/contacts").catch(() => ({ ok: false }));
      fetchPromises.crisisEvents = request("/admin/crisis-events").catch(() => ({ ok: false }));
      fetchPromises.walletTransactions = request("/wallet/transactions").catch(() => ({ ok: false }));
    }

    // Only fetch counsellor panel endpoints when on counsellor panel with counsellor role
    if (isCounsellorPanel && !isOutage) {
      fetchPromises.availabilitySlots = request("/counsellors/me/slots").catch(() => ({ ok: false }));
      fetchPromises.mySessions = request("/sessions/my").catch(() => ({ ok: false }));
    }

    // Only fetch user panel endpoints when on user panel with user role
    if (isUserPanel && !isOutage) {
      fetchPromises.reports = request("/analysis/reports").catch(() => ({ ok: false }));
      fetchPromises.wallet = request("/wallet/balance").catch(() => ({ ok: false }));
      fetchPromises.walletTransactions = request("/wallet/transactions").catch(() => ({ ok: false }));
      fetchPromises.moodHistory = request("/user/mood/history").catch(() => ({ ok: false }));
      fetchPromises.mySessions = request("/sessions/my").catch(() => ({ ok: false }));
      fetchPromises.peerTalkDashboard = request("/peer-talk/dashboard").catch(() => ({ ok: false }));
    }

    // Public pages: only fetch public resources if route requires them
    if (isCounsellorDir && !isOutage) {
      fetchPromises.remoteCounsellors = request("/counsellors").catch(() => ({ ok: false }));
    }
    if (isPeerTalk && !isOutage) {
      fetchPromises.peerListeners = request("/peer-listeners").catch(() => ({ ok: false }));
    }

    // Resolve active promises concurrently
    const keys = Object.keys(fetchPromises);
    const results = await Promise.all(Object.values(fetchPromises));
    const resolved = {};
    keys.forEach((key, index) => {
      resolved[key] = results[index];
    });

    const wallet = resolved.wallet || { ok: false };
    const walletTransactions = resolved.walletTransactions || { ok: false };
    const reports = resolved.reports || { ok: false };
    const moodHistory = resolved.moodHistory || { ok: false };
    const users = resolved.users || { ok: false };
    const remoteCounsellors = resolved.remoteCounsellors || { ok: false };
    const counsellorData = resolved.counsellorData || { ok: false };
    const analytics = resolved.analytics || { ok: false };
    const serviceCatalog = resolved.serviceCatalog || { ok: false };
    const apiConfigurations = resolved.apiConfigurations || { ok: false };
    const availabilitySlots = resolved.availabilitySlots || { ok: false };
    const mySessions = resolved.mySessions || { ok: false };
    const contactLeads = resolved.contactLeads || { ok: false };
    const crisisEvents = resolved.crisisEvents || { ok: false };
    const peerTalkDashboard = resolved.peerTalkDashboard || { ok: false };
    const peerListeners = resolved.peerListeners || { ok: false };

    const walletBalance = wallet.ok ? Math.round((wallet.data?.balancePaise || 0) / 100) : 0;
    const backendReports = reports.ok && Array.isArray(reports.data) ? reports.data : [];
    const backendMoodHistory = moodHistory.ok && Array.isArray(moodHistory.data) ? moodHistory.data : [];
    const sortedHistory = [...backendMoodHistory].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const latestMood = sortedHistory.at(-1);

    return {
      auth: auth,
      backendStatus: backendStatus,
      users: users.ok && Array.isArray(users.data) ? users.data : [],
      counsellors: remoteCounsellors.ok && Array.isArray(remoteCounsellors.data) ? remoteCounsellors.data : [],
      counsellorApplications: counsellorData.ok && Array.isArray(counsellorData.data?.applications) ? counsellorData.data.applications : [],
      servicesCatalog: serviceCatalog.ok && Array.isArray(serviceCatalog.data) ? serviceCatalog.data : [],
      apiConfigurations: apiConfigurations.ok && Array.isArray(apiConfigurations.data) ? apiConfigurations.data : [],
      availabilitySlots: availabilitySlots.ok && Array.isArray(availabilitySlots.data) ? availabilitySlots.data : [],
      sessions: mySessions.ok && Array.isArray(mySessions.data) ? mySessions.data : [],
      contactLeads: contactLeads.ok && Array.isArray(contactLeads.data) ? contactLeads.data : [],
      crisisEvents: crisisEvents.ok && Array.isArray(crisisEvents.data) ? crisisEvents.data : [],
      walletTransactions: walletTransactions.ok && Array.isArray(walletTransactions.data) ? walletTransactions.data : [],
      analysisSubmissions: backendReports,
      moodHistory: backendMoodHistory,
      peerTalkState: peerTalkDashboard.ok ? peerTalkDashboard.data : null,
      peerListeners: peerListeners.ok && Array.isArray(peerListeners.data) ? peerListeners.data : [],
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
          users: users.ok && Array.isArray(users.data) ? users.data.length : (analytics.ok ? analytics.data?.users || 0 : 0),
          counsellors: remoteCounsellors.ok && Array.isArray(remoteCounsellors.data) ? remoteCounsellors.data.length : (analytics.ok ? analytics.data?.counsellors || 0 : 0),
          revenueMonth: walletTransactions.ok && Array.isArray(walletTransactions.data)
            ? walletTransactions.data.reduce((sum, tx) => sum + (tx.amountInr || (tx.amountPaise ? tx.amountPaise / 100 : 0)), 0)
            : (analytics.ok ? analytics.data?.revenueMonth || 0 : 0),
          aiMessages: analytics.ok ? analytics.data?.aiMessages || 0 : 0,
          pendingVerifications: counsellorData.ok && counsellorData.data?.applications
            ? counsellorData.data.applications.filter(a => a.status === 'pending').length
            : (analytics.ok ? analytics.data?.pendingApplications || 0 : 0),
          transactions: walletTransactions.ok && Array.isArray(walletTransactions.data) ? walletTransactions.data : []
        }
      }
    };
  },

  async signUp(role, payload) {
    const persistent = Boolean(payload?.stayLogged);
    const remote = await request(role === "counsellor" ? "/auth/counsellor/register" : "/auth/register", {
      method: "POST",
      body: role === "counsellor" ? {
        fullName: payload.name || payload.fullName,
        email: payload.email,
        mobile: payload.mobile,
        password: payload.password,
        verificationProof: payload.verificationProof,
        dateOfBirth: payload.dateOfBirth || payload.dob || undefined,
        licenseNumber: payload.license || payload.licenseNumber,
        specializations: payload.speciality || "Counselling",
        languagesSpoken: payload.languages || "English"
      } : {
        fullName: payload.name || payload.fullName,
        email: payload.email,
        mobile: payload.mobile,
        password: payload.password,
        verificationProof: payload.verificationProof,
        dateOfBirth: payload.dateOfBirth || payload.dob || undefined,
        guardianEmail: payload.guardianEmail || undefined,
        languageCode: payload.language || "en"
      }
    });

    if (remote.ok) {
      if (remote.data.status === "GUARDIAN_CONSENT_REQUIRED") {
        return remote.data;
      }
      if (remote.data.session || remote.data.accessToken) {
        saveAuthSession(remote.data.session || remote.data, persistent);
        return remote.data.session?.user || remote.data.user || remote.data;
      }
      return remote.data.user || remote.data;
    }
    throw new Error(remote.error?.message || "Sign up failed");
  },

  async login(role, payload) {
    const persistent = Boolean(payload?.stayLogged);
    const remote = await request("/auth/login", {
      method: "POST",
      body: {
        email: payload.email || undefined,
        mobile: payload.mobile || undefined,
        password: payload.password,
        role,
        totp: payload.totp || undefined
      }
    });

    if (remote.ok) {
      if (remote.data.status === "GUARDIAN_CONSENT_REQUIRED") {
        return remote.data;
      }
      if (remote.data.session || remote.data.accessToken) {
        saveAuthSession(remote.data.session || remote.data, persistent);
        return remote.data.session?.user || remote.data.user || remote.data;
      }
      return remote.data.user || remote.data;
    }
    throw new Error(remote.error?.message || "Login failed");
  },

  async loginWithFirebase(role, idToken, flow = "signin", persistent = false) {
    const remote = await request("/auth/login", {
      method: "POST",
      body: { idToken, role, flow }
    });

    if (remote.ok) {
      if (remote.data.session || remote.data.accessToken) {
        saveAuthSession(remote.data.session || remote.data, persistent);
        return { status: remote.data.status, user: remote.data.session?.user || remote.data.user };
      }
      return remote.data;
    }
    throw new Error(remote.error?.message || "Firebase login failed");
  },

  async completeProfile(onboardingToken, profileData, persistent = false) {
    const remote = await request("/auth/complete-profile", {
      method: "POST",
      body: { onboardingToken, ...profileData }
    });

    if (remote.ok) {
      if (remote.data.session || remote.data.accessToken) {
        saveAuthSession(remote.data.session || remote.data, persistent);
      }
      return remote.data;
    }
    throw new Error(remote.error?.message || "Profile completion failed");
  },

  async linkGoogle(email, password, idToken, role, persistent = false) {
    const remote = await request("/auth/link", {
      method: "POST",
      body: { email, password, idToken, role }
    });

    if (remote.ok) {
      if (remote.data.session || remote.data.accessToken) {
        saveAuthSession(remote.data.session || remote.data, persistent);
      }
      return remote.data;
    }
    throw new Error(remote.error?.message || "Account linking failed");
  },

  async approveGuardian(token) {
    const remote = await request("/auth/guardian/approve", {
      method: "POST",
      body: { token }
    });

    if (remote.ok) {
      return remote.data;
    }
    throw new Error(remote.error?.message || "Guardian approval failed");
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

  async logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await request("/auth/logout", {
          method: "POST",
          body: { refreshToken }
        });
      } catch {}
    }
    clearAuthSession();
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
    if (amountInr <= 0 || !Number.isFinite(amountInr)) {
      throw new Error("Please enter a valid top-up amount.");
    }

    const orderRes = await request("/wallet/topup/initiate", {
      method: "POST",
      body: { amountInr }
    });
    if (!orderRes.ok) {
      throw new Error(orderRes.error?.message || "Top up initiation failed");
    }

    const order = orderRes.data;
    const currentUser = getCachedAuthUser();

    // Dynamically retrieve Razorpay key if not attached to order
    let keyId = order.keyId;
    if (!keyId) {
      const pubConfig = await request("/config/public");
      if (pubConfig.ok && pubConfig.data?.razorpayKeyId) {
        keyId = pubConfig.data.razorpayKeyId;
      }
    }

    // Open real Razorpay checkout modal and await gateway callback
    const gatewayResult = await openRazorpayCheckout({
      keyId,
      order,
      user: currentUser,
      title: "MindHeal Wellness",
      description: `Wallet Top-up (₹${amountInr})`
    });

    // Send strictly gateway-returned parameters for verification
    const verification = await request("/wallet/topup/verify", {
      method: "POST",
      body: {
        orderId: order.id,
        razorpay_order_id: gatewayResult.razorpay_order_id,
        razorpay_payment_id: gatewayResult.razorpay_payment_id,
        razorpay_signature: gatewayResult.razorpay_signature
      }
    });

    if (verification.ok) {
      return { order, verification: verification.data };
    }
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
    const token = getAccessToken();
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
  },

  async getQuestionnaires() {
    const remote = await request("/screenings/questionnaires");
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async createScreening(screeningType) {
    const remote = await request("/screenings", {
      method: "POST",
      body: { screeningType }
    });
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async completeScreening(id, score, responses) {
    const remote = await request(`/screenings/${id}/complete`, {
      method: "POST",
      body: { score, responses }
    });
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async getMyScreenings() {
    const remote = await request("/screenings/me");
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async getScreening(id) {
    const remote = await request(`/screenings/${id}`);
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async requestScreeningInterpretation(id) {
    const remote = await request(`/screenings/${id}/interpret`, {
      method: "POST"
    });
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async getWalletBalance() {
    const remote = await request("/wallet/balance");
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async getPeerDashboardState() {
    const remote = await request("/peer-talk/dashboard");
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async request(path, options = {}) {
    return await request(path, options);
  },

  async getActivePromotions() {
    const remote = await request("/promotions/active");
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async getAdminPromotions() {
    const remote = await request("/admin/promotions");
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async createPromotion(message, isActive) {
    const remote = await request("/admin/promotions", {
      method: "POST",
      body: { message, isActive }
    });
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async updatePromotion(id, payload) {
    const remote = await request(`/admin/promotions/${id}`, {
      method: "PUT",
      body: payload
    });
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  async deletePromotion(id) {
    const remote = await request(`/admin/promotions/${id}`, {
      method: "DELETE"
    });
    return { success: remote.ok, data: remote.data, error: remote.error };
  },

  getAccessToken,
  getRefreshToken,
  isSessionPersistent,
  saveAuthSession,
  clearAuthSession,
  refreshAuthSession,
  clearPrivateUserData,
  getCachedAuthUser,
  saveCachedAuthUser,
  request
};


