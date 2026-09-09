import { Server } from "socket.io";
import { verifyAccessToken } from "./utils/security.js";
import { repositories } from "./repositories/index.js";
import { appConfig } from "./config/app.js";
import { calculateAgeFromDob } from "./utils/validation.js";

let ioInstance;

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

    socket.on("join_session", async (sessionId) => {
      socket.join(`session_${sessionId}`);
      console.log(`[Socket] User ${socket.user.id} joined session ${sessionId}`);
      
      try {
        const history = await repositories.peerChatMessages.listForSession(sessionId);
        socket.emit("peer_chat_history", history.map(msg => ({
          id: msg.id,
          sessionId: msg.peerSessionId,
          senderId: msg.senderId,
          text: msg.messageText,
          timestamp: msg.createdAt
        })));
      } catch (err) {
        console.error("[Socket] Failed to fetch session chat history:", err.message);
      }
    });

    socket.on("leave_session", (sessionId) => {
      socket.leave(`session_${sessionId}`);
    });

    socket.on("send_message", async (data) => {
      const msgId = `msg_${Date.now()}`;
      const message = {
        id: msgId,
        sessionId: data.sessionId,
        senderId: socket.user.id,
        text: data.text,
        timestamp: new Date().toISOString()
      };
      
      try {
        await repositories.peerChatMessages.create({
          id: msgId,
          peerSessionId: data.sessionId,
          senderId: socket.user.id,
          messageText: data.text
        });
      } catch (err) {
        console.error("[Socket] Failed to save chat message:", err.message);
      }
      
      ioInstance.to(`session_${data.sessionId}`).emit("receive_message", message);
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
  setInterval(async () => {
    try {
      const reaped = await repositories.peerListenerPresence.reapExpiredHeartbeats(60);
      if (reaped && reaped.length) {
        console.log(`[Presence Worker] Reaped ${reaped.length} inactive peer listeners`);
      }
    } catch (err) {
      console.error("[Presence Worker] Failed to reap heartbeats:", err.message);
    }
  }, 30000);

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

