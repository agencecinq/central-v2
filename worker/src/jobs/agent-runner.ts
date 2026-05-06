import { query, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { readFile, rm } from "fs/promises";
import path from "path";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";
import type { AutoResolveContext } from "../clients/cinqcentral.js";
import type { DetectedStack } from "./detect-stack.js";

const SUMMARY_FILE = ".cinq-summary.md";
const FALLBACK_SUMMARY =
  "(L'agent n'a pas écrit de résumé .cinq-summary.md.)";

/** Tool allowlist per spec §7.4 + agent's required tools. */
const ALLOWED_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "Grep",
  "Glob",
  "Bash(npm:*)",
  "Bash(yarn:*)",
  "Bash(pnpm:*)",
  "Bash(git:*)",
  "Bash(cat:*)",
  "Bash(ls:*)",
  "Bash(grep:*)",
  "Bash(find:*)",
  "Bash(node:*)",
];

const SYSTEM_PROMPT = `Tu es un agent automatique de l'agence CINQ. Tu travailles sur un repo
client cloné localement. Ton rôle : implémenter la demande décrite dans
le ticket avec le minimum de modifications possibles.

Règles:
1. Lis le code avant d'écrire. Comprends la stack et les conventions du projet.
2. Modifie SEULEMENT ce qui est strictement nécessaire. Pas de refacto non demandé.
3. Si tu ne peux pas résoudre proprement (manque de contexte, ambiguïté, nécessite décisions produit), termine sans modifier de fichiers et explique pourquoi.
4. Pas de dépendances ajoutées sans justification claire.
5. Pas de console.log oubliés, pas de TODO laissés.
6. Si tu modifies du Liquid (Shopify), respecte les conventions OS 2.0.
7. Si tu modifies du WordPress, respecte les standards WP coding.
8. À la fin, écris un fichier \`.cinq-summary.md\` à la racine avec un résumé en 3-5 lignes de ce que tu as fait. Ce fichier sera supprimé avant le commit.

Tu as accès aux outils Read, Write, Edit, Grep, Glob, et un Bash restreint
(npm/yarn/pnpm, git, cat/ls/grep/find, node uniquement).`;

export type AgentRunOutcome = {
  /** Did the agent complete a turn cycle that ended cleanly? */
  success: boolean;
  /** Free-text summary read from .cinq-summary.md, or a fallback. */
  summary: string;
  /** Stop reason as reported by the SDK. */
  stopReason: string | null;
  /** Whether the run hit our hard timeout. */
  timedOut: boolean;
  /** Total turns the agent took. */
  numTurns: number;
  durationMs: number;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
};

export type AgentRunInput = {
  context: AutoResolveContext;
  detectedStack: DetectedStack | null;
  repoPath: string;
};

export async function runAgent(input: AgentRunInput): Promise<AgentRunOutcome> {
  const env = getEnv();
  const startedAt = Date.now();

  const userPrompt = buildAgentPrompt(input);
  const abort = new AbortController();
  const timeoutHandle = setTimeout(() => abort.abort(), env.AGENT_TIMEOUT_MS);

  let resultMsg: SDKResultMessage | null = null;
  let timedOut = false;

  try {
    const session = query({
      prompt: userPrompt,
      options: {
        cwd: input.repoPath,
        model: env.AGENT_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        allowedTools: ALLOWED_TOOLS,
        tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
        maxTurns: env.AGENT_MAX_TURNS,
        abortController: abort,
        env: {
          ...process.env,
          CLAUDE_AGENT_SDK_CLIENT_APP: "cinq-auto-resolve/0.1",
        },
      },
    });

    for await (const msg of session) {
      if (msg.type === "result") {
        resultMsg = msg;
      }
    }
  } catch (err) {
    if (abort.signal.aborted) {
      timedOut = true;
      logger.warn(
        { ticketId: input.context.ticket.id, timeoutMs: env.AGENT_TIMEOUT_MS },
        "agent run timed out, aborted",
      );
    } else {
      throw err;
    }
  } finally {
    clearTimeout(timeoutHandle);
  }

  // Read .cinq-summary.md if it exists and remove it (it must not land in the commit).
  const summary = await consumeSummaryFile(input.repoPath);

  const durationMs = Date.now() - startedAt;
  const tokensInput =
    (resultMsg?.usage.input_tokens ?? 0) +
    (resultMsg?.usage.cache_read_input_tokens ?? 0) +
    (resultMsg?.usage.cache_creation_input_tokens ?? 0);
  const tokensOutput = resultMsg?.usage.output_tokens ?? 0;
  const costUsd =
    typeof resultMsg?.total_cost_usd === "number"
      ? Number(resultMsg.total_cost_usd.toFixed(4))
      : 0;

  return {
    success: !!resultMsg && !resultMsg.is_error && !timedOut,
    summary,
    stopReason: resultMsg?.stop_reason ?? null,
    timedOut,
    numTurns: resultMsg?.num_turns ?? 0,
    durationMs,
    tokensInput,
    tokensOutput,
    costUsd,
  };
}

export function buildAgentPrompt(input: AgentRunInput): string {
  const stack = input.detectedStack
    ? formatStack(input.detectedStack)
    : "stack non détectée";
  return [
    `CONTEXTE PROJET (auto-détecté): ${stack}`,
    "",
    "TICKET À RÉSOUDRE:",
    `TITRE: ${input.context.ticket.title}`,
    `DESCRIPTION:`,
    input.context.ticket.description ?? "(vide)",
  ].join("\n");
}

function formatStack(stack: DetectedStack): string {
  const flags = stack.flags.length ? stack.flags.join(", ") : "aucun";
  return [
    `runtime=${stack.primary_runtime}`,
    `package_manager=${stack.package_manager}`,
    stack.node_version ? `node=${stack.node_version}` : null,
    stack.php_version ? `php=${stack.php_version}` : null,
    `flags=${flags}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

async function consumeSummaryFile(repoPath: string): Promise<string> {
  const summaryPath = path.join(repoPath, SUMMARY_FILE);
  try {
    const content = await readFile(summaryPath, "utf8");
    await rm(summaryPath, { force: true });
    return content.trim() || FALLBACK_SUMMARY;
  } catch {
    return FALLBACK_SUMMARY;
  }
}
