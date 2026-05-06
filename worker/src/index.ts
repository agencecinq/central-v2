import { buildApp } from "./server/app.js";
import { startTicketWorker } from "./jobs/process-ticket.js";
import { logger } from "./lib/logger.js";
import { getEnv } from "./config/env.js";

async function main() {
  const env = getEnv();
  const app = buildApp();
  const ticketWorker = startTicketWorker();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "auto-resolve worker ready");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    try {
      await app.close();
      await ticketWorker.close();
    } catch (err) {
      logger.error({ err }, "error during shutdown");
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "fatal startup error");
  process.exit(1);
});
