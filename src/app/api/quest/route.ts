import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — fetch all completions + badges
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const [completions, badges] = await Promise.all([
    prisma.questCompletion.findMany({
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.questBadge.findMany(),
  ]);

  return NextResponse.json({
    completions: completions.map((c) => ({
      taskId: c.taskId,
      completedBy: c.completedBy,
      completedByName: c.user.name,
      completedAt: c.completedAt.toISOString(),
    })),
    badges: badges.map((b) => ({
      badgeId: b.badgeId,
      unlockedAt: b.unlockedAt.toISOString(),
    })),
  });
}

// POST — toggle a task (check/uncheck)
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { taskId, badgesToAdd, badgesToRemove } = body as {
    taskId: string;
    badgesToAdd?: string[];
    badgesToRemove?: string[];
  };

  if (!taskId) {
    return NextResponse.json({ error: "taskId requis" }, { status: 400 });
  }

  const userId = Number(session.user.id);

  // Check if already completed
  const existing = await prisma.questCompletion.findUnique({
    where: { taskId },
  });

  if (existing) {
    // Uncheck
    await prisma.questCompletion.delete({ where: { taskId } });
  } else {
    // Check
    await prisma.questCompletion.create({
      data: { taskId, completedBy: userId },
    });
  }

  // Sync badges
  if (badgesToAdd && badgesToAdd.length > 0) {
    for (const badgeId of badgesToAdd) {
      await prisma.questBadge.upsert({
        where: { badgeId },
        create: { badgeId },
        update: {},
      });
    }
  }

  if (badgesToRemove && badgesToRemove.length > 0) {
    await prisma.questBadge.deleteMany({
      where: { badgeId: { in: badgesToRemove } },
    });
  }

  return NextResponse.json({ ok: true, action: existing ? "unchecked" : "checked" });
}
