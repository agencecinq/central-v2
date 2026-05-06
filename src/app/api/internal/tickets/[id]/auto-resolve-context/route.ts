import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internal-auth";

const AGENCECINQ_REPO_PREFIX = "https://github.com/agencecinq/";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authError = checkInternalAuth(req);
  if (authError) return authError;

  const { id } = await ctx.params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      assigne: { select: { email: true } },
      project: {
        select: {
          id: true,
          titre: true,
          githubUrl: true,
          githubRepoName: true,
          repoDefaultBranch: true,
          slackChannelId: true,
          autoResolveEnabled: true,
          detectedStack: true,
          detectedStackAt: true,
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const repoUrl = ticket.project.githubUrl ?? null;
  const isAgenceCinqRepo =
    !!repoUrl && repoUrl.toLowerCase().startsWith(AGENCECINQ_REPO_PREFIX);

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      title: ticket.titre,
      description: ticket.description,
      labels: [] as string[],
      assignee_email: ticket.assigne?.email ?? null,
      created_at: ticket.createdAt,
    },
    project: {
      id: ticket.project.id,
      name: ticket.project.titre,
      repo_url: repoUrl,
      repo_name: ticket.project.githubRepoName,
      repo_default_branch: ticket.project.repoDefaultBranch ?? "main",
      slack_channel_id: ticket.project.slackChannelId,
      auto_resolve_enabled:
        ticket.project.autoResolveEnabled && isAgenceCinqRepo,
      detected_stack: ticket.project.detectedStack,
      detected_stack_at: ticket.project.detectedStackAt,
    },
  });
}
