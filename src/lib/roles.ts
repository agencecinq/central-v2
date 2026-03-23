export const ROLES = {
  ADMIN: "admin",
  EQUIPE: "equipe",
  CLIENT: "client",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  equipe: "Équipe",
  client: "Client",
};

/** Routes bloquées par rôle (match par startsWith) */
const ROLE_BLOCKED_ROUTES: Record<Role, string[]> = {
  admin: ["/espace-client"],
  equipe: ["/finance", "/admin", "/espace-client"],
  client: ["/finance", "/crm", "/projets", "/timetracking", "/admin", "/quest"],
};

export function isAdmin(role: string | undefined): boolean {
  return role === ROLES.ADMIN;
}

/**
 * Pure function — safe for edge runtime (middleware).
 * Returns true if the role is allowed to access the given pathname.
 */
export function canAccessRoute(
  role: string | undefined,
  pathname: string,
): boolean {
  if (!role) return false;
  const blocked = ROLE_BLOCKED_ROUTES[role as Role] ?? [];
  return !blocked.some((route) => pathname.startsWith(route));
}
