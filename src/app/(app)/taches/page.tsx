import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RailPageHeader, RailPageBody } from "@/components/rail/page-header";
import { TaskList } from "./task-list";

export default async function TachesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "client") redirect("/dashboard");

  const userId = parseInt(session.user.id);

  // Fetch all tasks across active projects (admin sees all, equipe sees all + own focus)
  const tasks = await prisma.task.findMany({
    where: {
      project: { statut: { not: "archive" } },
    },
    select: {
      id: true,
      titre: true,
      description: true,
      statutKanban: true,
      priorite: true,
      priorityLevel: true,
      categorie: true,
      estTerminee: true,
      dateEcheance: true,
      estimationHeures: true,
      isOutOfScope: true,
      isBacklog: true,
      project: {
        select: {
          id: true,
          titre: true,
          statut: true,
          client: { select: { entreprise: true, nom: true } },
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: [
      { estTerminee: "asc" },
      { priorityLevel: "desc" },
      { dateEcheance: "asc" },
    ],
    take: 500,
  });

  const projects = await prisma.project.findMany({
    where: { statut: { not: "archive" } },
    select: { id: true, titre: true },
    orderBy: { titre: "asc" },
  });

  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "equipe"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const serialized = tasks.map((t) => ({
    id: t.id,
    titre: t.titre,
    statutKanban: t.statutKanban,
    priorite: t.priorite,
    priorityLevel: t.priorityLevel,
    categorie: t.categorie,
    estTerminee: t.estTerminee,
    dateEcheance: t.dateEcheance?.toISOString().slice(0, 10) ?? null,
    estimationHeures: t.estimationHeures ? Number(t.estimationHeures) : null,
    isOutOfScope: t.isOutOfScope,
    isBacklog: t.isBacklog,
    projectId: t.project.id,
    projectTitre: t.project.titre,
    projectStatut: t.project.statut,
    clientName: t.project.client?.entreprise ?? t.project.client?.nom ?? null,
    assigneId: t.user?.id ?? null,
    assigneName: t.user?.name ?? null,
  }));

  const myCount = serialized.filter(
    (t) => t.assigneId === userId && !t.estTerminee,
  ).length;

  return (
    <>
      <RailPageHeader
        eyebrow="Tâches"
        title="Toutes les tâches"
        description={`${serialized.length} tâches au total · ${myCount} assignées à moi (non terminées)`}
      />
      <RailPageBody>
        <TaskList
          tasks={serialized}
          projects={projects}
          users={users.map((u) => ({ id: u.id, name: u.name ?? "" }))}
          currentUserId={userId}
        />
      </RailPageBody>
    </>
  );
}
