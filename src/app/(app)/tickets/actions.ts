"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import path from "path";

// ─── Helpers ──────────────────────────────────────────────

async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  const userId = parseInt(session.user.id);
  const role = session.user.role;
  return { userId, role };
}

/** Vérifie que l'utilisateur client a accès au projet */
async function assertClientAccess(userId: number, projectId: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { clientId: true },
  });
  if (!user.clientId) throw new Error("Accès refusé");
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { clientId: true },
  });
  if (project.clientId !== user.clientId) throw new Error("Accès refusé");
}

// ─── Tickets ──────────────────────────────────────────────

export async function createTicket(formData: FormData) {
  const { userId, role } = await getSessionUser();

  const titre = formData.get("titre") as string;
  if (!titre?.trim()) throw new Error("Le titre est requis");

  const projectId = parseInt(formData.get("projectId") as string);
  if (isNaN(projectId)) throw new Error("Le projet est requis");

  // Client access check
  if (role === "client") {
    await assertClientAccess(userId, projectId);
  }

  // Par défaut, assigner au chef de projet du projet
  let assigneId: number | null = null;
  const assigneRaw = formData.get("assigneId") as string;
  if (assigneRaw) {
    assigneId = parseInt(assigneRaw);
  } else {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { chefProjetId: true },
    });
    assigneId = project?.chefProjetId ?? null;
  }

  const ticket = await prisma.ticket.create({
    data: {
      projectId,
      createurId: userId,
      assigneId,
      titre: titre.trim(),
      description: (formData.get("description") as string) || null,
      statut: "ouvert",
      navigateur: (formData.get("navigateur") as string)?.trim() || null,
      tailleEcran: (formData.get("tailleEcran") as string)?.trim() || null,
      metaInfo: (formData.get("metaInfo") as string)?.trim() || null,
    },
  });

  revalidatePath("/tickets");
  return ticket.id;
}

export async function updateTicket(ticketId: number, formData: FormData) {
  const { userId, role } = await getSessionUser();

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    select: { projectId: true },
  });

  if (role === "client") {
    await assertClientAccess(userId, ticket.projectId);
  }

  const titre = formData.get("titre") as string;
  if (!titre?.trim()) throw new Error("Le titre est requis");

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      titre: titre.trim(),
      description: (formData.get("description") as string) || null,
      statut: (formData.get("statut") as string) || "ouvert",
      assigneId: formData.get("assigneId")
        ? parseInt(formData.get("assigneId") as string)
        : null,
      navigateur: (formData.get("navigateur") as string)?.trim() || null,
      tailleEcran: (formData.get("tailleEcran") as string)?.trim() || null,
      metaInfo: (formData.get("metaInfo") as string)?.trim() || null,
    },
  });

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${ticketId}`);
}

export async function updateTicketStatus(ticketId: number, statut: string) {
  const { userId, role } = await getSessionUser();

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    select: { projectId: true },
  });

  if (role === "client") {
    await assertClientAccess(userId, ticket.projectId);
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { statut },
  });

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${ticketId}`);
}

export async function updateTicketAssigne(ticketId: number, assigneId: number | null) {
  const { userId, role } = await getSessionUser();

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    select: { projectId: true },
  });

  if (role === "client") {
    await assertClientAccess(userId, ticket.projectId);
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { assigneId },
  });

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${ticketId}`);
}

export async function deleteTicket(ticketId: number) {
  const { userId, role } = await getSessionUser();

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { attachments: true },
  });

  if (role === "client") {
    await assertClientAccess(userId, ticket.projectId);
  }

  // Supprimer les fichiers physiques
  for (const att of ticket.attachments) {
    try {
      await unlink(path.join(process.cwd(), "public", att.filepath));
    } catch {
      // fichier déjà supprimé, on ignore
    }
  }

  await prisma.ticket.delete({ where: { id: ticketId } });

  revalidatePath("/tickets");
}

// ─── Bulk Actions ────────────────────────────────────────

export async function bulkUpdateStatus(ticketIds: number[], statut: string) {
  await getSessionUser();

  await prisma.ticket.updateMany({
    where: { id: { in: ticketIds } },
    data: { statut },
  });

  revalidatePath("/tickets");
}

export async function bulkUpdateAssigne(ticketIds: number[], assigneId: number | null) {
  await getSessionUser();

  await prisma.ticket.updateMany({
    where: { id: { in: ticketIds } },
    data: { assigneId },
  });

  revalidatePath("/tickets");
}

export async function bulkDeleteTickets(ticketIds: number[]) {
  await getSessionUser();

  // Récupérer les attachments pour supprimer les fichiers
  const attachments = await prisma.ticketAttachment.findMany({
    where: { ticketId: { in: ticketIds } },
    select: { filepath: true },
  });

  for (const att of attachments) {
    try {
      await unlink(path.join(process.cwd(), "public", att.filepath));
    } catch {
      // fichier déjà supprimé
    }
  }

  await prisma.ticketAttachment.deleteMany({
    where: { ticketId: { in: ticketIds } },
  });
  await prisma.ticket.deleteMany({
    where: { id: { in: ticketIds } },
  });

  revalidatePath("/tickets");
}

export async function deleteAttachment(attachmentId: number) {
  const { userId, role } = await getSessionUser();

  const attachment = await prisma.ticketAttachment.findUniqueOrThrow({
    where: { id: attachmentId },
    include: { ticket: { select: { id: true, projectId: true } } },
  });

  if (role === "client") {
    await assertClientAccess(userId, attachment.ticket.projectId);
  }

  // Supprimer le fichier physique
  try {
    await unlink(path.join(process.cwd(), "public", attachment.filepath));
  } catch {
    // fichier déjà supprimé
  }

  await prisma.ticketAttachment.delete({ where: { id: attachmentId } });

  revalidatePath(`/tickets/${attachment.ticket.id}`);
}
