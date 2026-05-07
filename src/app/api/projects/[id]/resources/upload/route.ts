import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Seule l'équipe peut uploader des ressources
  const role = session.user.role;
  if (role !== "admin" && role !== "equipe") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Projet non trouvé" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = (formData.get("type") as string | null) ?? "document";
  const customName = (formData.get("name") as string | null)?.trim();

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }

  if (type !== "document" && type !== "html_page") {
    return NextResponse.json(
      { error: "Type de ressource invalide" },
      { status: 400 },
    );
  }

  // html_page : on n'accepte que des .html / .htm
  if (type === "html_page") {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".html") && !lower.endsWith(".htm")) {
      return NextResponse.json(
        { error: "Une page HTML doit avoir l'extension .html ou .htm" },
        { status: 400 },
      );
    }
  }

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "projects",
    String(projectId),
    "resources",
  );
  await mkdir(uploadDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const filepath = path.join(uploadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const dbFilepath = `/uploads/projects/${projectId}/resources/${filename}`;

  const resource = await prisma.projectResource.create({
    data: {
      projectId,
      type,
      name: customName || file.name,
      filepath: dbFilepath,
      mimetype: file.type || null,
      size: file.size,
      createdById: parseInt(session.user.id),
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
