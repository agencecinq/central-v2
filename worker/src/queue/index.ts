import { Queue } from "bullmq";
import { getRedisConnection } from "./redis.js";

// BullMQ ≥5.x rejects `:` in queue names (reserved for internal Redis key
// separators), so we use a hyphenated name.
export const TICKET_QUEUE_NAME = "auto-resolve-tickets";

export type TicketJobData = {
  ticketId: number;
  projectId: number;
  receivedAt: string;
};

let queue: Queue<TicketJobData> | null = null;

export function getTicketQueue(): Queue<TicketJobData> {
  if (queue) return queue;
  queue = new Queue<TicketJobData>(TICKET_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
  return queue;
}

/**
 * Enqueue with idempotent jobId so a duplicate webhook does not double-run.
 */
export function enqueueTicket(data: TicketJobData) {
  return getTicketQueue().add("classify", data, {
    jobId: `ticket-${data.ticketId}`,
  });
}
