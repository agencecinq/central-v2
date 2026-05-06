import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import {
  isCinqBranch,
  isFailureConclusion,
  verifyGithubSignature,
  workflowRunCompletedSchema,
} from "../src/lib/github-webhook.js";

const SECRET = "github-test-secret-please-be-long-enough";

function sign(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
}

describe("verifyGithubSignature", () => {
  it("accepts a body signed with the right secret", () => {
    const body = JSON.stringify({ foo: "bar" });
    expect(verifyGithubSignature(SECRET, body, sign(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ foo: "bar" });
    expect(
      verifyGithubSignature(SECRET, JSON.stringify({ foo: "baz" }), sign(body)),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const body = JSON.stringify({ foo: "bar" });
    expect(
      verifyGithubSignature("other-secret-of-similar-len-yes", body, sign(body)),
    ).toBe(false);
  });

  it("rejects malformed or missing signatures", () => {
    expect(verifyGithubSignature(SECRET, "{}", undefined)).toBe(false);
    expect(verifyGithubSignature(SECRET, "{}", null)).toBe(false);
    expect(verifyGithubSignature(SECRET, "{}", "not-a-sig")).toBe(false);
    expect(verifyGithubSignature(SECRET, "{}", "sha256=zzzz")).toBe(false);
  });
});

describe("workflowRunCompletedSchema", () => {
  const validPayload = {
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

  it("parses a valid completed payload", () => {
    const parsed = workflowRunCompletedSchema.parse(validPayload);
    expect(parsed.workflow_run.head_branch).toBe("cinq/ticket-1234-foo");
  });

  it("rejects non-completed actions", () => {
    expect(() =>
      workflowRunCompletedSchema.parse({
        ...validPayload,
        action: "requested",
      }),
    ).toThrow();
  });

  it("accepts a null conclusion", () => {
    const parsed = workflowRunCompletedSchema.parse({
      ...validPayload,
      workflow_run: { ...validPayload.workflow_run, conclusion: null },
    });
    expect(parsed.workflow_run.conclusion).toBeNull();
  });

  it("defaults pull_requests to an empty array", () => {
    const { pull_requests: _drop, ...workflow_run } =
      validPayload.workflow_run;
    const parsed = workflowRunCompletedSchema.parse({
      ...validPayload,
      workflow_run,
    });
    expect(parsed.workflow_run.pull_requests).toEqual([]);
  });
});

describe("isFailureConclusion", () => {
  it("flags failure-class conclusions as failure", () => {
    expect(isFailureConclusion("failure")).toBe(true);
    expect(isFailureConclusion("cancelled")).toBe(true);
    expect(isFailureConclusion("timed_out")).toBe(true);
    expect(isFailureConclusion("startup_failure")).toBe(true);
  });

  it("does not flag success/neutral/skipped/null", () => {
    expect(isFailureConclusion("success")).toBe(false);
    expect(isFailureConclusion("neutral")).toBe(false);
    expect(isFailureConclusion("skipped")).toBe(false);
    expect(isFailureConclusion(null)).toBe(false);
  });
});

describe("isCinqBranch", () => {
  it("matches branches we own", () => {
    expect(isCinqBranch("cinq/ticket-1234-foo")).toBe(true);
  });
  it("ignores other branches", () => {
    expect(isCinqBranch("main")).toBe(false);
    expect(isCinqBranch("feature/xxx")).toBe(false);
    expect(isCinqBranch("cinq")).toBe(false);
  });
});
