import IORedis, { type Redis } from "ioredis";
import { getEnv } from "../config/env.js";

let connection: Redis | null = null;

/**
 * BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`
 * on the underlying ioredis connection.
 */
export function getRedisConnection(): Redis {
  if (connection) return connection;
  const env = getEnv();
  connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return connection;
}
