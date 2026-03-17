"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin, ROLES, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

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
    data: { role: newRole },
  });

  revalidatePath(PATH);
}

export async function toggleUserProject(userId: number, projectId: number) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  const existing = await prisma.userProject.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (existing) {
    await prisma.userProject.delete({ where: { id: existing.id } });
  } else {
    await prisma.userProject.create({ data: { userId, projectId } });
  }

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

// ─── Users ──────────────────────────────────────────────────────────────────

export async function createUser(data: {
  name: string;
  email: string;
  role: string;
  password?: string;
}) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  if (!data.name.trim() || !data.email.trim()) {
    throw new Error("Nom et email requis");
  }

  if (!VALID_ROLES.includes(data.role)) {
    throw new Error("Rôle invalide");
  }

  // Client users must have a password for email/password login
  if (data.role === ROLES.CLIENT && (!data.password || data.password.length < 6)) {
    throw new Error("Un mot de passe d'au moins 6 caractères est requis pour les clients");
  }

  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase().trim() },
  });
  if (existing) {
    throw new Error("Un utilisateur avec cet email existe déjà");
  }

  const hashedPassword = data.password
    ? await bcrypt.hash(data.password, 10)
    : "";

  await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      role: data.role,
      password: hashedPassword,
    },
  });

  revalidatePath(PATH);
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
