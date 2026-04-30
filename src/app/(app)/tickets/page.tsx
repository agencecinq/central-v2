import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TicketList } from "./ticket-list";
import { RailPageHeader, RailPageBody } from "@/components/rail/page-header";

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
  let ticketWhere: Prisma.TicketWhereInput | undefined;
  if (role === "client") {
    const userProjects = await prisma.userProject.findMany({
      where: { userId },
      select: { projectId: true },
    });
    if (userProjects.length === 0) redirect("/dashboard");
    ticketWhere = { projectId: { in: userProjects.map((up) => up.projectId) } };
  }

  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
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
  const clientProjectIds = ticketWhere && "projectId" in ticketWhere
    ? (ticketWhere.projectId as { in: number[] }).in
    : undefined;
  const projects = await prisma.project.findMany({
    where: {
      statut: { not: "archive" },
      ...(clientProjectIds ? { id: { in: clientProjectIds } } : {}),
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

  const openCount = serialized.filter((t) => t.statut === "ouvert").length;

  return (
    <>
      <RailPageHeader
        eyebrow="Support"
        title="Tickets"
        description={`${openCount} ouvert${openCount > 1 ? "s" : ""} · ${serialized.length} au total`}
      />
      <RailPageBody>
        <TicketList
          tickets={serialized}
          projects={projectOptions}
          users={users.map((u) => ({ id: u.id, name: u.name ?? "" }))}
          currentUserId={userId}
        />
      </RailPageBody>
    </>
  );
}
