import { NextRequest, NextResponse } from "next/server";

/**
 * Vérifie le Bearer token partagé entre CinqCentral et le worker auto-resolve.
 * Renvoie `null` si OK, sinon une réponse 401/500 prête à être retournée.
 */
export function checkInternalAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.AUTORESOLVE_INTERNAL_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "AUTORESOLVE_INTERNAL_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token || !timingSafeEqual(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
