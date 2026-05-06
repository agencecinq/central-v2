/**
 * Public per-million-token pricing in USD for the models we call.
 * Update if Anthropic adjusts pricing — these values feed `auto_resolve_runs.cost_usd`.
 */
const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  // Haiku 4.5
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const DEFAULT_PRICE = { input: 1, output: 5 };

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICES_PER_MTOK[model] ?? DEFAULT_PRICE;
  const cost =
    (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return Number(cost.toFixed(4));
}
