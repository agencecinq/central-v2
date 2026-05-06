import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internal-auth";

const VALID_STATUSES = [
  "classifying",
  "running",
  "pr_opened",
  "skipped",
  "failed",
] as const;
type Status = (typeof VALID_STATUSES)[number];

type RunPayload = {
  ticket_id: number;
  run_id: string;
  status: Status;
  pr_url?: string | null;
  pr_number?: number | null;
  branch_name?: string | null;
  commit_sha?: string | null;
  slack_ts?: string | null;
  agent_summary?: string | null;
  skip_reason?: string | null;
  error?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  cost_usd?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export async function POST(req: NextRequest) {
  const authError = checkInternalAuth(req);
  if (authError) return authError;

  let body: RunPayload;
  try {
    body = (await req.json()) as RunPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.run_id || typeof body.run_id !== "string") {
    return NextResponse.json({ error: "run_id is required" }, { status: 400 });
  }
  if (!Number.isInteger(body.ticket_id)) {
    return NextResponse.json(
      { error: "ticket_id must be an integer" },
      { status: 400 },
    );
  }
  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: body.ticket_id },
    select: { id: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const isTerminal =
    body.status === "pr_opened" ||
    body.status === "skipped" ||
    body.status === "failed";

  const finishedAt = body.finished_at
    ? new Date(body.finished_at)
    : isTerminal
      ? new Date()
      : null;

  await prisma.$transaction([
    prisma.autoResolveRun.upsert({
      where: { id: body.run_id },
      create: {
        id: body.run_id,
        ticketId: body.ticket_id,
        status: body.status,
        startedAt: body.started_at ? new Date(body.started_at) : new Date(),
        finishedAt,
        branchName: body.branch_name ?? null,
        commitSha: body.commit_sha ?? null,
        prNumber: body.pr_number ?? null,
        prUrl: body.pr_url ?? null,
        slackTs: body.slack_ts ?? null,
        tokensInput: body.tokens_input ?? null,
        tokensOutput: body.tokens_output ?? null,
        costUsd: body.cost_usd ?? null,
        agentSummary: body.agent_summary ?? null,
        error: body.error ?? null,
      },
      update: {
        status: body.status,
        finishedAt,
        branchName: body.branch_name ?? undefined,
        commitSha: body.commit_sha ?? undefined,
        prNumber: body.pr_number ?? undefined,
        prUrl: body.pr_url ?? undefined,
        slackTs: body.slack_ts ?? undefined,
        tokensInput: body.tokens_input ?? undefined,
        tokensOutput: body.tokens_output ?? undefined,
        costUsd: body.cost_usd ?? undefined,
        agentSummary: body.agent_summary ?? undefined,
        error: body.error ?? undefined,
      },
    }),
    prisma.ticket.update({
      where: { id: body.ticket_id },
      data: {
        autoResolveStatus: body.status,
        autoResolveRunId: body.run_id,
        autoResolvePrUrl: body.pr_url ?? undefined,
        autoResolveSkipReason: body.skip_reason ?? undefined,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
