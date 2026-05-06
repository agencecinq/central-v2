import { Redis } from "ioredis";
import { getEnv } from "../config/env.js";

let connection: Redis | null = null;

/**
 * BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`
 * on the underlying ioredis connection.
 *
 * Use the named `Redis` export rather than the default — the latter trips
 * `moduleResolution: NodeNext` because ioredis is CJS and its default
 * export isn't reliably surfaced as a constructor in that mode.
 */
export function getRedisConnection(): Redis {
  if (connection) return connection;
  const env = getEnv();
  connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return connection;
}
