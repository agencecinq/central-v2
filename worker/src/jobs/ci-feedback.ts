import { CinqCentralClient } from "../clients/cinqcentral.js";
import { commentOnPullRequest } from "../clients/github.js";
import { getSlackClient } from "../clients/slack.js";
import {
  buildCiFailureBlocks,
  buildCiFailurePlainText,
  buildPrCommentMarkdown,
  type CiFailureMessageInput,
} from "../lib/ci-feedback-messages.js";
import { logger } from "../lib/logger.js";
import {
  isCinqBranch,
  isFailureConclusion,
  type WorkflowRunCompleted,
} from "../lib/github-webhook.js";

export type CiFeedbackOutcome =
  | { handled: false; reason: string }
  | {
      handled: true;
      slackPosted: boolean;
      prCommentPosted: boolean;
      ticketId: number;
    };

/**
 * React to a `workflow_run.completed` GitHub webhook. Only failures on
 * branches we manage (`cinq/*`) trigger user-visible feedback. Anything
 * else is reported as `handled: false` with a short reason for the log.
 */
export async function handleCiFeedback(
  payload: WorkflowRunCompleted,
): Promise<CiFeedbackOutcome> {
  const log = logger.child({
    workflow: payload.workflow_run.name,
    branch: payload.workflow_run.head_branch,
    conclusion: payload.workflow_run.conclusion,
  });

  if (!isCinqBranch(payload.workflow_run.head_branch)) {
    return { handled: false, reason: "branch is not under cinq/" };
  }
  if (!isFailureConclusion(payload.workflow_run.conclusion)) {
    return {
      handled: false,
      reason: `conclusion ${payload.workflow_run.conclusion ?? "null"} not a failure`,
    };
  }

  const cinq = new CinqCentralClient();
  const run = await cinq.findRunByBranch(payload.workflow_run.head_branch);
  if (!run) {
    return { handled: false, reason: "no auto-resolve run for this branch" };
  }

  const messageInput: CiFailureMessageInput = {
    ticketId: run.ticket_id,
    ticketTitle: run.ticket_title,
    workflowName: payload.workflow_run.name,
    conclusion: payload.workflow_run.conclusion ?? "unknown",
    workflowUrl: payload.workflow_run.html_url,
    prUrl: run.pr_url,
    prNumber: run.pr_number,
  };

  let slackPosted = false;
  if (run.project.slack_channel_id && run.slack_ts) {
    try {
      const slack = getSlackClient();
      await slack.chat.postMessage({
        channel: run.project.slack_channel_id,
        thread_ts: run.slack_ts,
        text: buildCiFailurePlainText(messageInput),
        blocks: buildCiFailureBlocks(messageInput) as never,
      });
      slackPosted = true;
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Slack thread post failed",
      );
    }
  } else {
    log.info("no slack_channel_id or slack_ts on run, skipping Slack reply");
  }

  let prCommentPosted = false;
  if (run.pr_number && run.project.repo_url) {
    try {
      await commentOnPullRequest({
        repoUrl: run.project.repo_url,
        prNumber: run.pr_number,
        body: buildPrCommentMarkdown(messageInput),
      });
      prCommentPosted = true;
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "PR comment failed",
      );
    }
  } else {
    log.info("no pr_number or repo_url on run, skipping PR comment");
  }

  return {
    handled: true,
    slackPosted,
    prCommentPosted,
    ticketId: run.ticket_id,
  };
}
