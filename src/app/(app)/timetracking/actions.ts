"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const PATH = "/timetracking";

export async function createTimeEntry(data: {
  projectId?: number | null;
  taskId?: number | null;
  semaine: string;
  duree: number;
  unite: "heures" | "jours";
  categorie: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  if (!data.semaine) throw new Error("La semaine est requise");
  if (!data.duree || data.duree <= 0)
    throw new Error("La durée doit être positive");
  if (!data.categorie?.trim()) throw new Error("La catégorie est requise");
  if (!data.projectId && !data.taskId)
    throw new Error("Un projet ou une tâche est requis");

  await prisma.timeEntry.create({
    data: {
      userId: Number(session.user.id),
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
      semaine: data.semaine,
      duree: data.duree,
      unite: data.unite,
      categorie: data.categorie.trim(),
      description: data.description?.trim() || null,
    },
  });

  revalidatePath(PATH);
  revalidatePath("/dashboard");
}

export async function updateTimeEntry(data: {
  id: number;
  duree: number;
  unite: "heures" | "jours";
  categorie: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  if (!data.duree || data.duree <= 0)
    throw new Error("La durée doit être positive");

  await prisma.timeEntry.update({
    where: { id: data.id },
    data: {
      duree: data.duree,
      unite: data.unite,
      categorie: data.categorie.trim(),
      description: data.description?.trim() || null,
    },
  });

  revalidatePath(PATH);
}

export async function deleteTimeEntry(id: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath(PATH);
}
