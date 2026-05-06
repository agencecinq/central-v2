import { z } from "zod";
import { getAnthropic } from "../clients/anthropic.js";
import { getEnv } from "../config/env.js";
import type { AutoResolveContext } from "../clients/cinqcentral.js";

export const classifierResultSchema = z.object({
  codable: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(280),
});

export type ClassifierResult = z.infer<typeof classifierResultSchema>;

export type ClassifierUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ClassifierOutput = {
  result: ClassifierResult;
  usage: ClassifierUsage;
  rawText: string;
};

const SYSTEM_PROMPT = `Tu es un classifier qui détermine si un ticket est résolvable par
modification de code source uniquement (sans accès aux services externes,
au CMS, à la base de données ou à un staging).

Réponds STRICTEMENT en JSON, sans markdown:
{
  "codable": true | false,
  "confidence": 0.0-1.0,
  "reason": "phrase courte"
}

Exemples codables:
- "Changer le texte du bouton CTA"
- "Le footer ne s'affiche pas en mobile, il manque un padding"
- "Ajouter un nouveau composant FAQ"

Exemples NON codables:
- "Appeler le client pour valider la maquette"
- "Créer un compte Klaviyo"
- "Le produit X n'apparaît pas dans la collection Y" (probablement données CMS)
- "Préparer un devis"`;

export function buildUserPrompt(context: AutoResolveContext): string {
  const stackSummary = summarizeStack(context.project.detected_stack);
  return [
    `TITRE: ${context.ticket.title}`,
    `DESCRIPTION: ${context.ticket.description ?? "(vide)"}`,
    `LABELS: ${context.ticket.labels.join(", ") || "(aucun)"}`,
    `PROJET: ${context.project.name} (stack: ${stackSummary})`,
  ].join("\n");
}

function summarizeStack(
  stack: Record<string, unknown> | null | undefined,
): string {
  if (!stack) return "inconnue";
  const flags = Object.entries(stack)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
  return flags.length ? flags.join(", ") : "inconnue";
}

/**
 * Extracts the first JSON object from a text blob — robust to leading/trailing
 * whitespace or stray text the model might emit despite the instruction.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to bracket scan
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Classifier response did not contain a JSON object");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function classifyTicket(
  context: AutoResolveContext,
): Promise<ClassifierOutput> {
  const env = getEnv();
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_CLASSIFIER_MODEL,
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(context) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Classifier returned no text content");
  }

  const parsed = classifierResultSchema.parse(extractJson(textBlock.text));

  return {
    result: parsed,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    rawText: textBlock.text,
  };
}
