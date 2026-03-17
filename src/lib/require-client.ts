import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * Server-side helper for /espace-client pages.
 * Verifies: authenticated + role === "client" + has at least one project assigned.
 * Returns { userId, projectIds, userName } or redirects.
 */
export async function requireClient(): Promise<{
  userId: number;
  projectIds: number[];
  userName: string;
}> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id);
  if (session.user.role !== "client") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      userProjects: { select: { projectId: true } },
    },
  });

  if (!user || user.userProjects.length === 0) redirect("/dashboard");

  return {
    userId,
    projectIds: user.userProjects.map((up) => up.projectId),
    userName: user.name,
  };
}
