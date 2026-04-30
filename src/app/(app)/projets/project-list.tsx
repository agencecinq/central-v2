"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ChargeChip, AvatarStack, Hint } from "@/components/rail/primitives";
import { createProject } from "./[id]/actions";

interface Project {
  id: number;
  titre: string;
  statut: string;
  budgetTotal: number;
  budgetConsomme: number;
  deadline: string | null;
  dateDebut: string | null;
  clientNom: string | null;
  clientId: number | null;
  chefProjet: string | null;
  resteAFacturer: number | null;
}

interface ClientOption {
  id: number;
  label: string;
}

interface UserOption {
  id: number;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────

function projectCode(titre: string): string {
  return (
    titre
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "PRJ"
  );
}

function projectInitials(name: string | null): string {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function fmtEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function budgetPct(p: Project): number {
  if (p.budgetTotal <= 0) return 0;
  return Math.round((p.budgetConsomme / p.budgetTotal) * 100);
}

function deriveCharge(pct: number): "Sur charge" | "Sous charge" | "OK" {
  if (pct > 95) return "Sur charge";
  if (pct < 25) return "Sous charge";
  return "OK";
}

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
  archive: "Archivé",
};

// ─── Create Project Dialog ───────────────────────────────

function CreateProjectDialog({
  clients,
  users,
  open,
  onOpenChange,
}: {
  clients: ClientOption[];
  users: UserOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState<string>("none");
  const [chefProjetId, setChefProjetId] = useState<string>("none");
  const [statut, setStatut] = useState<string>("en_attente");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("clientId", clientId === "none" ? "" : clientId);
    formData.set("chefProjetId", chefProjetId === "none" ? "" : chefProjetId);
    formData.set("statut", statut);

    startTransition(async () => {
      const projectId = await createProject(formData);
      onOpenChange(false);
      router.push(`/projets/${projectId}`);
    });
  }

  const clientLabel =
    clientId === "none"
      ? "Aucun"
      : clients.find((c) => String(c.id) === clientId)?.label ?? "Sélectionner";
  const chefLabel =
    chefProjetId === "none"
      ? "Aucun"
      : users.find((u) => String(u.id) === chefProjetId)?.name ?? "Sélectionner";
  const statutLabel = STATUT_LABELS[statut] ?? statut;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input id="titre" name="titre" required placeholder="Nom du projet" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? "none")}>
                <SelectTrigger className="w-full">{clientLabel}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chef de projet</Label>
              <Select value={chefProjetId} onValueChange={(v) => setChefProjetId(v ?? "none")}>
                <SelectTrigger className="w-full">{chefLabel}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={statut} onValueChange={(v) => setStatut(v ?? "en_attente")}>
                <SelectTrigger className="w-full">{statutLabel}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="termine">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budgetTotal">Budget total (€)</Label>
              <Input id="budgetTotal" name="budgetTotal" type="number" step="0.01" min="0" placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date début</Label>
              <Input id="dateDebut" name="dateDebut" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" name="deadline" type="date" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ──────────────────────────────────────

type ViewMode = "liste" | "kanban" | "gantt";
type StatusTab = "tous" | "en_cours" | "en_attente" | "termine" | "archive";

export function ProjectList({
  projects,
  clients,
  allClients,
  users,
}: {
  projects: Project[];
  clients: ClientOption[];
  allClients: ClientOption[];
  users: UserOption[];
}) {
  const [tab, setTab] = useState<StatusTab>("tous");
  const [view, setView] = useState<ViewMode>("liste");
  const [clientFilter, setClientFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  // Tabs counts (computed from active filter only — client filter doesn't change tab counts)
  const counts = useMemo(() => {
    const filtered = projects.filter((p) =>
      clientFilter !== "all" ? String(p.clientId) === clientFilter : true,
    );
    return {
      tous: filtered.filter((p) => p.statut !== "archive").length,
      en_cours: filtered.filter((p) => p.statut === "en_cours").length,
      en_attente: filtered.filter((p) => p.statut === "en_attente").length,
      termine: filtered.filter((p) => p.statut === "termine").length,
      archive: filtered.filter((p) => p.statut === "archive").length,
    };
  }, [projects, clientFilter]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      // Status filter
      if (tab === "tous") {
        if (p.statut === "archive") return false;
      } else if (p.statut !== tab) return false;
      // Client filter
      if (clientFilter !== "all" && String(p.clientId) !== clientFilter) return false;
      return true;
    });
  }, [projects, tab, clientFilter]);

  return (
    <div className="space-y-4">
      {/* Toolbar: tabs + view toggle + filters + new */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div
          className="flex gap-px rounded-md overflow-hidden"
          style={{ background: "var(--rail-hair)" }}
        >
          {([
            ["tous", "Tous", counts.tous],
            ["en_cours", "En cours", counts.en_cours],
            ["en_attente", "En attente", counts.en_attente],
            ["termine", "Terminés", counts.termine],
            ["archive", "Archivés", counts.archive],
          ] as const).map(([id, label, count]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id as StatusTab)}
                className="text-[12.5px] font-medium"
                style={{
                  padding: "7px 14px",
                  background: active ? "var(--rail-panel)" : "var(--rail-bg)",
                  color: active ? "var(--rail-ink)" : "var(--rail-muted)",
                }}
              >
                {label}
                <span
                  className="ml-1.5 text-[10.5px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: active ? "var(--rail-muted)" : "var(--rail-muted2)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Client filter */}
        <Select value={clientFilter} onValueChange={(v) => setClientFilter(v ?? "all")}>
          <SelectTrigger className="w-44 h-[34px] text-[12.5px]">
            <span className="inline-flex items-center gap-1.5">
              <Filter className="h-3 w-3" />
              {clientFilter === "all"
                ? "Tous les clients"
                : clients.find((c) => String(c.id) === clientFilter)?.label ?? "—"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div
            className="inline-flex rounded-md overflow-hidden"
            style={{ border: "1px solid var(--rail-hair)" }}
          >
            {(["liste", "kanban", "gantt"] as const).map((v, i) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="text-[12px] capitalize font-medium"
                  style={{
                    padding: "7px 12px",
                    background: active ? "var(--rail-hair2)" : "var(--rail-panel)",
                    color: active ? "var(--rail-ink)" : "var(--rail-muted)",
                    borderRight: i < 2 ? "1px solid var(--rail-hair)" : "none",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>

          {/* New */}
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 text-white rounded-md text-[12.5px] font-medium"
            style={{
              padding: "7px 12px",
              background: "var(--b-accent)",
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Nouveau
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div
          className="text-center text-[13px]"
          style={{
            padding: "60px 20px",
            border: "1px dashed var(--rail-hair)",
            borderRadius: 8,
            background: "var(--rail-panel)",
            color: "var(--rail-muted)",
          }}
        >
          Aucun projet trouvé pour ces filtres.
        </div>
      ) : view === "liste" ? (
        <ProjetsListe items={filtered} />
      ) : view === "kanban" ? (
        <ProjetsKanban items={filtered} />
      ) : (
        <ProjetsGantt items={filtered} />
      )}

      <CreateProjectDialog
        clients={allClients}
        users={users}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

// ─── Liste view ──────────────────────────────────────────

function ProjetsListe({ items }: { items: Project[] }) {
  const cols = "60px 1.6fr 1fr 100px 1.3fr 130px 90px 80px";
  return (
    <div
      className="overflow-hidden"
      style={{
        background: "var(--rail-panel)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 8,
      }}
    >
      {/* Header */}
      <div
        className="grid gap-3 text-[10.5px] uppercase"
        style={{
          gridTemplateColumns: cols,
          padding: "10px 16px",
          letterSpacing: "0.08em",
          color: "var(--rail-muted)",
          background: "var(--rail-hair3)",
          borderBottom: "1px solid var(--rail-hair2)",
        }}
      >
        <span>Code</span>
        <span>Projet</span>
        <span>Client</span>
        <span>Charge</span>
        <span>Avancement</span>
        <span>Budget consommé</span>
        <span>Échéance</span>
        <span>Équipe</span>
      </div>
      {/* Rows */}
      {items.map((p, i) => {
        const code = projectCode(p.titre);
        const pct = budgetPct(p);
        const charge = deriveCharge(pct);
        const initials = projectInitials(p.chefProjet);
        return (
          <Link
            key={p.id}
            href={`/projets/${p.id}`}
            className="grid gap-3 items-center text-[13px] transition-colors"
            style={{
              gridTemplateColumns: cols,
              padding: "12px 16px",
              borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rail-hair3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              className="text-[11px]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--rail-muted)",
              }}
            >
              {code}
            </span>
            <div className="min-w-0">
              <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {p.titre}
              </div>
              <div className="text-[11px] mt-px" style={{ color: "var(--rail-muted)" }}>
                {STATUT_LABELS[p.statut] ?? p.statut}
              </div>
            </div>
            <div className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: "var(--rail-ink2)" }}>
              {p.clientNom ?? "—"}
            </div>
            <ChargeChip v={charge} />
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded overflow-hidden" style={{ background: "var(--rail-hair)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: "var(--b-accent)",
                  }}
                />
              </div>
              <span
                className="text-[11px] w-7 text-right"
                style={{ fontFamily: "var(--font-mono)", color: "var(--rail-ink2)" }}
              >
                {pct}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded overflow-hidden" style={{ background: "var(--rail-hair)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background:
                      pct > 95 ? "var(--rail-danger)" : pct > 80 ? "var(--rail-warn)" : "var(--rail-success)",
                  }}
                />
              </div>
              <span
                className="text-[11px] tabular text-right"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: pct > 95 ? "var(--rail-danger)" : "var(--rail-ink2)",
                }}
              >
                {fmtEuro(p.budgetConsomme)}
              </span>
            </div>
            <span className="text-[12px]" style={{ color: "var(--rail-ink2)" }}>
              {fmtDate(p.deadline)}
            </span>
            <div>
              {p.chefProjet ? <AvatarStack initials={[initials]} /> : <span style={{ color: "var(--rail-muted2)" }}>—</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Kanban view ─────────────────────────────────────────

function ProjetsKanban({ items }: { items: Project[] }) {
  // Phase by % of budget consumed
  const cols = [
    { id: "brief", l: "Brief / Cadrage", filter: (p: Project) => budgetPct(p) < 20 },
    { id: "design", l: "Design", filter: (p: Project) => budgetPct(p) >= 20 && budgetPct(p) < 55 },
    { id: "dev", l: "Développement", filter: (p: Project) => budgetPct(p) >= 55 && budgetPct(p) < 90 },
    { id: "livraison", l: "Relecture / Livraison", filter: (p: Project) => budgetPct(p) >= 90 },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cols.map((c) => {
        const colItems = items.filter(c.filter);
        return (
          <div
            key={c.id}
            style={{
              background: "var(--rail-panel)",
              border: "1px solid var(--rail-hair)",
              borderRadius: 8,
            }}
          >
            <div
              className="flex justify-between items-center"
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--rail-hair)",
              }}
            >
              <span className="text-[12.5px] font-semibold">{c.l}</span>
              <Hint>{colItems.length}</Hint>
            </div>
            <div className="flex flex-col gap-2" style={{ padding: 8, minHeight: 280 }}>
              {colItems.map((p) => {
                const code = projectCode(p.titre);
                const pct = budgetPct(p);
                const charge = deriveCharge(pct);
                return (
                  <Link
                    key={p.id}
                    href={`/projets/${p.id}`}
                    style={{
                      padding: 12,
                      background: "var(--rail-bg)",
                      border: "1px solid var(--rail-hair)",
                      borderRadius: 6,
                    }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span
                        className="text-[10.5px]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--rail-muted)",
                        }}
                      >
                        {code}
                      </span>
                      <ChargeChip v={charge} />
                    </div>
                    <div className="text-[13px] font-medium mb-0.5">{p.titre}</div>
                    <div className="text-[11.5px] mb-2.5" style={{ color: "var(--rail-muted)" }}>
                      {p.clientNom ?? "—"}
                    </div>
                    <div className="h-[2px]" style={{ background: "var(--rail-hair)" }}>
                      <div
                        className="h-full"
                        style={{ width: `${Math.min(100, pct)}%`, background: "var(--b-accent)" }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <div>
                        {p.chefProjet && (
                          <AvatarStack initials={[projectInitials(p.chefProjet)]} size={18} />
                        )}
                      </div>
                      <span
                        className="text-[11px]"
                        style={{
                          color: "var(--rail-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {fmtDate(p.deadline)}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {colItems.length === 0 && (
                <div
                  className="text-center text-[11.5px] py-8"
                  style={{ color: "var(--rail-muted2)" }}
                >
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gantt view ──────────────────────────────────────────

function ProjetsGantt({ items }: { items: Project[] }) {
  // Build a 12-week window from today
  const startMonday = (() => {
    const d = new Date();
    const dow = d.getDay() || 7;
    d.setDate(d.getDate() - (dow - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(startMonday);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { i, start, end, label: `S${isoWeekNum(start)}` };
  });

  const ganttCols = `220px repeat(${weeks.length}, 1fr)`;

  return (
    <div
      className="overflow-hidden overflow-x-auto"
      style={{
        background: "var(--rail-panel)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 8,
      }}
    >
      <div style={{ minWidth: 1000 }}>
        {/* Header */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: ganttCols,
            background: "var(--rail-hair3)",
            fontSize: 10.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--rail-muted)",
          }}
        >
          <span style={{ padding: "10px 16px" }}>Projet</span>
          {weeks.map((w) => (
            <span
              key={w.i}
              style={{
                padding: "10px 4px",
                textAlign: "center",
                borderLeft: "1px solid var(--rail-hair)",
              }}
            >
              {w.label}
            </span>
          ))}
        </div>
        {/* Rows */}
        {items.map((p) => {
          // Compute span based on dateDebut/deadline against the visible window
          const debut = p.dateDebut ? new Date(p.dateDebut) : null;
          const fin = p.deadline ? new Date(p.deadline) : null;
          const code = projectCode(p.titre);

          let startCol = 0;
          let span = 4; // default 4 weeks if no dates
          if (debut && fin) {
            const startWeek = Math.max(
              0,
              Math.floor((debut.getTime() - startMonday.getTime()) / (7 * 86400000)),
            );
            const endWeek = Math.min(
              weeks.length - 1,
              Math.floor((fin.getTime() - startMonday.getTime()) / (7 * 86400000)),
            );
            if (endWeek >= 0 && startWeek < weeks.length) {
              startCol = Math.max(0, startWeek);
              span = Math.max(1, endWeek - startCol + 1);
            }
          } else if (fin) {
            const endWeek = Math.floor((fin.getTime() - startMonday.getTime()) / (7 * 86400000));
            startCol = Math.max(0, endWeek - 3);
            span = Math.min(4, endWeek - startCol + 1);
          }

          const pct = budgetPct(p);
          const charge = deriveCharge(pct);
          const tone =
            charge === "Sur charge"
              ? "var(--rail-danger)"
              : charge === "Sous charge"
                ? "var(--rail-warn)"
                : "var(--b-accent)";

          return (
            <Link
              key={p.id}
              href={`/projets/${p.id}`}
              className="grid items-center"
              style={{
                gridTemplateColumns: ganttCols,
                borderTop: "1px solid var(--rail-hair2)",
                height: 44,
              }}
            >
              <div className="px-4 flex flex-col gap-px">
                <span className="text-[12.5px] font-medium">{p.titre}</span>
                <span
                  className="text-[10.5px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--rail-muted)",
                  }}
                >
                  {code} · {p.clientNom ?? "—"}
                </span>
              </div>
              <div
                style={{
                  gridColumn: `${2 + startCol} / span ${span}`,
                  padding: "0 4px",
                  position: "relative",
                }}
              >
                <div
                  className="rounded flex items-center px-2 text-white"
                  style={{
                    height: 22,
                    background: tone,
                    fontSize: 10.5,
                    fontWeight: 500,
                  }}
                >
                  {pct}% · {charge}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function isoWeekNum(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
