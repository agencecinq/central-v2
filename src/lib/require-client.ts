import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  IMPERSONATION_COOKIE,
  verifyImpersonationToken,
} from "@/lib/impersonation";

export interface ClientContext {
  userId: number;
  projectIds: number[];
  userName: string;
  /** Présent uniquement si l'admin/équipe consulte en mode prévisualisation */
  impersonatedBy?: { userId: number; name: string };
}

/**
 * Server-side helper for /espace-client pages.
 * Verifies: authenticated + role === "client" + has at least one project assigned.
 *
 * Supporte le mode "Prévisualisation espace client" : si l'utilisateur réel
 * est admin/équipe et qu'un cookie d'impersonation valide est présent, on
 * renvoie le contexte du user client impersonné.
 */
export async function requireClient(): Promise<ClientContext> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sessionUserId = parseInt(session.user.id);
  const sessionRole = session.user.role;

  // ─── Mode impersonation (admin/équipe prévisualise) ─────────────
  if (sessionRole === "admin" || sessionRole === "equipe") {
    const cookieStore = await cookies();
    const token = cookieStore.get(IMPERSONATION_COOKIE)?.value;
    if (!token) redirect("/dashboard");

    const payload = await verifyImpersonationToken(token);
    if (!payload || payload.as !== sessionUserId) {
      // cookie invalide / appartient à un autre admin → on dégage
      redirect("/dashboard");
    }

    const target = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        role: true,
        userProjects: { select: { projectId: true } },
      },
    });

    if (!target || target.role !== "client" || target.userProjects.length === 0) {
      redirect("/dashboard");
    }

    return {
      userId: target.id,
      projectIds: target.userProjects.map((up) => up.projectId),
      userName: target.name,
      impersonatedBy: { userId: sessionUserId, name: session.user.name ?? "" },
    };
  }

  // ─── Cas normal : un user client ─────────────────────────────────
  if (sessionRole !== "client") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      name: true,
      userProjects: { select: { projectId: true } },
    },
  });

  if (!user || user.userProjects.length === 0) redirect("/dashboard");

  return {
    userId: sessionUserId,
    projectIds: user.userProjects.map((up) => up.projectId),
    userName: user.name,
  };
}
