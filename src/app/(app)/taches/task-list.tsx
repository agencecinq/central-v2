"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { toggleTaskDone } from "../projets/[id]/actions";
import { PrioChip, AvatarStack, Hint } from "@/components/rail/primitives";

interface Task {
  id: number;
  titre: string;
  statutKanban: string;
  priorite: string;
  priorityLevel: number;
  categorie: string | null;
  estTerminee: boolean;
  dateEcheance: string | null;
  estimationHeures: number | null;
  isOutOfScope: boolean;
  isBacklog: boolean;
  projectId: number;
  projectTitre: string;
  projectStatut: string;
  clientName: string | null;
  assigneId: number | null;
  assigneName: string | null;
}

interface ProjectOption {
  id: number;
  titre: string;
}

interface UserOption {
  id: number;
  name: string;
}

const STATUT_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  review: "Relecture",
  done: "Terminé",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso).getTime() < today.getTime();
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

type ScopeFilter = "all" | "mine" | "unassigned";
type StatusFilter = "open" | "todo" | "in_progress" | "review" | "done";
type ViewMode = "liste" | "kanban";

export function TaskList({
  tasks,
  projects,
  users,
  currentUserId,
}: {
  tasks: Task[];
  projects: ProjectOption[];
  users: UserOption[];
  currentUserId: number;
}) {
  const [scope, setScope] = useState<ScopeFilter>("mine");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [projectId, setProjectId] = useState<string>("all");
  const [assigneId, setAssigneId] = useState<string>("all");
  const [view, setView] = useState<ViewMode>("liste");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      // Scope
      if (scope === "mine" && t.assigneId !== currentUserId) return false;
      if (scope === "unassigned" && t.assigneId !== null) return false;
      // Status
      if (status === "open" && t.estTerminee) return false;
      if (status === "todo" && t.statutKanban !== "todo") return false;
      if (status === "in_progress" && t.statutKanban !== "in_progress") return false;
      if (status === "review" && t.statutKanban !== "review") return false;
      if (status === "done" && t.statutKanban !== "done") return false;
      // Project
      if (projectId !== "all" && String(t.projectId) !== projectId) return false;
      // Assignee
      if (assigneId !== "all") {
        if (assigneId === "none" && t.assigneId !== null) return false;
        if (assigneId !== "none" && String(t.assigneId) !== assigneId) return false;
      }
      return true;
    });
  }, [tasks, scope, status, projectId, assigneId, currentUserId]);

  // KPIs
  const stats = useMemo(() => {
    const mine = tasks.filter((t) => t.assigneId === currentUserId);
    const mineOpen = mine.filter((t) => !t.estTerminee);
    const mineHaute = mineOpen.filter((t) => t.priorite === "haute");
    const overdue = mineOpen.filter((t) => isOverdue(t.dateEcheance));
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = mineOpen.filter((t) => t.dateEcheance === today);
    return {
      total: mine.length,
      open: mineOpen.length,
      haute: mineHaute.length,
      overdue: overdue.length,
      today: dueToday.length,
    };
  }, [tasks, currentUserId]);

  const cols = "32px 1.6fr 1fr 110px 90px 80px 90px 80px";

  const handleToggle = (taskId: number, projectId: number) => {
    startTransition(async () => {
      await toggleTaskDone(taskId, projectId);
    });
  };

  return (
    <div className="space-y-5">
      {/* KPI strip — focused on "moi" */}
      <section className="grid grid-cols-4 gap-4">
        <KpiTask label="Mes tâches actives" value={stats.open} sub={`${stats.total} au total`} />
        <KpiTask
          label="Priorité haute"
          value={stats.haute}
          sub={stats.haute > 0 ? "à traiter en priorité" : "Aucune"}
          tone={stats.haute > 0 ? "danger" : "default"}
        />
        <KpiTask
          label="En retard"
          value={stats.overdue}
          sub={stats.overdue > 0 ? "échéance dépassée" : "À jour"}
          tone={stats.overdue > 0 ? "warn" : "default"}
        />
        <KpiTask label="Aujourd'hui" value={stats.today} sub="échéance du jour" />
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Scope toggle */}
        <div
          className="flex items-center gap-px rounded-md p-0.5"
          style={{ background: "var(--rail-hair)", border: "1px solid var(--rail-hair)" }}
        >
          {([
            ["mine", "Mes tâches"],
            ["all", "Toutes"],
            ["unassigned", "Non assignées"],
          ] as const).map(([id, label]) => {
            const active = scope === id;
            return (
              <button
                key={id}
                onClick={() => setScope(id)}
                className="rounded text-[11.5px] font-medium"
                style={{
                  padding: "5px 10px",
                  background: active ? "var(--rail-panel)" : "transparent",
                  color: active ? "var(--rail-ink)" : "var(--rail-muted)",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Status filter */}
        <div
          className="flex items-center gap-px rounded-md p-0.5"
          style={{ background: "var(--rail-hair)", border: "1px solid var(--rail-hair)" }}
        >
          {([
            ["open", "Ouvertes"],
            ["todo", "À faire"],
            ["in_progress", "En cours"],
            ["review", "Relecture"],
            ["done", "Terminées"],
          ] as const).map(([id, label]) => {
            const active = status === id;
            return (
              <button
                key={id}
                onClick={() => setStatus(id)}
                className="rounded text-[11.5px] font-medium"
                style={{
                  padding: "5px 10px",
                  background: active ? "var(--rail-panel)" : "transparent",
                  color: active ? "var(--rail-ink)" : "var(--rail-muted)",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Project select */}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="text-[12px] rounded-md outline-none"
          style={{
            padding: "6px 10px",
            background: "var(--rail-panel)",
            border: "1px solid var(--rail-hair)",
            color: "var(--rail-ink)",
          }}
        >
          <option value="all">Tous les projets</option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.titre}
            </option>
          ))}
        </select>

        {/* Assignee select */}
        <select
          value={assigneId}
          onChange={(e) => setAssigneId(e.target.value)}
          className="text-[12px] rounded-md outline-none"
          style={{
            padding: "6px 10px",
            background: "var(--rail-panel)",
            border: "1px solid var(--rail-hair)",
            color: "var(--rail-ink)",
          }}
        >
          <option value="all">Tous les assignés</option>
          <option value="none">Non assigné</option>
          {users.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-[12px]" style={{ color: "var(--rail-muted)" }}>
            {filtered.length} tâche{filtered.length !== 1 ? "s" : ""}
          </span>
          <div
            className="inline-flex rounded-md overflow-hidden"
            style={{ border: "1px solid var(--rail-hair)" }}
          >
            {(["liste", "kanban"] as const).map((v, i) => {
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
                    borderRight: i < 1 ? "1px solid var(--rail-hair)" : "none",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
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
          Aucune tâche trouvée pour ces filtres.
        </div>
      ) : view === "liste" ? (
        <ListView
          tasks={filtered}
          cols={cols}
          isPending={isPending}
          onToggle={handleToggle}
        />
      ) : (
        <KanbanView tasks={filtered} onToggle={handleToggle} />
      )}
    </div>
  );
}

// ─── List view ───────────────────────────────────────────

function ListView({
  tasks,
  cols,
  isPending,
  onToggle,
}: {
  tasks: Task[];
  cols: string;
  isPending: boolean;
  onToggle: (taskId: number, projectId: number) => void;
}) {
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
        <span />
        <span>Tâche</span>
        <span>Projet</span>
        <span>Priorité</span>
        <span>Statut</span>
        <span className="text-right">Estim.</span>
        <span>Échéance</span>
        <span>Assigné</span>
      </div>
      {tasks.map((t, i) => {
        const isDone = t.estTerminee || t.statutKanban === "done";
        const overdue = !isDone && isOverdue(t.dateEcheance);
        return (
          <div
            key={t.id}
            className="grid gap-3 items-center text-[13px] transition-colors"
            style={{
              gridTemplateColumns: cols,
              padding: "10px 16px",
              borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
              opacity: isDone ? 0.55 : 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rail-hair3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <button
              type="button"
              onClick={() => onToggle(t.id, t.projectId)}
              disabled={isPending}
              className="h-5 w-5 flex items-center justify-center rounded transition-colors hover:bg-[var(--rail-hair2)]"
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--rail-success)" }} />
              ) : (
                <Circle className="h-4 w-4" style={{ color: "var(--rail-muted)" }} />
              )}
            </button>
            <Link
              href={`/projets/${t.projectId}`}
              className="min-w-0"
            >
              <div
                className="font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                style={{
                  textDecoration: isDone ? "line-through" : "none",
                }}
              >
                {t.titre}
                {t.isOutOfScope && (
                  <span
                    className="ml-2 text-[10px] uppercase"
                    style={{
                      padding: "2px 6px",
                      background: "var(--rail-warn-bg)",
                      color: "var(--rail-warn)",
                      borderRadius: 3,
                      letterSpacing: "0.04em",
                    }}
                  >
                    Hors scope
                  </span>
                )}
              </div>
              {t.categorie && (
                <div
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--rail-muted)" }}
                >
                  {t.categorie}
                </div>
              )}
            </Link>
            <Link
              href={`/projets/${t.projectId}`}
              className="min-w-0"
            >
              <div
                className="text-[12.5px] whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ color: "var(--rail-ink2)" }}
              >
                {t.projectTitre}
              </div>
              {t.clientName && (
                <div
                  className="text-[11px] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ color: "var(--rail-muted)" }}
                >
                  {t.clientName}
                </div>
              )}
            </Link>
            <PrioChip v={t.priorite} />
            <span
              className="text-[11px] inline-block w-fit"
              style={{
                padding: "2px 7px",
                background: "var(--rail-hair2)",
                color: "var(--rail-ink2)",
                borderRadius: 3,
              }}
            >
              {STATUT_LABELS[t.statutKanban] ?? t.statutKanban}
            </span>
            <span
              className="text-right text-[11.5px]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--rail-ink2)",
              }}
            >
              {t.estimationHeures ? `${t.estimationHeures}h` : "—"}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[12px]"
              style={{ color: overdue ? "var(--rail-danger)" : "var(--rail-muted)" }}
            >
              {overdue && <AlertCircle className="h-3 w-3" />}
              {fmtDate(t.dateEcheance)}
            </span>
            {t.assigneName ? (
              <AvatarStack initials={[projectInitials(t.assigneName)]} />
            ) : (
              <span
                className="text-[11px]"
                style={{ color: "var(--rail-muted2)" }}
              >
                Non assigné
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Kanban view ─────────────────────────────────────────

function KanbanView({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (taskId: number, projectId: number) => void;
}) {
  const cols = [
    { id: "todo", l: "À faire" },
    { id: "in_progress", l: "En cours" },
    { id: "review", l: "Relecture" },
    { id: "done", l: "Terminé" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cols.map((c) => {
        const colTasks = tasks.filter((t) => t.statutKanban === c.id);
        return (
          <div
            key={c.id}
            style={{
              background: "var(--rail-panel)",
              border: "1px solid var(--rail-hair)",
              borderRadius: 8,
              minHeight: 320,
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--rail-hair)",
              }}
            >
              <span className="text-[12.5px] font-semibold">{c.l}</span>
              <Hint>{colTasks.length}</Hint>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {colTasks.length === 0 ? (
                <div
                  className="flex items-center justify-center py-8 text-[11.5px]"
                  style={{ color: "var(--rail-muted2)" }}
                >
                  —
                </div>
              ) : (
                colTasks.map((t) => {
                  const isDone = t.statutKanban === "done";
                  const overdue = !isDone && isOverdue(t.dateEcheance);
                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: 10,
                        background: "var(--rail-bg)",
                        border: "1px solid var(--rail-hair)",
                        borderRadius: 6,
                        opacity: isDone ? 0.55 : 1,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <button
                          type="button"
                          onClick={() => onToggle(t.id, t.projectId)}
                          className="h-4 w-4 flex items-center justify-center mt-0.5 shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              style={{ color: "var(--rail-success)" }}
                            />
                          ) : (
                            <Circle
                              className="h-3.5 w-3.5"
                              style={{ color: "var(--rail-muted)" }}
                            />
                          )}
                        </button>
                        <Link
                          href={`/projets/${t.projectId}`}
                          className="text-[12.5px] flex-1 min-w-0 leading-tight"
                          style={{
                            textDecoration: isDone ? "line-through" : "none",
                          }}
                        >
                          {t.titre}
                        </Link>
                      </div>
                      <div
                        className="text-[10.5px] mb-2 whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{ color: "var(--rail-muted)" }}
                      >
                        {t.projectTitre}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <PrioChip v={t.priorite} />
                        <div className="flex items-center gap-1.5">
                          {t.assigneName && (
                            <AvatarStack
                              initials={[projectInitials(t.assigneName)]}
                              size={18}
                            />
                          )}
                          <span
                            className="text-[10.5px]"
                            style={{
                              color: overdue ? "var(--rail-danger)" : "var(--rail-muted)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {fmtDate(t.dateEcheance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────

function KpiTask({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "default" | "warn" | "danger";
}) {
  const accent =
    tone === "danger"
      ? "var(--rail-danger)"
      : tone === "warn"
        ? "var(--rail-warn)"
        : "var(--b-accent)";
  return (
    <div
      style={{
        background: "var(--rail-panel)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 8,
        padding: "16px 18px 14px",
      }}
    >
      <div
        className="text-[11px] tracking-[0.06em] uppercase mb-2"
        style={{ color: "var(--rail-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-[26px] font-semibold tabular leading-tight"
        style={{
          letterSpacing: "-0.5px",
          color: tone === "danger" || tone === "warn" ? accent : "var(--rail-ink)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--rail-muted)" }}>
          {sub}
        </div>
      )}
      <div
        className="mt-2.5 h-0.5 rounded"
        style={{
          background: value === 0 ? "var(--rail-hair)" : accent,
          opacity: value === 0 ? 1 : 0.8,
        }}
      />
    </div>
  );
}
