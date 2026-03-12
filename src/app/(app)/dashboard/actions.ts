"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function saveDashboardLayout(layoutJson: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const userId = parseInt(session.user.id);

  await prisma.dashboardLayout.upsert({
    where: { userId },
    update: { layout: layoutJson },
    create: { userId, layout: layoutJson },
  });
}
