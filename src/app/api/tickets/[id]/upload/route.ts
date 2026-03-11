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

  const { id } = await params;
  const ticketId = parseInt(id, 10);
  if (isNaN(ticketId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  // Vérifier que le ticket existe
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, projectId: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket non trouvé" }, { status: 404 });
  }

  // Client access check
  const role = session.user.role;
  if (role === "client") {
    const userId = parseInt(session.user.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { clientId: true },
    });
    const project = await prisma.project.findUnique({
      where: { id: ticket.projectId },
      select: { clientId: true },
    });
    if (!user?.clientId || project?.clientId !== user.clientId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }

  // Créer le dossier de destination
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "tickets",
    String(ticketId),
  );
  await mkdir(uploadDir, { recursive: true });

  // Nom unique : timestamp + nom original (nettoyé)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const filepath = path.join(uploadDir, filename);

  // Écrire le fichier
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  // Chemin relatif pour la DB (accessible via /uploads/tickets/...)
  const dbFilepath = `/uploads/tickets/${ticketId}/${filename}`;

  // Créer l'enregistrement
  const attachment = await prisma.ticketAttachment.create({
    data: {
      ticketId,
      filename: file.name,
      filepath: dbFilepath,
      mimetype: file.type || null,
      size: file.size,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
