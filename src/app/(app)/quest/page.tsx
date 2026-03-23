import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuestDashboard } from "./quest-dashboard";

export default async function QuestPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Only admin and equipe can access quest
  if (session.user.role === "client") redirect("/dashboard");

  const [completions, badges] = await Promise.all([
    prisma.questCompletion.findMany({
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.questBadge.findMany(),
  ]);

  const initialCompletions = completions.map((c) => ({
    taskId: c.taskId,
    completedBy: c.completedBy,
    completedByName: c.user.name,
    completedAt: c.completedAt.toISOString(),
  }));

  const initialBadges = badges.map((b) => ({
    badgeId: b.badgeId,
    unlockedAt: b.unlockedAt.toISOString(),
  }));

  return (
    <QuestDashboard
      initialCompletions={initialCompletions}
      initialBadges={initialBadges}
    />
  );
}
