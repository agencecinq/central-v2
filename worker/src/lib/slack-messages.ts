import type { DiffStats } from "./git-diff.js";

export type DryRunMessageInput = {
  ticketId: number;
  ticketTitle: string;
  repoFullName: string;
  branchName: string;
  agentSummary: string;
  diffStats: DiffStats;
  durationMs: number;
  costUsd: number;
  tokensInput: number;
  tokensOutput: number;
};

/** Format milliseconds as "Xm Ys". */
export function fmtDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export type SlackBlock = Record<string, unknown>;

/**
 * Block Kit message for Phase 4 dry-run: agent ran, diff captured, no PR yet.
 */
export function buildDryRunBlocks(input: DryRunMessageInput): SlackBlock[] {
  const { stats } = { stats: input.diffStats };
  const filesPreview = stats.files
    .slice(0, 8)
    .map((f) => `• \`${f}\``)
    .join("\n");
  const moreFiles =
    stats.files.length > 8 ? `\n…+${stats.files.length - 8} fichiers` : "";

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🤖 Auto-resolve [DRY-RUN] · TKT-${input.ticketId}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${truncate(input.ticketTitle, 200)}*\n📦 \`${input.repoFullName}\` · 🌿 \`${input.branchName}\``,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Fichiers*\n${stats.filesChanged} modifiés`,
        },
        {
          type: "mrkdwn",
          text: `*Lignes*\n+${stats.insertions} / -${stats.deletions}`,
        },
        {
          type: "mrkdwn",
          text: `*Durée*\n${fmtDuration(input.durationMs)}`,
        },
        {
          type: "mrkdwn",
          text: `*Coût*\n$${input.costUsd.toFixed(2)} (${input.tokensInput.toLocaleString()} in / ${input.tokensOutput.toLocaleString()} out)`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Résumé de l'agent*\n>${truncate(
          input.agentSummary.replace(/\n+/g, "\n>"),
          1200,
        )}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: filesPreview
          ? `*Fichiers modifiés*\n${filesPreview}${moreFiles}`
          : "_Aucun fichier modifié._",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Dry-run: la branche n'a pas été poussée ni la PR ouverte. Phase 4._",
        },
      ],
    },
  ];
}

/** Plain-text fallback shown in notifications and in apps without Block Kit. */
export function buildDryRunPlainText(input: DryRunMessageInput): string {
  return [
    `🤖 Auto-resolve [DRY-RUN] TKT-${input.ticketId} — ${input.ticketTitle}`,
    `${input.repoFullName} · branche ${input.branchName}`,
    `${input.diffStats.filesChanged} fichiers, +${input.diffStats.insertions}/-${input.diffStats.deletions}`,
    `${fmtDuration(input.durationMs)} · $${input.costUsd.toFixed(2)}`,
  ].join("\n");
}

export type PrOpenedMessageInput = DryRunMessageInput & {
  prUrl: string;
  prNumber: number;
};

/**
 * Block Kit message for the live path: agent ran, PR draft is open.
 * Includes a "Voir la PR" URL button. Interactive feedback buttons (good/bad)
 * are out of scope for V1 since they need a Slack interactivity endpoint.
 */
export function buildPrOpenedBlocks(input: PrOpenedMessageInput): SlackBlock[] {
  const stats = input.diffStats;
  const filesPreview = stats.files
    .slice(0, 8)
    .map((f) => `• \`${f}\``)
    .join("\n");
  const moreFiles =
    stats.files.length > 8 ? `\n…+${stats.files.length - 8} fichiers` : "";

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🤖 Auto-resolve · TKT-${input.ticketId}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${truncate(input.ticketTitle, 200)}*\n📦 \`${input.repoFullName}\` · 🌿 \`${input.branchName}\``,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔗 *<${input.prUrl}|PR #${input.prNumber} (draft)>*`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Voir la PR" },
        url: input.prUrl,
        style: "primary",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Fichiers*\n${stats.filesChanged} modifiés`,
        },
        {
          type: "mrkdwn",
          text: `*Lignes*\n+${stats.insertions} / -${stats.deletions}`,
        },
        {
          type: "mrkdwn",
          text: `*Durée*\n${fmtDuration(input.durationMs)}`,
        },
        {
          type: "mrkdwn",
          text: `*Coût*\n$${input.costUsd.toFixed(2)} (${input.tokensInput.toLocaleString()} in / ${input.tokensOutput.toLocaleString()} out)`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Résumé du diff*\n>${truncate(
          input.agentSummary.replace(/\n+/g, "\n>"),
          1200,
        )}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: filesPreview
          ? `*Fichiers modifiés*\n${filesPreview}${moreFiles}`
          : "_Aucun fichier modifié._",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_PR draft jamais auto-mergée. Un humain valide avant de merger._",
        },
      ],
    },
  ];
}

export function buildPrOpenedPlainText(input: PrOpenedMessageInput): string {
  return [
    `🤖 Auto-resolve TKT-${input.ticketId} — ${input.ticketTitle}`,
    `${input.repoFullName} · branche ${input.branchName}`,
    `PR #${input.prNumber} (draft) : ${input.prUrl}`,
    `${input.diffStats.filesChanged} fichiers, +${input.diffStats.insertions}/-${input.diffStats.deletions} · ${fmtDuration(input.durationMs)} · $${input.costUsd.toFixed(2)}`,
  ].join("\n");
}
