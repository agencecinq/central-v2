import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  IMPERSONATION_COOKIE,
  verifyImpersonationToken,
} from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export default async function EspaceClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  let impersonatedName: string | null = null;

  if (session?.user?.id) {
    const sessionRole = session.user.role;
    if (sessionRole === "admin" || sessionRole === "equipe") {
      const cookieStore = await cookies();
      const token = cookieStore.get(IMPERSONATION_COOKIE)?.value;
      if (token) {
        const payload = await verifyImpersonationToken(token);
        if (payload && payload.as === parseInt(session.user.id)) {
          const target = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { name: true },
          });
          if (target) impersonatedName = target.name;
        }
      }
    }
  }

  return (
    <>
      {impersonatedName && <ImpersonationBanner clientName={impersonatedName} />}
      {children}
    </>
  );
}
