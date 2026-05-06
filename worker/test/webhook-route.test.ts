import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Set required env vars BEFORE the modules under test are imported, since
// `getEnv()` reads them eagerly when its first caller imports it.
const TEST_ENV = {
  PORT: "3001",
  LOG_LEVEL: "fatal",
  NODE_ENV: "test",
  AUTORESOLVE_WEBHOOK_SECRET: "test-webhook-secret-please-be-long",
  AUTORESOLVE_INTERNAL_TOKEN: "test-internal-token-please-be-long",
  CINQCENTRAL_BASE_URL: "https://example.invalid",
  REDIS_URL: "redis://localhost:6379",
  ANTHROPIC_API_KEY: "sk-test",
  GITHUB_PAT: "ghp_test_pat_placeholder_value",
  GITHUB_WEBHOOK_SECRET: "github-test-webhook-secret-please-be-long",
  SLACK_BOT_TOKEN: "xoxb-test-bot-token-placeholder-value",
};
const PRIOR_ENV = { ...process.env };
Object.assign(process.env, TEST_ENV);

// Stub the queue so we don't need a real Redis.
const enqueueMock = vi.fn().mockResolvedValue({ id: "fake-job-id" });
vi.mock("../src/queue/index.js", () => ({
  enqueueTicket: (data: unknown) => enqueueMock(data),
  TICKET_QUEUE_NAME: "auto-resolve-tickets",
}));

const { buildApp } = await import("../src/server/app.js");
const { signPayload } = await import("../src/lib/hmac.js");

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  Object.assign(process.env, PRIOR_ENV);
});

describe("POST /webhooks/cinqcentral/ticket-created", () => {
  it("returns 401 when signature is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/cinqcentral/ticket-created",
      payload: JSON.stringify({
        event: "ticket.created",
        ticket_id: 1,
        project_id: 1,
      }),
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when signature is invalid", async () => {
    const body = JSON.stringify({
      event: "ticket.created",
      ticket_id: 1,
      project_id: 1,
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/cinqcentral/ticket-created",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-cinqcentral-signature": "sha256=00".padEnd(71, "0"),
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 on schema mismatch even with a valid signature", async () => {
    const body = JSON.stringify({ event: "wrong.event" });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/cinqcentral/ticket-created",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-cinqcentral-signature": signPayload(
          TEST_ENV.AUTORESOLVE_WEBHOOK_SECRET,
          body,
        ),
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 202 and enqueues a job for a valid signed payload", async () => {
    const body = JSON.stringify({
      event: "ticket.created",
      ticket_id: 42,
      project_id: 7,
      created_at: "2026-05-06T12:00:00.000Z",
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/cinqcentral/ticket-created",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-cinqcentral-signature": signPayload(
          TEST_ENV.AUTORESOLVE_WEBHOOK_SECRET,
          body,
        ),
      },
    });
    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body)).toMatchObject({
      accepted: true,
      job_id: "fake-job-id",
    });
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 42, projectId: 7 }),
    );
  });
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: "ok" });
  });
});
