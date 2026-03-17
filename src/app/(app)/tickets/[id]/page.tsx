import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TicketDetail } from "./ticket-detail";

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

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id);
  const role = session.user.role;

  const { id } = await params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) notFound();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      project: { select: { id: true, titre: true, clientId: true } },
      createur: { select: { id: true, name: true } },
      assigne: { select: { id: true, name: true } },
      attachments: { orderBy: { createdAt: "desc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { auteur: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  if (!ticket) notFound();

  // Client access check
  if (role === "client") {
    const hasAccess = await prisma.userProject.findUnique({
      where: { userId_projectId: { userId, projectId: ticket.project.id } },
    });
    if (!hasAccess) notFound();
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "equipe"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const serializedTicket = {
    id: ticket.id,
    titre: ticket.titre,
    description: ticket.description,
    statut: ticket.statut,
    projectId: ticket.projectId,
    projectTitre: ticket.project.titre,
    createurId: ticket.createurId,
    createurName: ticket.createur?.name ?? getWidgetLabel(ticket.metaInfo),
    assigneId: ticket.assigneId,
    assigneName: ticket.assigne?.name ?? null,
    navigateur: ticket.navigateur,
    tailleEcran: ticket.tailleEcran,
    metaInfo: ticket.metaInfo,
    createdAt: ticket.createdAt?.toISOString() ?? null,
    updatedAt: ticket.updatedAt?.toISOString() ?? null,
    attachments: ticket.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      filepath: a.filepath,
      mimetype: a.mimetype,
      size: a.size,
      createdAt: a.createdAt?.toISOString() ?? null,
    })),
    comments: ticket.comments.map((c) => ({
      id: c.id,
      contenu: c.contenu,
      auteurId: c.auteurId,
      auteurName: c.auteur.name ?? "Utilisateur",
      auteurRole: c.auteur.role ?? "equipe",
      createdAt: c.createdAt?.toISOString() ?? null,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/tickets"
          className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight truncate">
            {ticket.titre}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ticket.project.titre} · Créé par {ticket.createur?.name ?? getWidgetLabel(ticket.metaInfo)}
          </p>
        </div>
      </div>

      <TicketDetail
        ticket={serializedTicket}
        users={users.map((u) => ({ id: u.id, name: u.name ?? "" }))}
        currentUserId={userId}
      />
    </div>
  );
}
