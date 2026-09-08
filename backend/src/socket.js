import { Server } from "socket.io";
import { verifyAccessToken } from "./utils/security.js";
import { repositories } from "./repositories/index.js";
import { appConfig } from "./config/app.js";

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
      
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  ioInstance.on("connection", async (socket) => {
    console.log(`[Socket] User connected: ${socket.user.id}`);
    
    // User personal room
    socket.join(socket.user.id);

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
