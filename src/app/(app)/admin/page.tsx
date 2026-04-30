import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { AdminUsersTable } from "./admin-users-table";
import { AdminMetiersTable } from "./admin-metiers-table";
import { RailPageHeader, RailPageBody } from "@/components/rail/page-header";

async function getUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tjm: true,
      userMetiers: { select: { metierId: true } },
      userProjects: { select: { projectId: true } },
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    tjm: u.tjm ? Number(u.tjm) : null,
    metierIds: u.userMetiers.map((um) => um.metierId),
    projectIds: u.userProjects.map((up) => up.projectId),
    createdAt: u.createdAt?.toISOString() ?? null,
  }));
}

async function getProjects() {
  const projects = await prisma.project.findMany({
    select: { id: true, titre: true, client: { select: { nom: true } } },
    orderBy: { titre: "asc" },
  });
  return projects.map((p) => ({
    id: p.id,
    titre: p.titre,
    clientNom: p.client?.nom ?? null,
  }));
}

async function getMetiers() {
  const metiers = await prisma.metier.findMany({
    orderBy: { nom: "asc" },
  });
  return metiers.map((m) => ({ id: m.id, nom: m.nom }));
}

export default async function AdminPage() {
  const session = await auth();

  // Double safety: page-level check (middleware already blocks non-admins)
  if (!session || !isAdmin(session.user.role)) {
    redirect("/dashboard");
  }

  const [users, metiers, projects] = await Promise.all([getUsers(), getMetiers(), getProjects()]);

  return (
    <>
      <RailPageHeader
        eyebrow="Configuration"
        title="Administration"
        description="Gérez les utilisateurs, leurs permissions et les métiers."
      />
      <RailPageBody className="space-y-6">
        <AdminUsersTable users={users} metiers={metiers} projects={projects} currentUserId={Number(session.user.id)} />
        <AdminMetiersTable metiers={metiers} />
      </RailPageBody>
    </>
  );
}
