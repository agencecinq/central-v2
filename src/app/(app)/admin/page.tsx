import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { AdminUsersTable } from "./admin-users-table";
import { AdminMetiersTable } from "./admin-metiers-table";

async function getUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tjm: true,
      userMetiers: { select: { metierId: true } },
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
    createdAt: u.createdAt?.toISOString() ?? null,
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

  const [users, metiers] = await Promise.all([getUsers(), getMetiers()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Administration
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Gérez les utilisateurs, leurs permissions et les métiers.
        </p>
      </div>

      <AdminUsersTable users={users} metiers={metiers} currentUserId={Number(session.user.id)} />
      <AdminMetiersTable metiers={metiers} />
    </div>
  );
}
