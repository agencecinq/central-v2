import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "../config/env.js";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const env = getEnv();
  client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}
