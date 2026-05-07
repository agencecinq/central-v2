import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { resolveUploadPath } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; resourceId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id, resourceId } = await params;
  const projectId = parseInt(id, 10);
  const rid = parseInt(resourceId, 10);
  if (isNaN(projectId) || isNaN(rid)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const resource = await prisma.projectResource.findUnique({
    where: { id: rid },
    select: { id: true, projectId: true, name: true, filepath: true, mimetype: true },
  });
  if (!resource || resource.projectId !== projectId || !resource.filepath) {
    return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });
  }

  // Contrôle d'accès
  const role = session.user.role;
  const userId = parseInt(session.user.id);
  if (role === "client") {
    const access = await prisma.userProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { userId: true },
    });
    if (!access) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  } else if (role !== "admin" && role !== "equipe") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let fullPath: string;
  try {
    fullPath = resolveUploadPath(resource.filepath);
  } catch {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }

  let fileStat;
  try {
    fileStat = await stat(fullPath);
  } catch {
    return NextResponse.json(
      { error: "Fichier introuvable sur le disque" },
      { status: 404 },
    );
  }

  const buffer = await readFile(fullPath);
  const mimetype = resource.mimetype || "application/octet-stream";

  // Pour les pages HTML on préfère "inline" (pour qu'elles s'affichent dans le navigateur).
  // Pour les autres types : également inline — le navigateur décide (PDF dans le viewer,
  // images affichées, autres types proposent le téléchargement).
  const safeName = resource.name.replace(/[^a-zA-Z0-9._\- ]/g, "_");

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimetype,
      "Content-Length": String(fileStat.size),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
