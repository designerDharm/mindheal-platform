import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.NODE_ENV === 'test' ? null : (process.env.REDIS_URL || null);

export const redisClient = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy(retries) {
          // Exponential backoff capped at 3000ms
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 5000
      }
    })
  : {
      isOpen: false,
      async setEx() {},
      async get() {
        return null;
      },
      async del() {},
      async incr() {
        return 1;
      },
      async expire() {},
      async ping() {
        return "PONG";
      },
      async eval() {
        return null;
      },
      async connect() {},
      async disconnect() {},
      async quit() {},
      on() {}
    };

if (redisUrl) {
  redisClient.on('error', (err) => console.warn('[Redis] Client Error:', err.message || err));
  redisClient.on('connect', () => console.log('[Redis] Connected to Redis'));
  redisClient.on('ready', () => console.log('[Redis] Client ready'));
  redisClient.on('end', () => console.warn('[Redis] Client connection ended'));

  // Start connecting, but don't crash if it fails (graceful degradation)
  redisClient.connect().catch((err) => {
    console.warn("[Redis] Failed to connect initially. Falling back to memory store.", err.message);
  });
}

/**
 * Checks Redis connectivity and health status.
 * @returns {Promise<{ status: "healthy" | "degraded" | "unhealthy" | "disconnected" | "unconfigured", connected: boolean, error?: string }>}
 */
export async function checkRedisHealth() {
  if (!redisClient || !redisClient.isOpen) {
    return {
      status: redisUrl ? "disconnected" : "unconfigured",
      connected: false
    };
  }

  try {
    const reply = await redisClient.ping();
    return {
      status: reply === "PONG" ? "healthy" : "degraded",
      connected: true
    };
  } catch (err) {
    return {
      status: "unhealthy",
      connected: false,
      error: err.message
    };
  }
}

