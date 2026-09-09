import { Server } from "socket.io";
import { verifyAccessToken } from "./utils/security.js";
import { repositories } from "./repositories/index.js";
import { appConfig } from "./config/app.js";
import { calculateAgeFromDob } from "./utils/validation.js";

let ioInstance;

export async function authorizeSessionParticipant(sessionId, user) {
  if (!sessionId || typeof sessionId !== "string") {
    return { authorized: false, code: "BAD_REQUEST", error: "Valid sessionId is required." };
  }

  if (!user || !user.id) {
    return { authorized: false, code: "UNAUTHORIZED", error: "Authentication required." };
  }

  // 1. Account restriction verification
  const freshUser = await repositories.users.findById(user.id);
  if (!freshUser || freshUser.isActive === false || freshUser.status === "disabled" || freshUser.status === "suspended") {
    return { authorized: false, code: "ACCOUNT_DISABLED", error: "Your account has been disabled." };
  }

  const age = calculateAgeFromDob(freshUser.dateOfBirth || freshUser.date_of_birth);
  if (freshUser.role === "user" && age !== null && age >= 15 && age < 18 && (!freshUser.isGuardianConsentVerified || freshUser.guardianConsentStatus !== "APPROVED" || freshUser.onboardingStatus === "PENDING_GUARDIAN")) {
    return { authorized: false, code: "GUARDIAN_CONSENT_REQUIRED", error: "Parent/guardian approval is required." };
  }

  // 2. Fetch session from peerSessions or sessions
  let session = null;
  let sessionType = null;

  if (repositories.peerSessions?.findById) {
    session = await repositories.peerSessions.findById(sessionId);
    if (session) sessionType = "peer";
  }

  if (!session && repositories.sessions?.findById) {
    session = await repositories.sessions.findById(sessionId);
    if (session) sessionType = "counselling";
  }

  if (!session) {
    return { authorized: false, code: "NOT_FOUND", error: "Session not found." };
  }

  // 3. Check membership
  let isAuthorized = false;

  if (freshUser.role === "admin") {
    isAuthorized = true;
  } else if (sessionType === "peer") {
    if (session.requesterUserId === freshUser.id) {
      isAuthorized = true;
    } else if (session.listenerUserId === freshUser.id || session.listenerProfileId === freshUser.id) {
      isAuthorized = true;
    } else if (session.listenerProfileId && repositories.peerListenerProfiles) {
      if (typeof repositories.peerListenerProfiles.findById === "function") {
        const lp = await repositories.peerListenerProfiles.findById(session.listenerProfileId);
        if (lp && lp.userId === freshUser.id) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized && typeof repositories.peerListenerProfiles.findByUserId === "function") {
        const userLp = await repositories.peerListenerProfiles.findByUserId(freshUser.id);
        if (userLp && userLp.id === session.listenerProfileId) {
          isAuthorized = true;
        }
      }
    }
  } else if (sessionType === "counselling") {
    if (session.userId === freshUser.id) {
      isAuthorized = true;
    } else if (session.counsellorUserId === freshUser.id || session.counsellorId === freshUser.id) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return { authorized: false, code: "FORBIDDEN", error: "You are not authorized for this session.", session, sessionType };
  }

  return { authorized: true, session, sessionType, user: freshUser };
}

export function initializeSockets(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: appConfig.allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
      if (!token) return next(new Error("Authentication error"));
      
      const payload = verifyAccessToken(token);
      if (!payload) return next(new Error("Authentication error"));
      
      const user = await repositories.users.findById(payload.sub);
      if (!user) return next(new Error("User not found"));
      
      if (user.isActive === false || user.status === "disabled" || user.status === "suspended") {
        return next(new Error("Account disabled"));
      }

      const age = calculateAgeFromDob(user.dateOfBirth || user.date_of_birth);
      if (user.role === "user" && age !== null && age >= 15 && age < 18 && (!user.isGuardianConsentVerified || user.guardianConsentStatus !== "APPROVED" || user.onboardingStatus === "PENDING_GUARDIAN")) {
        return next(new Error("Guardian consent required"));
      }

      socket.user = user;
      next();
    } catch (err) {
      if (err.message === "Account disabled" || err.message === "Guardian consent required") {
        return next(new Error(err.message));
      }
      next(new Error("Authentication error"));
    }
  });

  ioInstance.on("connection", async (socket) => {
    console.log(`[Socket] User connected: ${socket.user.id}`);
    
    // User personal room
    socket.join(socket.user.id);

    // Verify freshness on incoming socket events
    socket.use(async ([event, ...args], next) => {
      try {
        const freshUser = await repositories.users.findById(socket.user.id);
        if (!freshUser || freshUser.isActive === false || freshUser.status === "disabled" || freshUser.status === "suspended") {
          socket.emit("account_disabled", { message: "Your account has been disabled." });
          socket.disconnect(true);
          return next(new Error("Account disabled"));
        }

        const age = calculateAgeFromDob(freshUser.dateOfBirth || freshUser.date_of_birth);
        if (freshUser.role === "user" && age !== null && age >= 15 && age < 18 && (!freshUser.isGuardianConsentVerified || freshUser.guardianConsentStatus !== "APPROVED" || freshUser.onboardingStatus === "PENDING_GUARDIAN")) {
          socket.emit("guardian_consent_required", { message: "Parent/guardian approval is required." });
          socket.disconnect(true);
          return next(new Error("Guardian consent required"));
        }

        next();
      } catch (err) {
        next(err);
      }
    });

    // Track listener profile if any
    let listenerProfile = null;
    try {
      listenerProfile = await repositories.peerListenerProfiles.findByUserId(socket.user.id);
      if (listenerProfile) {
        await repositories.peerListenerPresence.createOrUpdate({
          listenerProfileId: listenerProfile.id,
          socketConnectionId: socket.id,
          heartbeatAt: new Date().toISOString()
        });
        socket.listenerProfileId = listenerProfile.id;
        console.log(`[Socket] Peer Listener ${listenerProfile.id} linked to socket ${socket.id}`);
      }
    } catch (err) {
      console.error("[Socket] Failed to find listener profile:", err.message);
    }

    socket.on("join_session", async (payload, callback) => {
      const sessionId = typeof payload === "object" && payload !== null ? payload.sessionId : payload;

      const auth = await authorizeSessionParticipant(sessionId, socket.user);
      if (!auth.authorized) {
        const errObj = { code: auth.code || "FORBIDDEN", message: auth.error, sessionId };
        socket.emit("session_error", errObj);
        if (auth.code === "ACCOUNT_DISABLED" || auth.code === "GUARDIAN_CONSENT_REQUIRED") {
          socket.emit(auth.code === "ACCOUNT_DISABLED" ? "account_disabled" : "guardian_consent_required", { message: auth.error });
          socket.disconnect(true);
        }
        if (typeof callback === "function") callback({ success: false, ...errObj });
        return;
      }

      const { session } = auth;

      // Enforce session state
      const isCancelled = session.status === "cancelled" || session.sessionStatus === "cancelled";
      if (isCancelled) {
        const errObj = { code: "SESSION_CANCELLED", message: "Session has been cancelled.", sessionId };
        socket.emit("session_error", errObj);
        if (typeof callback === "function") callback({ success: false, ...errObj });
        return;
      }

      const isEnded = session.status === "ended" || session.status === "completed" ||
                      session.sessionStatus === "completed" || session.sessionStatus === "ended" ||
                      (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now());

      if (isEnded) {
        // Participant is authorized, so history is returned, but socket does not join active live room
        try {
          const history = await repositories.peerChatMessages.listForSession(sessionId);
          socket.emit("peer_chat_history", (history || []).map(msg => ({
            id: msg.id,
            sessionId: msg.peerSessionId || sessionId,
            senderId: msg.senderId,
            text: msg.messageText || msg.text,
            timestamp: msg.createdAt || msg.timestamp
          })));
        } catch (err) {
          console.error("[Socket] Failed to fetch session chat history:", err.message);
        }
        socket.emit("session_ended", { sessionId, message: "This session has ended." });
        if (typeof callback === "function") callback({ success: true, sessionId, status: "ended" });
        return;
      }

      // Active session: authorize room join and return history
      socket.join(`session_${sessionId}`);
      console.log(`[Socket] User ${socket.user.id} joined session ${sessionId}`);

      try {
        const history = await repositories.peerChatMessages.listForSession(sessionId);
        socket.emit("peer_chat_history", (history || []).map(msg => ({
          id: msg.id,
          sessionId: msg.peerSessionId || sessionId,
          senderId: msg.senderId,
          text: msg.messageText || msg.text,
          timestamp: msg.createdAt || msg.timestamp
        })));
      } catch (err) {
        console.error("[Socket] Failed to fetch session chat history:", err.message);
      }

      if (typeof callback === "function") {
        callback({ success: true, sessionId, status: "active" });
      }
    });

    socket.on("leave_session", (payload) => {
      const sessionId = typeof payload === "object" && payload !== null ? payload.sessionId : payload;
      if (sessionId) {
        socket.leave(`session_${sessionId}`);
      }
    });

    socket.on("send_message", async (data, callback) => {
      if (!data || !data.sessionId || typeof data.text !== "string" || !data.text.trim()) {
        const errObj = { code: "BAD_REQUEST", message: "sessionId and text are required." };
        socket.emit("session_error", errObj);
        if (typeof callback === "function") callback({ success: false, ...errObj });
        return;
      }

      const auth = await authorizeSessionParticipant(data.sessionId, socket.user);
      if (!auth.authorized) {
        const errObj = { code: auth.code || "FORBIDDEN", message: auth.error, sessionId: data.sessionId };
        socket.emit("session_error", errObj);
        if (auth.code === "ACCOUNT_DISABLED" || auth.code === "GUARDIAN_CONSENT_REQUIRED") {
          socket.emit(auth.code === "ACCOUNT_DISABLED" ? "account_disabled" : "guardian_consent_required", { message: auth.error });
          socket.disconnect(true);
        }
        if (typeof callback === "function") callback({ success: false, ...errObj });
        return;
      }

      const { session } = auth;

      // Enforce session state: cannot send messages to inactive, cancelled, ended, or expired sessions
      const isInactive = session.status === "ended" || session.status === "completed" || session.status === "cancelled" ||
                         session.sessionStatus === "completed" || session.sessionStatus === "ended" || session.sessionStatus === "cancelled" ||
                         (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now());

      if (isInactive) {
        const errObj = {
          code: "SESSION_INACTIVE",
          message: "Cannot send messages to an inactive, ended, or cancelled session.",
          sessionId: data.sessionId
        };
        socket.emit("session_error", errObj);
        if (typeof callback === "function") callback({ success: false, ...errObj });
        return;
      }

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const message = {
        id: msgId,
        sessionId: data.sessionId,
        senderId: socket.user.id,
        text: data.text.trim(),
        timestamp: new Date().toISOString()
      };

      try {
        await repositories.peerChatMessages.create({
          id: msgId,
          peerSessionId: data.sessionId,
          senderId: socket.user.id,
          messageText: message.text
        });
      } catch (err) {
        console.error("[Socket] Failed to save chat message:", err.message);
        const errObj = { code: "INTERNAL_ERROR", message: "Failed to persist chat message." };
        socket.emit("session_error", errObj);
        if (typeof callback === "function") callback({ success: false, ...errObj });
        return;
      }

      ioInstance.to(`session_${data.sessionId}`).emit("receive_message", message);
      if (typeof callback === "function") {
        callback({ success: true, message });
      }
    });

    socket.on("peer_listener_ping", async () => {
      if (socket.listenerProfileId) {
        try {
          await repositories.peerListenerPresence.createOrUpdate({
            listenerProfileId: socket.listenerProfileId,
            heartbeatAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("[Socket] Heartbeat ping failed:", err.message);
        }
      }
    });

    socket.on("disconnect", async () => {
      console.log(`[Socket] User disconnected: ${socket.user.id}`);
      if (socket.listenerProfileId) {
        try {
          await repositories.peerListenerPresence.createOrUpdate({
            listenerProfileId: socket.listenerProfileId,
            currentStatus: "offline",
            socketConnectionId: null,
            heartbeatAt: new Date().toISOString()
          });
          console.log(`[Socket] Peer Listener ${socket.listenerProfileId} marked offline on disconnect`);
        } catch (err) {
          console.error("[Socket] Failed to mark listener offline on disconnect:", err.message);
        }
      }
    });
  });

  // Heartbeat worker: reap expired heartbeats (older than 60 seconds) every 30 seconds
  const heartbeatWorker = setInterval(async () => {
    try {
      const reaped = await repositories.peerListenerPresence.reapExpiredHeartbeats(60);
      if (reaped && reaped.length) {
        console.log(`[Presence Worker] Reaped ${reaped.length} inactive peer listeners`);
      }
    } catch (err) {
      console.error("[Presence Worker] Failed to reap heartbeats:", err.message);
    }
  }, 30000);
  if (heartbeatWorker.unref) heartbeatWorker.unref();

  return ioInstance;
}

export function getIO() {
  if (!ioInstance) throw new Error("Socket.io not initialized");
  return ioInstance;
}

export function disconnectUserSockets(userId) {
  if (!ioInstance || !userId) return;
  try {
    ioInstance.in(userId).emit("account_disabled", { message: "Your account has been disabled." });
    if (typeof ioInstance.in(userId).disconnectSockets === "function") {
      ioInstance.in(userId).disconnectSockets(true);
    }
  } catch (err) {
    console.error("[Socket] Failed to disconnect sockets via room:", err.message);
  }

  try {
    const sockets = ioInstance.sockets?.sockets || ioInstance.of("/")?.sockets;
    if (sockets) {
      for (const [_, s] of sockets) {
        if (s.user?.id === userId) {
          s.emit("account_disabled", { message: "Your account has been disabled." });
          s.disconnect(true);
        }
      }
    }
  } catch (err) {
    console.error("[Socket] Failed to disconnect sockets via traversal:", err.message);
  }
}

