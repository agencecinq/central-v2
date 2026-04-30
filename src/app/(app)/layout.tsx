import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RailShell } from "@/components/rail/rail-shell";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Pinned projects — top 3 active projects for the current user's context
  const pinnedProjects = await prisma.project.findMany({
    where: { statut: { in: ["en_cours"] }, isPersonnel: false },
    select: { id: true, titre: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  const pinned = pinnedProjects.map((p, i) => ({
    code:
      (
        p.titre
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .slice(0, 3) || "PRJ"
      ).toUpperCase(),
    name: p.titre,
    color: ["#c46b1f", "#6b8a3a", "#3a5b8a"][i] ?? "#86867c",
  }));

  const initials =
    session.user.name
      ?.split(/\s+/)
      .map((w: string) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "??";

  return (
    <RailShell
      role={session.user.role}
      user={{
        name: session.user.name ?? "—",
        role: session.user.role,
        email: session.user.email ?? null,
        initials,
      }}
      pinned={pinned}
    >
      {children}
    </RailShell>
  );
}
