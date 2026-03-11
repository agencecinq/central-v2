import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // 1. Validate widget token
    const widgetToken = formData.get("widget_token") as string;
    if (!widgetToken) {
      return NextResponse.json(
        { success: false, message: "widget_token is required" },
        { status: 400, headers: corsHeaders() },
      );
    }

    // 2. Find project by widget token
    const project = await prisma.project.findUnique({
      where: { widgetToken },
      select: { id: true, chefProjetId: true },
    });
    if (!project) {
      return NextResponse.json(
        { success: false, message: "Invalid widget token" },
        { status: 401, headers: corsHeaders() },
      );
    }

    // 3. Validate required fields
    const subject = (formData.get("subject") as string)?.trim();
    const message = (formData.get("message") as string)?.trim();
    if (!subject || !message) {
      return NextResponse.json(
        { success: false, message: "subject and message are required" },
        { status: 422, headers: corsHeaders() },
      );
    }

    // 4. Collect optional fields
    const userEmail =
      (formData.get("user_email") as string)?.trim() || null;
    const origin = (formData.get("origin") as string)?.trim() || null;
    const browser = (formData.get("browser") as string)?.trim() || null;
    const windowWidth = formData.get("window_width") as string;
    const windowHeight = formData.get("window_height") as string;

    // 5. Validate email format if provided
    if (userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 422, headers: corsHeaders() },
      );
    }

    // 6. Build metaInfo JSON
    const metaInfo = JSON.stringify({
      email: userEmail,
      origin,
      source: "widget",
    });

    // 7. Build screen size string
    const tailleEcran =
      windowWidth && windowHeight ? `${windowWidth}x${windowHeight}` : null;

    // 8. Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        project: { connect: { id: project.id } },
        ...(project.chefProjetId
          ? { assigne: { connect: { id: project.chefProjetId } } }
          : {}),
        titre: subject.slice(0, 255),
        description: message,
        statut: "ouvert",
        navigateur: browser?.slice(0, 255) || null,
        tailleEcran,
        metaInfo,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 9. Handle file upload (optional)
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      if (file.size <= 10 * 1024 * 1024) {
        const uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "tickets",
          String(ticket.id),
        );
        await mkdir(uploadDir, { recursive: true });

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filename = `${Date.now()}-${safeName}`;
        const filepath = path.join(uploadDir, filename);

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filepath, buffer);

        await prisma.ticketAttachment.create({
          data: {
            ticketId: ticket.id,
            filename: file.name,
            filepath: `/uploads/tickets/${ticket.id}/${filename}`,
            mimetype: file.type || null,
            size: file.size,
          },
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Ticket created successfully",
        ticket_id: ticket.id,
      },
      { status: 201, headers: corsHeaders() },
    );
  } catch (error) {
    console.error("Widget ticket creation failed:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
