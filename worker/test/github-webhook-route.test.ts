import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

// Mock the queue (same trick as webhook-route.test.ts).
vi.mock("../src/queue/index.js", () => ({
  enqueueTicket: vi.fn().mockResolvedValue({ id: "fake" }),
  TICKET_QUEUE_NAME: "auto-resolve-tickets",
}));
// Mock the CI feedback handler — we just want to assert it gets called.
const handleCiFeedbackMock = vi.fn().mockResolvedValue({
  handled: false,
  reason: "test",
});
vi.mock("../src/jobs/ci-feedback.js", () => ({
  handleCiFeedback: (payload: unknown) => handleCiFeedbackMock(payload),
}));

const { buildApp } = await import("../src/server/app.js");
const { signPayload: signCinq } = await import("../src/lib/hmac.js");
const { createHmac } = await import("crypto");

const app = buildApp();
beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  Object.assign(process.env, PRIOR_ENV);
});

function signGithub(body: string): string {
  return `sha256=${createHmac("sha256", TEST_ENV.GITHUB_WEBHOOK_SECRET)
    .update(body)
    .digest("hex")}`;
}

const COMPLETED_PAYLOAD = {
  action: "completed",
  workflow_run: {
    id: 1,
    name: "lint",
    head_branch: "cinq/ticket-1234-foo",
    head_sha: "abcd",
    status: "completed",
    conclusion: "failure",
    html_url: "https://github.com/agencecinq/foo/actions/runs/1",
    pull_requests: [{ number: 42 }],
  },
  repository: {
    full_name: "agencecinq/foo",
    owner: { login: "agencecinq" },
    name: "foo",
  },
};

describe("POST /webhooks/github", () => {
  it("returns 401 on missing signature", async () => {
    const body = JSON.stringify(COMPLETED_PAYLOAD);
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-github-event": "workflow_run",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when GitHub signature is wrong", async () => {
    const body = JSON.stringify(COMPLETED_PAYLOAD);
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-github-event": "workflow_run",
        "x-hub-signature-256": signCinq(
          TEST_ENV.AUTORESOLVE_WEBHOOK_SECRET,
          body,
        ),
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("acknowledges a ping event", async () => {
    const body = JSON.stringify({ zen: "Keep it simple." });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-github-event": "ping",
        "x-hub-signature-256": signGithub(body),
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ pong: true });
  });

  it("ignores non workflow_run events", async () => {
    const body = JSON.stringify({});
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": signGithub(body),
      },
    });
    expect(res.statusCode).toBe(202);
    expect(handleCiFeedbackMock).not.toHaveBeenCalled();
  });

  it("ignores non-completed workflow_run actions", async () => {
    handleCiFeedbackMock.mockClear();
    const body = JSON.stringify({
      ...COMPLETED_PAYLOAD,
      action: "requested",
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-github-event": "workflow_run",
        "x-hub-signature-256": signGithub(body),
      },
    });
    expect(res.statusCode).toBe(202);
    expect(handleCiFeedbackMock).not.toHaveBeenCalled();
  });

  it("dispatches handleCiFeedback on a valid completed payload", async () => {
    handleCiFeedbackMock.mockClear();
    const body = JSON.stringify(COMPLETED_PAYLOAD);
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-github-event": "workflow_run",
        "x-hub-signature-256": signGithub(body),
      },
    });
    expect(res.statusCode).toBe(202);
    // Microtask flush so the fire-and-forget handler has run.
    await new Promise((r) => setImmediate(r));
    expect(handleCiFeedbackMock).toHaveBeenCalledTimes(1);
    expect(handleCiFeedbackMock.mock.calls[0]?.[0]).toMatchObject({
      action: "completed",
      workflow_run: { head_branch: "cinq/ticket-1234-foo" },
    });
  });
});
