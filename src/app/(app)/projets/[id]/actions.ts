"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ─── Widget Token ────────────────────────────────────────

export async function generateWidgetToken(projectId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex"); // 64-char hex

  await prisma.project.update({
    where: { id: projectId },
    data: { widgetToken: token },
  });

  revalidatePath(`/projets/${projectId}`);
  return token;
}

// ─── Project ─────────────────────────────────────────────

export async function createProject(formData: FormData) {
  const titre = formData.get("titre") as string;
  if (!titre?.trim()) throw new Error("Le titre est requis");

  const project = await prisma.project.create({
    data: {
      titre: titre.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      statut: (formData.get("statut") as string) || "en_attente",
      clientId: formData.get("clientId")
        ? parseInt(formData.get("clientId") as string)
        : null,
      chefProjetId: formData.get("chefProjetId")
        ? parseInt(formData.get("chefProjetId") as string)
        : null,
      dealId: formData.get("dealId")
        ? parseInt(formData.get("dealId") as string)
        : null,
      budgetTotal: formData.get("budgetTotal")
        ? parseFloat(formData.get("budgetTotal") as string)
        : 0,
      dateDebut: formData.get("dateDebut")
        ? new Date(formData.get("dateDebut") as string)
        : null,
      deadline: formData.get("deadline")
        ? new Date(formData.get("deadline") as string)
        : null,
    },
  });

  revalidatePath("/projets");
  return project.id;
}

export async function deleteProject(projectId: number) {
  // Delete all related data in dependency order, then the project itself
  await prisma.$transaction([
    prisma.timeEntry.deleteMany({ where: { projectId } }),
    prisma.ticketAttachment.deleteMany({
      where: { ticket: { projectId } },
    }),
    prisma.ticket.deleteMany({ where: { projectId } }),
    prisma.task.deleteMany({ where: { projectId } }),
    prisma.transaction.deleteMany({ where: { projectId } }),
    prisma.projectAllocation.deleteMany({ where: { projectId } }),
    prisma.project.delete({ where: { id: projectId } }),
  ]);

  revalidatePath("/projets");
  redirect("/projets");
}

export async function updateProject(projectId: number, formData: FormData) {
  const titre = formData.get("titre") as string;
  if (!titre?.trim()) throw new Error("Le titre est requis");

  await prisma.project.update({
    where: { id: projectId },
    data: {
      titre: titre.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      statut: (formData.get("statut") as string) || "en_attente",
      clientId: formData.get("clientId")
        ? parseInt(formData.get("clientId") as string)
        : null,
      chefProjetId: formData.get("chefProjetId")
        ? parseInt(formData.get("chefProjetId") as string)
        : null,
      dealId: formData.get("dealId")
        ? parseInt(formData.get("dealId") as string)
        : null,
      budgetTotal: formData.get("budgetTotal")
        ? parseFloat(formData.get("budgetTotal") as string)
        : 0,
      dateDebut: formData.get("dateDebut")
        ? new Date(formData.get("dateDebut") as string)
        : null,
      deadline: formData.get("deadline")
        ? new Date(formData.get("deadline") as string)
        : null,
      githubUrl: (formData.get("githubUrl") as string)?.trim() || null,
      figmaUrl: (formData.get("figmaUrl") as string)?.trim() || null,
    },
  });

  revalidatePath(`/projets/${projectId}`);
  revalidatePath("/projets");
}

// ─── Tasks ───────────────────────────────────────────────

export async function createTask(projectId: number, formData: FormData) {
  const titre = formData.get("titre") as string;
  if (!titre?.trim()) throw new Error("Le titre est requis");

  await prisma.task.create({
    data: {
      projectId,
      titre: titre.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      statutKanban: (formData.get("statutKanban") as string) || "todo",
      categorie: (formData.get("categorie") as string)?.trim() || null,
      priorityLevel: parseInt(formData.get("priorityLevel") as string) || 1,
      estimationHeures: formData.get("estimationHeures")
        ? parseFloat(formData.get("estimationHeures") as string)
        : null,
      dateEcheance: formData.get("dateEcheance")
        ? new Date(formData.get("dateEcheance") as string)
        : null,
      userId: formData.get("userId")
        ? parseInt(formData.get("userId") as string)
        : null,
      isOutOfScope: formData.get("isOutOfScope") === "true",
      dateDebut: formData.get("dateDebut")
        ? new Date(formData.get("dateDebut") as string)
        : null,
      allocationId: formData.get("allocationId")
        ? parseInt(formData.get("allocationId") as string)
        : null,
    },
  });

  revalidatePath(`/projets/${projectId}`);
}

export async function updateTask(taskId: number, projectId: number, formData: FormData) {
  const titre = formData.get("titre") as string;
  if (!titre?.trim()) throw new Error("Le titre est requis");

  await prisma.task.update({
    where: { id: taskId },
    data: {
      titre: titre.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      statutKanban: (formData.get("statutKanban") as string) || "todo",
      categorie: (formData.get("categorie") as string)?.trim() || null,
      priorityLevel: parseInt(formData.get("priorityLevel") as string) || 1,
      estimationHeures: formData.get("estimationHeures")
        ? parseFloat(formData.get("estimationHeures") as string)
        : null,
      dateEcheance: formData.get("dateEcheance")
        ? new Date(formData.get("dateEcheance") as string)
        : null,
      userId: formData.get("userId")
        ? parseInt(formData.get("userId") as string)
        : null,
      isOutOfScope: formData.get("isOutOfScope") === "true",
      dateDebut: formData.get("dateDebut")
        ? new Date(formData.get("dateDebut") as string)
        : null,
      allocationId: formData.get("allocationId")
        ? parseInt(formData.get("allocationId") as string)
        : null,
    },
  });

  revalidatePath(`/projets/${projectId}`);
}

export async function toggleTaskDone(taskId: number, projectId: number) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await prisma.task.update({
    where: { id: taskId },
    data: { statutKanban: task.statutKanban === "done" ? "todo" : "done" },
  });
  revalidatePath(`/projets/${projectId}`);
}

export async function deleteTask(taskId: number, projectId: number) {
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/projets/${projectId}`);
}

// ─── Transactions ────────────────────────────────────────

export async function createTransaction(projectId: number, formData: FormData) {
  const label = formData.get("label") as string;
  if (!label?.trim()) throw new Error("Le label est requis");

  const montant = parseFloat(formData.get("montant") as string);
  if (isNaN(montant) || montant <= 0) throw new Error("Le montant est requis");

  await prisma.transaction.create({
    data: {
      projectId,
      label: label.trim(),
      montant,
      type: (formData.get("type") as string) || "depense",
      categorie: (formData.get("categorie") as string)?.trim() || null,
      statut: (formData.get("statut") as string) || null,
      dateTransaction: new Date(formData.get("dateTransaction") as string),
    },
  });

  revalidatePath(`/projets/${projectId}`);
}

export async function updateTransaction(
  transactionId: number,
  projectId: number,
  formData: FormData,
) {
  const label = formData.get("label") as string;
  if (!label?.trim()) throw new Error("Le label est requis");

  const montant = parseFloat(formData.get("montant") as string);
  if (isNaN(montant) || montant <= 0) throw new Error("Le montant est requis");

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      label: label.trim(),
      montant,
      type: (formData.get("type") as string) || "depense",
      categorie: (formData.get("categorie") as string)?.trim() || null,
      statut: (formData.get("statut") as string) || null,
      dateTransaction: new Date(formData.get("dateTransaction") as string),
    },
  });

  revalidatePath(`/projets/${projectId}`);
}

export async function deleteTransaction(transactionId: number, projectId: number) {
  await prisma.transaction.delete({ where: { id: transactionId } });
  revalidatePath(`/projets/${projectId}`);
}

// ─── Phases (Planning) ──────────────────────────────────

export async function createPhase(
  projectId: number,
  metierId: number,
  joursPrevus: number,
  dateDebut: string | null,
  dateFin: string | null,
  userId: number | null = null,
) {
  if (isNaN(joursPrevus) || joursPrevus < 0) {
    throw new Error("Nombre de jours invalide");
  }

  await prisma.projectAllocation.create({
    data: {
      projectId,
      metierId,
      joursPrevus,
      dateDebut: dateDebut ? new Date(dateDebut) : null,
      dateFin: dateFin ? new Date(dateFin) : null,
      userId,
    },
  });

  revalidatePath(`/projets/${projectId}`);
  revalidatePath("/projets/charge-de-travail");
  revalidatePath("/projets/disponibilite-equipe");
}

export async function updatePhase(
  phaseId: number,
  projectId: number,
  data: {
    metierId?: number;
    joursPrevus?: number;
    dateDebut?: string | null;
    dateFin?: string | null;
    userId?: number | null;
  },
) {
  await prisma.projectAllocation.update({
    where: { id: phaseId },
    data: {
      ...(data.metierId !== undefined && { metierId: data.metierId }),
      ...(data.joursPrevus !== undefined && { joursPrevus: data.joursPrevus }),
      ...(data.dateDebut !== undefined && {
        dateDebut: data.dateDebut ? new Date(data.dateDebut) : null,
      }),
      ...(data.dateFin !== undefined && {
        dateFin: data.dateFin ? new Date(data.dateFin) : null,
      }),
      ...(data.userId !== undefined && { userId: data.userId }),
    },
  });

  revalidatePath(`/projets/${projectId}`);
  revalidatePath("/projets/charge-de-travail");
  revalidatePath("/projets/disponibilite-equipe");
}

export async function deletePhase(phaseId: number, projectId: number) {
  // Délier les tâches avant suppression
  await prisma.task.updateMany({
    where: { allocationId: phaseId },
    data: { allocationId: null },
  });
  await prisma.projectAllocation.delete({ where: { id: phaseId } });
  revalidatePath(`/projets/${projectId}`);
  revalidatePath("/projets/charge-de-travail");
}
