import { WebClient } from "@slack/web-api";
import { getEnv } from "../config/env.js";

let client: WebClient | null = null;

export function getSlackClient(): WebClient {
  if (client) return client;
  const env = getEnv();
  client = new WebClient(env.SLACK_BOT_TOKEN);
  return client;
}

/** Convenience wrapper that returns the message ts (for later updates). */
export async function postSlackMessage(opts: {
  channel: string;
  text: string;
  blocks?: unknown[];
}): Promise<string | null> {
  const slack = getSlackClient();
  const res = await slack.chat.postMessage({
    channel: opts.channel,
    text: opts.text,
    // The WebClient typings expect KnownBlock[]; we accept an opaque shape
    // here so the prompt-builder modules don't need Slack typings.
    blocks: opts.blocks as never,
  });
  return res.ts ?? null;
}
