import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TimeTracker } from "./time-tracker";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Return ISO week string for a Date, e.g. "2026-W11" */
function isoWeek(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ─── data fetching ──────────────────────────────────────────────────────────

async function getTimetrackingData(userId: number) {
  // Active projects (not archived)
  const projects = await prisma.project.findMany({
    where: {
      statut: { not: "archive" },
    },
    select: {
      id: true,
      titre: true,
      client: { select: { entreprise: true, nom: true } },
    },
    orderBy: { titre: "asc" },
  });

  // Tasks assigned to user or from active projects
  const tasks = await prisma.task.findMany({
    where: {
      estTerminee: false,
      project: { statut: { not: "archive" } },
    },
    select: {
      id: true,
      titre: true,
      projectId: true,
      project: { select: { titre: true } },
    },
    orderBy: { titre: "asc" },
  });

  // All time entries for this user (last 6 months worth)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const minWeek = isoWeek(sixMonthsAgo);

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      semaine: { gte: minWeek },
    },
    include: {
      project: { select: { titre: true } },
      task: { select: { titre: true, project: { select: { titre: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  // All users (for future: see other people's time)
  const users = await prisma.user.findMany({
    where: { role: { not: "client" } },
    select: { id: true, name: true, tjm: true },
    orderBy: { name: "asc" },
  });

  return {
    projects: projects.map((p) => ({
      id: p.id,
      titre: p.titre,
      clientName: p.client?.entreprise || p.client?.nom || "",
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      titre: t.titre,
      projectId: t.projectId,
      projectTitre: t.project.titre,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      projectId: e.projectId,
      taskId: e.taskId,
      semaine: e.semaine,
      duree: Number(e.duree),
      unite: e.unite as "heures" | "jours",
      categorie: e.categorie,
      description: e.description,
      projectTitre: e.project?.titre ?? e.task?.project.titre ?? null,
      taskTitre: e.task?.titre ?? null,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      tjm: u.tjm ? Number(u.tjm) : null,
    })),
  };
}

// ─── page ───────────────────────────────────────────────────────────────────

export default async function TimetrackingPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const currentWeek = isoWeek(new Date());
  const userId = Number(session.user.id);
  const data = await getTimetrackingData(userId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Timetracking</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Suivez le temps passé sur vos projets et tâches.
        </p>
      </div>

      <TimeTracker
        currentWeek={currentWeek}
        currentUserId={userId}
        projects={data.projects}
        tasks={data.tasks}
        entries={data.entries}
        users={data.users}
      />
    </div>
  );
}
