import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * Server-side helper for /espace-client pages.
 * Verifies: authenticated + role === "client" + has clientId.
 * Returns { userId, clientId, userName } or redirects.
 */
export async function requireClient(): Promise<{
  userId: number;
  clientId: number;
  userName: string;
}> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id);
  if (session.user.role !== "client") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { clientId: true, name: true },
  });

  if (!user?.clientId) redirect("/dashboard");

  return { userId, clientId: user.clientId, userName: user.name };
}
