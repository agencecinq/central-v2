import Fastify, { type FastifyInstance, type FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { verifySignature } from "../lib/hmac.js";
import {
  verifyGithubSignature,
  workflowRunCompletedSchema,
} from "../lib/github-webhook.js";
import { enqueueTicket } from "../queue/index.js";
import { handleCiFeedback } from "../jobs/ci-feedback.js";

const webhookBodySchema = z.object({
  event: z.literal("ticket.created"),
  ticket_id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  created_at: z.string().datetime().optional(),
  actor: z
    .object({
      user_id: z.number().int().positive().nullable().optional(),
      email: z.string().email().nullable().optional(),
    })
    .optional(),
});

export function buildApp(): FastifyInstance {
  const env = getEnv();
  // pino's Logger satisfies FastifyBaseLogger at runtime; the cast bridges
  // a structural mismatch on the optional `msgPrefix` field.
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    bodyLimit: 1024 * 64,
  });

  // Capture the raw body so HMAC can be verified byte-perfect.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        const parsed = body.length ? JSON.parse(body as string) : {};
        done(null, { parsed, raw: body as string });
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.get("/health", async () => ({
    status: "ok",
    service: "cinq-auto-resolve-worker",
  }));

  app.post("/webhooks/cinqcentral/ticket-created", async (req, reply) => {
    const signature = req.headers["x-cinqcentral-signature"];
    const headerValue = Array.isArray(signature) ? signature[0] : signature;
    const payload = req.body as { parsed: unknown; raw: string } | undefined;

    if (!payload) {
      return reply.code(400).send({ error: "Missing body" });
    }

    if (!verifySignature(env.AUTORESOLVE_WEBHOOK_SECRET, payload.raw, headerValue)) {
      req.log.warn("invalid HMAC signature on incoming webhook");
      return reply.code(401).send({ error: "Invalid signature" });
    }

    const parsed = webhookBodySchema.safeParse(payload.parsed);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid payload", issues: parsed.error.issues });
    }

    const job = await enqueueTicket({
      ticketId: parsed.data.ticket_id,
      projectId: parsed.data.project_id,
      receivedAt: new Date().toISOString(),
    });

    req.log.info({ jobId: job.id, ticketId: parsed.data.ticket_id }, "enqueued");
    return reply.code(202).send({ accepted: true, job_id: job.id });
  });

  app.post("/webhooks/github", async (req, reply) => {
    const event = req.headers["x-github-event"];
    const eventName = Array.isArray(event) ? event[0] : event;
    const signature = req.headers["x-hub-signature-256"];
    const headerValue = Array.isArray(signature) ? signature[0] : signature;
    const payload = req.body as { parsed: unknown; raw: string } | undefined;

    if (!payload) {
      return reply.code(400).send({ error: "Missing body" });
    }
    if (
      !verifyGithubSignature(
        env.GITHUB_WEBHOOK_SECRET,
        payload.raw,
        headerValue,
      )
    ) {
      req.log.warn("invalid HMAC signature on GitHub webhook");
      return reply.code(401).send({ error: "Invalid signature" });
    }

    // GitHub sends a `ping` event on first delivery — ack it.
    if (eventName === "ping") {
      return reply.code(200).send({ pong: true });
    }
    if (eventName !== "workflow_run") {
      return reply
        .code(202)
        .send({ accepted: true, ignored: `event ${eventName}` });
    }

    const parsed = workflowRunCompletedSchema.safeParse(payload.parsed);
    if (!parsed.success) {
      // Likely a workflow_run.requested or .in_progress — ignore.
      return reply
        .code(202)
        .send({ accepted: true, ignored: "non-completed workflow_run" });
    }

    // Acknowledge fast, then process. GitHub retries if we don't 2xx within 10s.
    void reply.code(202).send({ accepted: true });
    handleCiFeedback(parsed.data)
      .then((outcome) => {
        req.log.info({ outcome }, "CI feedback processed");
      })
      .catch((err) => {
        req.log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "CI feedback handler crashed",
        );
      });
    return reply;
  });

  return app;
}
