import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  AUTORESOLVE_WEBHOOK_SECRET: z.string().min(16),
  AUTORESOLVE_INTERNAL_TOKEN: z.string().min(16),
  CINQCENTRAL_BASE_URL: z.string().url(),

  REDIS_URL: z.string().url(),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_CLASSIFIER_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  AGENT_MODEL: z.string().default("claude-sonnet-4-6"),
  AGENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60_000),
  AGENT_MAX_TURNS: z.coerce.number().int().positive().default(40),

  GITHUB_PAT: z.string().min(20),
  /** HMAC secret configured on the GitHub webhook (workflow_run.completed). */
  GITHUB_WEBHOOK_SECRET: z.string().min(16),

  SLACK_BOT_TOKEN: z.string().min(20),
  SLACK_INTERNAL_CHANNEL_ID: z.string().optional(),

  WORK_DIR: z.string().default("/tmp/auto-resolve"),
  STACK_CACHE_DAYS: z.coerce.number().int().positive().default(7),

  MONTHLY_BUDGET_USD: z.coerce.number().positive().default(200),

  /** Phase 4 dry-run: agent runs but no push to GitHub. */
  DRY_RUN: z
    .union([z.literal("true"), z.literal("false")])
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
