import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkInternalAuth } from "@/lib/internal-auth";

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authError = checkInternalAuth(req);
  if (authError) return authError;

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  let body: { detected_stack?: unknown };
  try {
    body = (await req.json()) as { detected_stack?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.detected_stack || typeof body.detected_stack !== "object") {
    return NextResponse.json(
      { error: "detected_stack must be an object" },
      { status: 400 },
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      detectedStack: body.detected_stack as object,
      detectedStackAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
