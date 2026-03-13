"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin, ROLES, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";

const PATH = "/admin";
const VALID_ROLES: string[] = Object.values(ROLES);

export async function updateUserRole(userId: number, newRole: string) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  if (!VALID_ROLES.includes(newRole)) {
    throw new Error("Rôle invalide");
  }

  // Prevent admin from demoting themselves
  if (Number(session.user.id) === userId && newRole !== ROLES.ADMIN) {
    throw new Error("Vous ne pouvez pas modifier votre propre rôle");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: newRole,
      // Auto-clear clientId when switching away from client role
      ...(newRole !== ROLES.CLIENT ? { clientId: null } : {}),
    },
  });

  revalidatePath(PATH);
}

export async function updateUserClient(userId: number, clientId: number | null) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { clientId },
  });

  revalidatePath(PATH);
}

export async function updateUserTjm(userId: number, tjm: number | null) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  if (tjm !== null && (isNaN(tjm) || tjm < 0)) {
    throw new Error("TJM invalide");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { tjm },
  });

  revalidatePath(PATH);
}

export async function toggleUserMetier(userId: number, metierId: number) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  const existing = await prisma.userMetier.findUnique({
    where: { userId_metierId: { userId, metierId } },
  });

  if (existing) {
    await prisma.userMetier.delete({ where: { id: existing.id } });
  } else {
    await prisma.userMetier.create({ data: { userId, metierId } });
  }

  revalidatePath(PATH);
  revalidatePath("/projets/charge-de-travail");
}

// ─── Métiers ─────────────────────────────────────────────────────────────────

export async function createMetier(nom: string) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  if (!nom.trim()) throw new Error("Le nom est requis");

  await prisma.metier.create({ data: { nom: nom.trim() } });
  revalidatePath(PATH);
}

export async function updateMetier(id: number, nom: string) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  if (!nom.trim()) throw new Error("Le nom est requis");

  await prisma.metier.update({
    where: { id },
    data: { nom: nom.trim() },
  });

  revalidatePath(PATH);
}

export async function deleteMetier(id: number) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  // Dissocier les users et supprimer les allocations avant de supprimer le métier
  await prisma.userMetier.deleteMany({ where: { metierId: id } });
  await prisma.projectAllocation.deleteMany({ where: { metierId: id } });
  await prisma.metier.delete({ where: { id } });

  revalidatePath(PATH);
}
