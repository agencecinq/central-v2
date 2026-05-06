import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const SCHEME_PREFIX = "sha256=";

/**
 * Verify the `X-Hub-Signature-256` header GitHub sends with every webhook.
 * GitHub uses the same `sha256=<hex>` envelope as our internal HMAC, but
 * over the raw request body (UTF-8). Mismatched lengths short-circuit
 * before timingSafeEqual to avoid a Buffer length panic.
 */
export function verifyGithubSignature(
  secret: string,
  rawBody: string,
  header: string | undefined | null,
): boolean {
  if (!header || !header.startsWith(SCHEME_PREFIX)) return false;
  const expected = `${SCHEME_PREFIX}${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Schema for the subset of `workflow_run.completed` we care about. Anything
 * else GitHub sends is ignored without failing the webhook.
 */
export const workflowRunCompletedSchema = z.object({
  action: z.literal("completed"),
  workflow_run: z.object({
    id: z.number(),
    name: z.string(),
    head_branch: z.string(),
    head_sha: z.string(),
    status: z.string(),
    conclusion: z
      .enum([
        "success",
        "failure",
        "cancelled",
        "neutral",
        "skipped",
        "stale",
        "timed_out",
        "action_required",
        "startup_failure",
      ])
      .nullable(),
    html_url: z.string().url(),
    pull_requests: z
      .array(z.object({ number: z.number() }))
      .optional()
      .default([]),
  }),
  repository: z.object({
    full_name: z.string(),
    owner: z.object({ login: z.string() }),
    name: z.string(),
  }),
});

export type WorkflowRunCompleted = z.infer<typeof workflowRunCompletedSchema>;

const FAILURE_CONCLUSIONS = new Set([
  "failure",
  "cancelled",
  "timed_out",
  "startup_failure",
]);

export function isFailureConclusion(
  conclusion: WorkflowRunCompleted["workflow_run"]["conclusion"],
): boolean {
  return conclusion !== null && FAILURE_CONCLUSIONS.has(conclusion);
}

/** Cinq branches always live under `cinq/`. Filter early to ignore noise. */
export function isCinqBranch(branch: string): boolean {
  return branch.startsWith("cinq/");
}
