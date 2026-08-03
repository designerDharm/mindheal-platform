import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL;

export const redisClient = redisUrl
  ? createClient({ url: redisUrl })
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
      async expire() {}
    };

if (redisUrl) {
  redisClient.on('error', (err) => console.warn('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Connected to Redis'));

  // Start connecting, but don't crash if it fails (graceful degradation)
  redisClient.connect().catch((err) => {
    console.warn("Failed to connect to Redis initially. Refresh tokens may fallback to memory or fail.", err.message);
  });
}
