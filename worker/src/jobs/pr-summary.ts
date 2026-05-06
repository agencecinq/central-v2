import { getAnthropic } from "../clients/anthropic.js";
import { getEnv } from "../config/env.js";

const MAX_TITLE_LEN = 70;
const SYSTEM_PROMPT = `Tu génères le titre et la description d'une Pull Request.

Format de réponse STRICT (sans markdown autour, en texte brut):

TITRE: <titre conventional commit, max 70 caractères, en français>

DESCRIPTION:
## Résumé
<2-4 lignes>

## Modifications
<liste à puces des changements concrets>

## À tester
<liste à puces des points à vérifier manuellement>

Règles:
- Le titre suit le format Conventional Commits: \`type(scope): description\`. Types autorisés: feat, fix, refactor, style, chore, docs.
- Le titre fait MAX 70 caractères. Pas de point final.
- La description est en Markdown français.
- Pas de bavardage hors format.`;

export type PrSummary = {
  title: string;
  body: string;
};

export type PrSummaryUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type PrSummaryOutput = {
  summary: PrSummary;
  usage: PrSummaryUsage;
};

const MAX_DIFF_CHARS = 60_000;

function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[…diff tronqué — ${diff.length - MAX_DIFF_CHARS} caractères omis…]`;
}

export async function generatePrSummary(input: {
  ticketTitle: string;
  ticketDescription: string | null;
  diff: string;
}): Promise<PrSummaryOutput> {
  const env = getEnv();
  const anthropic = getAnthropic();

  const userPrompt = [
    `TICKET: ${input.ticketTitle}`,
    "DESCRIPTION TICKET:",
    input.ticketDescription ?? "(vide)",
    "",
    "DIFF:",
    truncateDiff(input.diff),
  ].join("\n");

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_CLASSIFIER_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("PR summary call returned no text content");
  }

  return {
    summary: parsePrSummary(textBlock.text, input.ticketTitle),
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Extracts TITRE/DESCRIPTION blocks from the model output. Robust to leading
 * markdown fences, leading prose, and missing sections — falls back to the
 * ticket title and a minimal description when needed.
 */
export function parsePrSummary(raw: string, ticketTitle: string): PrSummary {
  const cleaned = stripCodeFences(raw).trim();

  const titleMatch = cleaned.match(/^\s*TITRE\s*:\s*(.+)$/im);
  const descMatch = cleaned.match(/^\s*DESCRIPTION\s*:\s*\n?([\s\S]+)$/im);

  let title = (titleMatch?.[1] ?? "").trim();
  if (!title) {
    title = `chore(auto): ${ticketTitle}`;
  }
  // Strip trailing punctuation per Conventional Commits convention.
  title = title.replace(/[.!?]+$/, "");
  if (title.length > MAX_TITLE_LEN) {
    title = `${title.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…`;
  }

  let body = (descMatch?.[1] ?? "").trim();
  if (!body) {
    body = "## Résumé\n_Description automatique non disponible._";
  }

  return { title, body };
}

function stripCodeFences(text: string): string {
  return text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
}
