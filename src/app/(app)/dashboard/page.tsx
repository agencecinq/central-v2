import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { RailDashboard } from "./rail-dashboard";
import {
  getActiveProjects,
  getUserTasks,
  getOpenTickets,
  getFinanceSummary,
  getWeeklyTime,
  getQuestProgression,
  getYearlyPipeline,
} from "./lib/dashboard-queries";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "client") redirect("/espace-client");

  const userId = parseInt(session.user.id);
  const userIsAdmin = isAdmin(session.user.role);

  const [projects, tasks, tickets, finance, weeklyTime, questData, pipelineData, clients] = await Promise.all([
    getActiveProjects(),
    getUserTasks(userId),
    getOpenTickets(),
    userIsAdmin ? getFinanceSummary() : Promise.resolve(null),
    getWeeklyTime(userId),
    getQuestProgression(),
    userIsAdmin ? getYearlyPipeline() : Promise.resolve(null),
    prisma.client.findMany({
      select: { id: true, nom: true, entreprise: true },
      orderBy: { entreprise: "asc" },
      take: 20,
    }),
  ]);

  const firstName = session.user.name?.split(" ")[0] ?? "";

  return (
    <RailDashboard
      data={{
        firstName,
        projects,
        tasks,
        tickets,
        finance,
        weeklyTime,
        quest: questData,
        pipeline: pipelineData,
        pinnedProjects: projects.slice(0, 3).map((p) => ({
          code: (p.titre.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 3) || "PRJ").toUpperCase(),
          nom: p.titre,
        })),
        clients: clients.map((c) => ({ id: c.id, nom: c.entreprise ?? c.nom })),
      }}
    />
  );
}
