import pino, { type Logger } from "pino";
import { getEnv } from "../config/env.js";

let cached: Logger | null = null;

function build(): Logger {
  const env = getEnv();
  return pino({
    level: env.LOG_LEVEL,
    base: { service: "cinq-auto-resolve-worker" },
    redact: {
      paths: [
        "*.AUTORESOLVE_INTERNAL_TOKEN",
        "*.AUTORESOLVE_WEBHOOK_SECRET",
        "*.ANTHROPIC_API_KEY",
        "*.GITHUB_PAT",
        "req.headers.authorization",
        "req.headers['x-cinqcentral-signature']",
      ],
      censor: "[redacted]",
    },
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}

/**
 * Lazy proxy. Importers can `logger.info(...)` immediately, but env validation
 * is deferred until the first actual log call — handy for unit tests that
 * import modules without configuring the worker's env.
 */
export const logger = new Proxy({} as Logger, {
  get(_, prop) {
    cached ??= build();
    const value = (cached as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cached) : value;
  },
}) as Logger;
