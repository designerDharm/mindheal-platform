import { Server } from "socket.io";
import { verifyAccessToken } from "./utils/security.js";
import { repositories } from "./repositories/index.js";

let ioInstance;

export function initializeSockets(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
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

  ioInstance.on("connection", (socket) => {
    console.log(`[Socket] User connected: ${socket.user.id}`);
    
    // User personal room
    socket.join(socket.user.id);

    socket.on("join_session", (sessionId) => {
      socket.join(`session_${sessionId}`);
      console.log(`[Socket] User ${socket.user.id} joined session ${sessionId}`);
    });

    socket.on("leave_session", (sessionId) => {
      socket.leave(`session_${sessionId}`);
    });

    socket.on("send_message", (data) => {
      const message = {
        id: `msg_${Date.now()}`,
        sessionId: data.sessionId,
        senderId: socket.user.id,
        text: data.text,
        timestamp: new Date().toISOString()
      };
      
      // In a real production app, persist message to Postgres here
      ioInstance.to(`session_${data.sessionId}`).emit("receive_message", message);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${socket.user.id}`);
    });
  });

  return ioInstance;
}

export function getIO() {
  if (!ioInstance) throw new Error("Socket.io not initialized");
  return ioInstance;
}
