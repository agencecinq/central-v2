"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  FolderKanban,
  Users,
  Ticket,
  Receipt,
  Clock,
  Swords,
  Settings,
  Search,
  Menu,
  ChevronDown,
  CheckSquare,
} from "lucide-react";
import type { Role } from "@/lib/roles";
import { CmdKPalette } from "./cmd-k";

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  shortcut: string;
  badge?: number;
  requiredRoles: Role[];
}

const NAV: NavItem[] = [
  { id: "dashboard", href: "/dashboard", label: "Tableau", icon: LayoutGrid, shortcut: "D", requiredRoles: ["admin", "equipe"] },
  { id: "projets", href: "/projets", label: "Projets", icon: FolderKanban, shortcut: "P", requiredRoles: ["admin", "equipe"] },
  { id: "taches", href: "/taches", label: "Tâches", icon: CheckSquare, shortcut: "A", requiredRoles: ["admin", "equipe"] },
  { id: "crm", href: "/crm", label: "CRM", icon: Users, shortcut: "C", requiredRoles: ["admin", "equipe"] },
  { id: "tickets", href: "/tickets", label: "Tickets", icon: Ticket, shortcut: "T", requiredRoles: ["admin", "equipe", "client"] },
  { id: "finance", href: "/finance", label: "Finance", icon: Receipt, shortcut: "F", requiredRoles: ["admin"] },
  { id: "temps", href: "/timetracking", label: "Temps", icon: Clock, shortcut: "H", requiredRoles: ["admin", "equipe"] },
  { id: "quest", href: "/quest", label: "Quest", icon: Swords, shortcut: "Q", requiredRoles: ["admin", "equipe"] },
];

interface PinnedProject {
  code: string;
  name: string;
  color: string;
}

interface User {
  name: string;
  role: string;
  email?: string | null;
  initials: string;
}

export function RailShell({
  role,
  user,
  pinned = [],
  children,
}: {
  role: string;
  user: User;
  pinned?: PinnedProject[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  // Restore expanded state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("rail.expanded");
    if (stored !== null) setExpanded(stored === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("rail.expanded", String(expanded));
  }, [expanded]);

  // ⌘K shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      }
      if (e.key === "Escape") setCmdkOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const visibleNav = NAV.filter((n) => n.requiredRoles.includes(role as Role));
  const isAdminActive = pathname.startsWith("/admin");

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: "var(--rail-bg)",
        color: "var(--rail-ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <aside
        className="flex-shrink-0 flex flex-col sticky top-0 h-screen text-[#d4d4ce] transition-[width] duration-200"
        style={{
          width: expanded ? 220 : 56,
          background: "var(--rail-dark)",
        }}
      >
        {/* Logo row */}
        <div
          className="flex items-center gap-2.5 h-[52px]"
          style={{
            padding: expanded ? "14px 16px" : "14px 0",
            justifyContent: expanded ? "flex-start" : "center",
          }}
        >
          <div
            className="grid place-items-center font-bold text-[12.5px] tracking-tight"
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              background: "var(--b-accent)",
              color: "#fff",
              fontFamily: "var(--font-serif)",
            }}
          >
            C
          </div>
          {expanded && (
            <>
              <span className="text-[14.5px] font-semibold text-[#fafaf7] tracking-[-0.3px]">
                Central
              </span>
              <div className="flex-1" />
              <button
                onClick={() => setExpanded(false)}
                className="text-[#787872] p-1"
                title="Réduire"
              >
                <Menu size={14} />
              </button>
            </>
          )}
        </div>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[#787872] p-2 self-center"
            title="Étendre"
          >
            <Menu size={14} />
          </button>
        )}

        {/* Search / ⌘K trigger */}
        <div style={{ padding: expanded ? "6px 10px 12px" : "6px 8px 10px" }}>
          <button
            onClick={() => setCmdkOpen(true)}
            className="w-full flex items-center rounded-md text-[12.5px] text-[#a3a39c] border"
            style={{
              background: "var(--rail-search-bg)",
              borderColor: "var(--rail-dark-border)",
              padding: expanded ? "7px 10px" : "7px",
              gap: 8,
              justifyContent: expanded ? "flex-start" : "center",
            }}
          >
            <Search size={13} />
            {expanded && (
              <>
                <span className="flex-1 text-left">Rechercher…</span>
                <span
                  className="text-[10px] px-1.5 py-px rounded"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: "#32323a",
                  }}
                >
                  ⌘K
                </span>
              </>
            )}
          </button>
        </div>

        {/* Nav items */}
        <nav
          className="flex flex-col gap-px"
          style={{ padding: expanded ? "0 10px" : "0 8px" }}
        >
          {visibleNav.map(({ id, href, label, icon: Icon, shortcut, badge }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={id}
                href={href}
                className="flex items-center gap-2.5 rounded-md text-[13px] font-medium relative"
                style={{
                  padding: expanded ? "7px 10px" : "7px",
                  color: active ? "#fafaf7" : "#a3a39c",
                  background: active ? "var(--rail-dark-hover)" : "transparent",
                  justifyContent: expanded ? "flex-start" : "center",
                }}
              >
                <Icon size={15} strokeWidth={1.5} />
                {expanded && (
                  <>
                    <span className="flex-1 text-left">{label}</span>
                    {badge ? (
                      <span
                        className="text-[10px] px-1.5 py-px rounded-full font-semibold text-white"
                        style={{
                          fontFamily: "var(--font-mono)",
                          background: "var(--b-accent)",
                        }}
                      >
                        {badge}
                      </span>
                    ) : null}
                    <span
                      className="text-[10px] text-[#64645e]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {shortcut}
                    </span>
                  </>
                )}
                {!expanded && badge ? (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--b-accent)" }}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Pinned projects */}
        {expanded && pinned.length > 0 && (
          <>
            <div
              className="text-[10px] tracking-[0.1em] uppercase text-[#64645e]"
              style={{ padding: "18px 20px 6px" }}
            >
              Épinglés
            </div>
            <div style={{ padding: "0 10px" }}>
              {pinned.slice(0, 5).map((p) => (
                <button
                  key={p.code}
                  className="flex items-center gap-2.5 py-1.5 px-2.5 w-full text-[12.5px] text-[#a3a39c] rounded-md hover:bg-[#232327]"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                    {p.name}
                  </span>
                  <span
                    className="text-[10px] text-[#64645e]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {p.code}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex-1" />

        {/* Admin button */}
        {role === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-2.5 text-[13px]"
            style={{
              padding: expanded ? "7px 20px" : "7px",
              color: isAdminActive ? "#fafaf7" : "#787872",
              justifyContent: expanded ? "flex-start" : "center",
            }}
          >
            <Settings size={15} strokeWidth={1.5} />
            {expanded && "Admin"}
          </Link>
        )}

        {/* User footer */}
        <div
          className="flex items-center gap-2.5"
          style={{
            padding: expanded ? "12px 14px" : "12px 8px",
            borderTop: "1px solid var(--rail-dark-border)",
            justifyContent: expanded ? "flex-start" : "center",
          }}
        >
          <div
            className="rounded-full grid place-items-center text-[10.5px] font-bold"
            style={{
              width: 28,
              height: 28,
              background: "var(--b-accent)",
              color: "#fff",
            }}
          >
            {user.initials}
          </div>
          {expanded && (
            <>
              <div className="flex-1 text-[12.5px] min-w-0">
                <div className="text-[#fafaf7] whitespace-nowrap overflow-hidden text-ellipsis">
                  {user.name}
                </div>
                <div className="text-[#64645e] text-[11px]">
                  {user.role}
                  {user.email ? ` · ${user.email.split("@")[1] ?? ""}` : ""}
                </div>
              </div>
              <ChevronDown size={12} className="text-[#64645e]" />
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">{children}</div>

      {/* Cmd+K palette */}
      <CmdKPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onNavigate={(href) => {
          router.push(href);
          setCmdkOpen(false);
        }}
        navItems={visibleNav.map((n) => ({ href: n.href, label: n.label, icon: n.icon }))}
      />
    </div>
  );
}
