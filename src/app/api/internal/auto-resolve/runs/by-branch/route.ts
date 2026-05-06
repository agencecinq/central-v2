import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internal-auth";

/**
 * Lookup the most recent auto-resolve run for a given branch name. Used by
 * the worker when it receives a GitHub `workflow_run.completed` webhook and
 * needs to find the matching PR/Slack thread to react against.
 */
export async function GET(req: NextRequest) {
  const authError = checkInternalAuth(req);
  if (authError) return authError;

  const branch = req.nextUrl.searchParams.get("branch");
  if (!branch) {
    return NextResponse.json(
      { error: "branch query parameter is required" },
      { status: 400 },
    );
  }

  const run = await prisma.autoResolveRun.findFirst({
    where: { branchName: branch, status: "pr_opened" },
    orderBy: { startedAt: "desc" },
    include: {
      ticket: {
        select: {
          id: true,
          titre: true,
          project: {
            select: {
              id: true,
              titre: true,
              slackChannelId: true,
              githubRepoName: true,
              githubUrl: true,
            },
          },
        },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    run: {
      id: run.id,
      ticket_id: run.ticketId,
      ticket_title: run.ticket.titre,
      branch_name: run.branchName,
      pr_number: run.prNumber,
      pr_url: run.prUrl,
      commit_sha: run.commitSha,
      slack_ts: run.slackTs,
      status: run.status,
      project: {
        id: run.ticket.project.id,
        name: run.ticket.project.titre,
        slack_channel_id: run.ticket.project.slackChannelId,
        repo_url: run.ticket.project.githubUrl,
        repo_name: run.ticket.project.githubRepoName,
      },
    },
  });
}
