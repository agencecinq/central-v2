import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_SECONDS,
  signImpersonationToken,
} from "@/lib/impersonation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "admin" && role !== "equipe") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const adminUserId = parseInt(session.user.id);
  const body = (await request.json().catch(() => ({}))) as {
    projectId?: number;
    userId?: number;
  };

  let targetUserId = body.userId ? Number(body.userId) : null;

  // Si projectId fourni, on résout le premier user client rattaché
  if (!targetUserId && body.projectId) {
    const projectId = Number(body.projectId);
    const userProject = await prisma.userProject.findFirst({
      where: {
        projectId,
        user: { role: "client" },
      },
      orderBy: { id: "asc" },
      select: { userId: true },
    });
    if (!userProject) {
      return NextResponse.json(
        {
          error:
            "Aucun utilisateur client n'est rattaché à ce projet. Ajoutez-en un depuis l'admin.",
        },
        { status: 404 },
      );
    }
    targetUserId = userProject.userId;
  }

  if (!targetUserId) {
    return NextResponse.json(
      { error: "projectId ou userId requis" },
      { status: 400 },
    );
  }

  // Vérifier que la cible est bien un client
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, name: true },
  });
  if (!target || target.role !== "client") {
    return NextResponse.json(
      { error: "L'utilisateur cible n'est pas un client" },
      { status: 400 },
    );
  }

  const token = await signImpersonationToken({
    sub: target.id,
    as: adminUserId,
  });

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IMPERSONATION_TTL_SECONDS,
  });

  return NextResponse.json({
    ok: true,
    impersonatedUser: { id: target.id, name: target.name },
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  return NextResponse.json({ ok: true });
}
