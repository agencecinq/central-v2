import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessRoute } from "@/lib/roles";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/login";
  const isAuthApi = pathname.startsWith("/api/auth");

  const isPublicProposition = pathname.startsWith("/proposition/");
  const isWidgetApi = pathname.startsWith("/api/widget/");
  const isMcpApi = pathname.startsWith("/api/mcp");
  const isInternalApi = pathname.startsWith("/api/internal/");

  // Allow auth API routes, public proposition pages, widget API, MCP API,
  // and internal API (auth handled per-route via Bearer token)
  if (isAuthApi || isPublicProposition || isWidgetApi || isMcpApi || isInternalApi)
    return NextResponse.next();

  // Auth.js v5 uses different cookie names for HTTPS vs HTTP.
  // getToken needs secureCookie=true in production so it reads the right cookie
  // (__Secure-authjs.session-token) and uses the correct salt for JWT decryption.
  const isSecure = req.nextUrl.protocol === "https:";

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: isSecure,
  });
  const isAuthenticated = !!token;

  // Redirect authenticated users away from login
  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Redirect unauthenticated users to login
  if (!isLoginPage && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ─── Authorization ──────────────────────────────────────────────────────────
  if (isAuthenticated && !isLoginPage) {
    const role = token.role as string | undefined;

    // Exception : admin/équipe peut accéder à /espace-client en mode prévisualisation
    // (la validation cryptographique du cookie est faite dans requireClient)
    const isImpersonating =
      (role === "admin" || role === "equipe") &&
      pathname.startsWith("/espace-client") &&
      !!req.cookies.get(IMPERSONATION_COOKIE);

    if (!isImpersonating && !canAccessRoute(role, pathname)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|widget\\.js).*)"],
};
