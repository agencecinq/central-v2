import { Worker, type Job } from "bullmq";
import { TICKET_QUEUE_NAME, type TicketJobData } from "../queue/index.js";
import { getRedisConnection } from "../queue/redis.js";
import { CinqCentralClient } from "../clients/cinqcentral.js";
import { classifyTicket } from "./classifier.js";
import {
  detectStack,
  isStackCacheFresh,
  type DetectedStack,
} from "./detect-stack.js";
import { runAgent } from "./agent-runner.js";
import { cloneRepo, RepoNotAllowedError } from "../lib/clone.js";
import { makeWorkdirSlug } from "../lib/workdir.js";
import { captureRepoDiff } from "../lib/git-diff.js";
import { scanDiffForSecrets } from "../lib/secret-scan.js";
import {
  buildDryRunBlocks,
  buildDryRunPlainText,
  buildPrOpenedBlocks,
  buildPrOpenedPlainText,
} from "../lib/slack-messages.js";
import {
  getRepoFullNameFromUrl,
  makeBranchName,
} from "../lib/branch-name.js";
import { postSlackMessage } from "../clients/slack.js";
import { generatePrSummary } from "./pr-summary.js";
import { commitAndPush } from "../lib/git-commit-push.js";
import { createDraftPullRequest } from "../clients/github.js";
import { logger } from "../lib/logger.js";
import { newRunId } from "../lib/run-id.js";
import { estimateCostUsd } from "../lib/pricing.js";
import { getEnv } from "../config/env.js";
import type { AutoResolveContext } from "../clients/cinqcentral.js";

export function startTicketWorker(): Worker<TicketJobData> {
  const worker = new Worker<TicketJobData>(
    TICKET_QUEUE_NAME,
    async (job) => processTicketJob(job),
    {
      connection: getRedisConnection(),
      concurrency: 2,
      lockDuration: 16 * 60_000, // slightly above agent hard timeout
    },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, ticketId: job?.data.ticketId, err: err.message },
      "ticket job failed",
    );
  });
  worker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, ticketId: job.data.ticketId },
      "ticket job completed",
    );
  });

  return worker;
}

async function processTicketJob(job: Job<TicketJobData>): Promise<void> {
  const env = getEnv();
  const cinq = new CinqCentralClient();
  const log = logger.child({ jobId: job.id, ticketId: job.data.ticketId });
  const runId = newRunId();
  const startedAt = new Date().toISOString();

  log.info("processing ticket");

  const context = await cinq.getAutoResolveContext(job.data.ticketId);

  if (!context.project.auto_resolve_enabled) {
    await reportSkip(cinq, {
      ticketId: job.data.ticketId,
      runId,
      startedAt,
      reason: "auto-resolve disabled on project",
    });
    return;
  }

  await cinq.reportRun({
    ticket_id: job.data.ticketId,
    run_id: runId,
    status: "classifying",
    started_at: startedAt,
  });

  // ── Classifier ──
  let classification;
  try {
    classification = await classifyTicket(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "classifier call failed");
    await cinq.reportRun({
      ticket_id: job.data.ticketId,
      run_id: runId,
      status: "failed",
      error: `classifier failure: ${message}`,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    throw err;
  }

  const classifierCost = estimateCostUsd(
    env.ANTHROPIC_CLASSIFIER_MODEL,
    classification.usage.inputTokens,
    classification.usage.outputTokens,
  );

  log.info(
    {
      codable: classification.result.codable,
      confidence: classification.result.confidence,
      reason: classification.result.reason,
      costUsd: classifierCost,
    },
    "classifier verdict",
  );

  if (!classification.result.codable) {
    await cinq.reportRun({
      ticket_id: job.data.ticketId,
      run_id: runId,
      status: "skipped",
      skip_reason: classification.result.reason,
      tokens_input: classification.usage.inputTokens,
      tokens_output: classification.usage.outputTokens,
      cost_usd: classifierCost,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    return;
  }

  if (!context.project.repo_url) {
    await reportSkip(cinq, {
      ticketId: job.data.ticketId,
      runId,
      startedAt,
      reason: "project has no repo_url",
      tokensInput: classification.usage.inputTokens,
      tokensOutput: classification.usage.outputTokens,
      costUsd: classifierCost,
    });
    return;
  }

  // ── Clone (used by both stack detection and agent) ──
  let cloned = null as Awaited<ReturnType<typeof cloneRepo>> | null;
  try {
    try {
      cloned = await cloneRepo({
        repoUrl: context.project.repo_url,
        branch: context.project.repo_default_branch,
        workdirSlug: makeWorkdirSlug(job.data.ticketId, runId),
      });
    } catch (err) {
      if (err instanceof RepoNotAllowedError) {
        await reportSkip(cinq, {
          ticketId: job.data.ticketId,
          runId,
          startedAt,
          reason: err.message,
          tokensInput: classification.usage.inputTokens,
          tokensOutput: classification.usage.outputTokens,
          costUsd: classifierCost,
        });
        return;
      }
      throw err;
    }

    // ── Stack detection (only if cache stale) ──
    let detectedStack: DetectedStack | null = null;
    const cacheFresh = isStackCacheFresh(
      context.project.detected_stack_at,
      env.STACK_CACHE_DAYS,
    );
    if (cacheFresh) {
      detectedStack = (context.project.detected_stack ??
        null) as DetectedStack | null;
      log.info("stack cache fresh, using cached value");
    } else {
      log.info("detecting stack");
      detectedStack = await detectStack(cloned.path);
      try {
        await cinq.putDetectedStack(
          context.project.id,
          detectedStack as unknown as Record<string, unknown>,
        );
      } catch (err) {
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "failed to persist detected_stack cache",
        );
      }
    }

    // ── Agent ──
    await cinq.reportRun({
      ticket_id: job.data.ticketId,
      run_id: runId,
      status: "running",
      started_at: startedAt,
    });

    const agent = await runAgent({
      context,
      detectedStack,
      repoPath: cloned.path,
    });

    const totalTokensInput =
      classification.usage.inputTokens + agent.tokensInput;
    const totalTokensOutput =
      classification.usage.outputTokens + agent.tokensOutput;
    const totalCost = Number((classifierCost + agent.costUsd).toFixed(4));

    if (agent.timedOut) {
      await cinq.reportRun({
        ticket_id: job.data.ticketId,
        run_id: runId,
        status: "failed",
        error: `agent timed out after ${env.AGENT_TIMEOUT_MS}ms`,
        agent_summary: agent.summary,
        tokens_input: totalTokensInput,
        tokens_output: totalTokensOutput,
        cost_usd: totalCost,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return;
    }

    if (!agent.success) {
      await cinq.reportRun({
        ticket_id: job.data.ticketId,
        run_id: runId,
        status: "failed",
        error: `agent finished without success (stop_reason=${agent.stopReason ?? "unknown"})`,
        agent_summary: agent.summary,
        tokens_input: totalTokensInput,
        tokens_output: totalTokensOutput,
        cost_usd: totalCost,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return;
    }

    // ── Capture diff & scan for secrets ──
    const diff = await captureRepoDiff(cloned.path);

    if (diff.isEmpty) {
      await cinq.reportRun({
        ticket_id: job.data.ticketId,
        run_id: runId,
        status: "skipped",
        skip_reason: "agent did not produce any changes",
        agent_summary: agent.summary,
        tokens_input: totalTokensInput,
        tokens_output: totalTokensOutput,
        cost_usd: totalCost,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return;
    }

    const scan = await scanDiffForSecrets(diff.patch);
    if (scan.findings.length > 0) {
      log.error(
        {
          scanner: scan.scanner,
          findings: scan.findings.map((f) => ({
            rule: f.rule,
            source: f.source,
          })),
        },
        "secret scan flagged the diff, aborting",
      );
      await cinq.reportRun({
        ticket_id: job.data.ticketId,
        run_id: runId,
        status: "failed",
        error: `secret scan flagged ${scan.findings.length} match(es) (${scan.scanner}): ${scan.findings.map((f) => f.rule).join(", ")}`,
        agent_summary: agent.summary,
        tokens_input: totalTokensInput,
        tokens_output: totalTokensOutput,
        cost_usd: totalCost,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return;
    }

    // ── Branch + repo identity ──
    const branchName = makeBranchName(
      job.data.ticketId,
      context.ticket.title,
    );
    const repoFullName = context.project.repo_name
      ? `agencecinq/${context.project.repo_name}`
      : getRepoFullNameFromUrl(context.project.repo_url);

    if (env.DRY_RUN) {
      const slackTs = await postDryRunSlack(
        context,
        job.data.ticketId,
        branchName,
        repoFullName,
        agent,
        diff,
        totalCost,
        totalTokensInput,
        totalTokensOutput,
        log,
      );
      await cinq.reportRun({
        ticket_id: job.data.ticketId,
        run_id: runId,
        status: "skipped",
        skip_reason:
          "[dry-run] diff captured, posted to Slack — no PR opened",
        branch_name: branchName,
        slack_ts: slackTs,
        agent_summary: agent.summary,
        tokens_input: totalTokensInput,
        tokens_output: totalTokensOutput,
        cost_usd: totalCost,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return;
    }

    // ── Live path: PR summary → commit → push → PR draft → Slack ──
    let prSummary;
    try {
      prSummary = await generatePrSummary({
        ticketTitle: context.ticket.title,
        ticketDescription: context.ticket.description,
        diff: diff.patch,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "PR summary generation failed");
      await cinq.reportRun({
        ticket_id: job.data.ticketId,
        run_id: runId,
        status: "failed",
        error: `PR summary generation failed: ${message}`,
        branch_name: branchName,
        agent_summary: agent.summary,
        tokens_input: totalTokensInput,
        tokens_output: totalTokensOutput,
        cost_usd: totalCost,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return;
    }

    const prSummaryCost = estimateCostUsd(
      env.ANTHROPIC_CLASSIFIER_MODEL,
      prSummary.usage.inputTokens,
      prSummary.usage.outputTokens,
    );
    const tokensInputAll = totalTokensInput + prSummary.usage.inputTokens;
    const tokensOutputAll = totalTokensOutput + prSummary.usage.outputTokens;
    const costAll = Number((totalCost + prSummaryCost).toFixed(4));

    let commitSha: string;
    try {
      const result = await commitAndPush({
        repoPath: cloned.path,
        branchName,
        ticketId: job.data.ticketId,
        prTitle: prSummary.summary.title,
        prBody: prSummary.summary.body,
      });
      commitSha = result.commitSha;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "commit/push failed");
      await cinq.reportRun({
        ticket_id: job.data.ticketId,
        run_id: runId,
        status: "failed",
        error: `commit/push failed: ${message}`,
        branch_name: branchName,
        agent_summary: agent.summary,
        tokens_input: tokensInputAll,
        tokens_output: tokensOutputAll,
        cost_usd: costAll,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return;
    }

    let pr;
    try {
      pr = await createDraftPullRequest({
        repoUrl: context.project.repo_url,
        branch: branchName,
        baseBranch: context.project.repo_default_branch,
        title: prSummary.summary.title,
        body: prSummary.summary.body,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "PR creation failed");
      await cinq.reportRun({
        ticket_id: job.data.ticketId,
        run_id: runId,
        status: "failed",
        error: `PR creation failed: ${message}`,
        branch_name: branchName,
        commit_sha: commitSha,
        agent_summary: agent.summary,
        tokens_input: tokensInputAll,
        tokens_output: tokensOutputAll,
        cost_usd: costAll,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
      return;
    }

    log.info(
      { prUrl: pr.url, prNumber: pr.number, branchName, commitSha },
      "PR draft opened",
    );

    let slackTs: string | null = null;
    if (context.project.slack_channel_id) {
      try {
        const blocks = buildPrOpenedBlocks({
          ticketId: job.data.ticketId,
          ticketTitle: context.ticket.title,
          repoFullName,
          branchName,
          agentSummary: agent.summary,
          diffStats: diff.stats,
          durationMs: agent.durationMs,
          costUsd: costAll,
          tokensInput: tokensInputAll,
          tokensOutput: tokensOutputAll,
          prUrl: pr.url,
          prNumber: pr.number,
        });
        slackTs = await postSlackMessage({
          channel: context.project.slack_channel_id,
          text: buildPrOpenedPlainText({
            ticketId: job.data.ticketId,
            ticketTitle: context.ticket.title,
            repoFullName,
            branchName,
            agentSummary: agent.summary,
            diffStats: diff.stats,
            durationMs: agent.durationMs,
            costUsd: costAll,
            tokensInput: tokensInputAll,
            tokensOutput: tokensOutputAll,
            prUrl: pr.url,
            prNumber: pr.number,
          }),
          blocks,
        });
      } catch (err) {
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "Slack post failed, PR is live but message did not go through",
        );
      }
    } else {
      log.info("project has no slack_channel_id, skipping Slack post");
    }

    await cinq.reportRun({
      ticket_id: job.data.ticketId,
      run_id: runId,
      status: "pr_opened",
      pr_url: pr.url,
      pr_number: pr.number,
      branch_name: branchName,
      commit_sha: commitSha,
      slack_ts: slackTs,
      agent_summary: agent.summary,
      tokens_input: tokensInputAll,
      tokens_output: tokensOutputAll,
      cost_usd: costAll,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
  } finally {
    if (cloned) {
      try {
        await cloned.cleanup();
      } catch (err) {
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "cleanup of clone failed",
        );
      }
    }
  }
}

async function reportSkip(
  cinq: CinqCentralClient,
  args: {
    ticketId: number;
    runId: string;
    startedAt: string;
    reason: string;
    tokensInput?: number;
    tokensOutput?: number;
    costUsd?: number;
  },
): Promise<void> {
  await cinq.reportRun({
    ticket_id: args.ticketId,
    run_id: args.runId,
    status: "skipped",
    skip_reason: args.reason,
    tokens_input: args.tokensInput,
    tokens_output: args.tokensOutput,
    cost_usd: args.costUsd,
    started_at: args.startedAt,
    finished_at: new Date().toISOString(),
  });
}

async function postDryRunSlack(
  context: AutoResolveContext,
  ticketId: number,
  branchName: string,
  repoFullName: string,
  agent: { summary: string; durationMs: number },
  diff: { stats: import("../lib/git-diff.js").DiffStats },
  costUsd: number,
  tokensInput: number,
  tokensOutput: number,
  log: import("pino").Logger,
): Promise<string | null> {
  if (!context.project.slack_channel_id) {
    log.info("project has no slack_channel_id, skipping Slack post");
    return null;
  }
  const payload = {
    ticketId,
    ticketTitle: context.ticket.title,
    repoFullName,
    branchName,
    agentSummary: agent.summary,
    diffStats: diff.stats,
    durationMs: agent.durationMs,
    costUsd,
    tokensInput,
    tokensOutput,
  };
  try {
    return await postSlackMessage({
      channel: context.project.slack_channel_id,
      text: buildDryRunPlainText(payload),
      blocks: buildDryRunBlocks(payload),
    });
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Slack post failed, continuing",
    );
    return null;
  }
}

// Re-export for type-only consumers (tests).
export type { AutoResolveContext };
