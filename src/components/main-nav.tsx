"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FolderKanban,
  Users,
  Receipt,
  Clock,
  Settings,
  Ticket,
  FileText,
} from "lucide-react";
import type { Role } from "@/lib/roles";

const navItems: {
  href: string;
  label: string;
  icon: typeof FolderKanban;
  requiredRoles: Role[];
}[] = [
  { href: "/projets", label: "Projets", icon: FolderKanban, requiredRoles: ["admin", "equipe"] },
  { href: "/tickets", label: "Tickets", icon: Ticket, requiredRoles: ["admin", "equipe", "client"] },
  { href: "/crm", label: "CRM", icon: Users, requiredRoles: ["admin", "equipe"] },
  { href: "/finance", label: "Finance", icon: Receipt, requiredRoles: ["admin"] },
  { href: "/timetracking", label: "Timetracking", icon: Clock, requiredRoles: ["admin", "equipe"] },
  { href: "/admin", label: "Admin", icon: Settings, requiredRoles: ["admin"] },
  // Client portal
  { href: "/espace-client/projets", label: "Mes projets", icon: FolderKanban, requiredRoles: ["client"] },
  { href: "/espace-client/factures", label: "Factures", icon: FileText, requiredRoles: ["client"] },
];

interface MainNavProps {
  role: string;
}

export function MainNav({ role }: MainNavProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) =>
    item.requiredRoles.includes(role as Role),
  );

  return (
    <nav className="flex items-center gap-1">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
