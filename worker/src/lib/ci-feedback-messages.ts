import type { SlackBlock } from "./slack-messages.js";

export type CiFailureMessageInput = {
  ticketId: number;
  ticketTitle: string;
  workflowName: string;
  conclusion: string;
  workflowUrl: string;
  prUrl: string | null;
  prNumber: number | null;
};

export function buildCiFailureBlocks(
  input: CiFailureMessageInput,
): SlackBlock[] {
  const prRef = input.prNumber ? `PR #${input.prNumber}` : "la PR";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *CI rouge sur ${prRef}* (TKT-${input.ticketId})`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Le workflow \`${input.workflowName}\` est *${input.conclusion}*.\n<${input.workflowUrl}|Voir le run GitHub>`,
      },
    },
  ];
}

export function buildCiFailurePlainText(
  input: CiFailureMessageInput,
): string {
  const prRef = input.prNumber ? `PR #${input.prNumber}` : "la PR";
  return `⚠️ CI rouge sur ${prRef} (TKT-${input.ticketId}) — workflow ${input.workflowName} ${input.conclusion}. ${input.workflowUrl}`;
}

export function buildPrCommentMarkdown(input: CiFailureMessageInput): string {
  return [
    `## ⚠️ Auto-resolve · CI rouge`,
    "",
    `Le workflow \`${input.workflowName}\` est terminé avec la conclusion \`${input.conclusion}\`.`,
    "",
    `🔗 [Voir le run sur GitHub](${input.workflowUrl})`,
    "",
    `_Cette PR a été ouverte automatiquement par cinq-auto-resolve. Un humain doit corriger ou fermer la PR avant tout merge._`,
  ].join("\n");
}
