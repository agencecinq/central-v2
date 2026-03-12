import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TicketList } from "./ticket-list";

function getWidgetLabel(metaInfo: string | null): string {
  if (!metaInfo) return "Widget";
  try {
    const parsed = JSON.parse(metaInfo);
    if (parsed.source === "widget" && parsed.email) {
      return `Widget (${parsed.email})`;
    }
  } catch {}
  return "Widget";
}

export default async function TicketsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id);
  const role = session.user.role;

  // Filtre par accès client
  let projectFilter: { clientId?: number } | undefined;
  if (role === "client") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { clientId: true },
    });
    if (!user?.clientId) redirect("/dashboard");
    projectFilter = { clientId: user.clientId };
  }

  const tickets = await prisma.ticket.findMany({
    where: projectFilter ? { project: projectFilter } : undefined,
    include: {
      project: { select: { id: true, titre: true, chefProjetId: true, statut: true } },
      createur: { select: { id: true, name: true } },
      assigne: { select: { id: true, name: true } },
      _count: { select: { attachments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = tickets.map((t) => ({
    id: t.id,
    titre: t.titre,
    statut: t.statut,
    projectId: t.projectId,
    projectTitre: t.project.titre,
    projectStatut: t.project.statut,
    projectChefProjetId: t.project.chefProjetId,
    createurName: t.createur?.name ?? getWidgetLabel(t.metaInfo),
    assigneId: t.assigneId,
    assigneName: t.assigne?.name ?? null,
    attachmentCount: t._count.attachments,
    createdAt: t.createdAt?.toISOString() ?? null,
  }));

  // Projets pour le dialog de création
  const projects = await prisma.project.findMany({
    where: {
      statut: { not: "archive" },
      ...(projectFilter ?? {}),
    },
    select: {
      id: true,
      titre: true,
      chefProjetId: true,
      client: { select: { entreprise: true, nom: true } },
    },
    orderBy: { titre: "asc" },
  });

  const projectOptions = projects.map((p) => ({
    id: p.id,
    titre: p.titre,
    chefProjetId: p.chefProjetId,
    clientName: p.client?.entreprise ?? p.client?.nom ?? null,
  }));

  // Utilisateurs pour l'assignation
  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "equipe"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tickets</h2>
        <p className="mt-1 text-muted-foreground">
          Suivez et gérez les tickets de vos projets.
        </p>
      </div>

      <TicketList
        tickets={serialized}
        projects={projectOptions}
        users={users.map((u) => ({ id: u.id, name: u.name ?? "" }))}
        currentUserId={userId}
      />
    </div>
  );
}
