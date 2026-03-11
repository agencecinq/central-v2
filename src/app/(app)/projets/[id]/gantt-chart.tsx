"use client";

import { useMemo, useState } from "react";

interface PhaseItem {
  id: number;
  metierId: number;
  metierNom: string;
  joursPrevus: number;
  dateDebut: string | null;
  dateFin: string | null;
}

interface Task {
  id: number;
  titre: string;
  description: string | null;
  statutKanban: string;
  categorie: string | null;
  priorityLevel: number;
  estimationHeures: number | null;
  dateEcheance: string | null;
  dateDebut: string | null;
  allocationId: number | null;
  assignee: string | null;
  userId: number | null;
  isOutOfScope: boolean;
}

interface GanttGroup {
  type: "phase" | "unassigned";
  phase: PhaseItem | null;
  label: string;
  tasks: Task[];
  startDate: Date | null;
  endDate: Date | null;
}

// ─── Helpers ──────────────────────────────────────────────

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

// ─── Component ───────────────────────────────────────────

export function GanttChart({
  phases,
  tasks,
  onTaskClick,
}: {
  phases: PhaseItem[];
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Build groups: phases with their tasks + unassigned group
  const groups = useMemo<GanttGroup[]>(() => {
    const result: GanttGroup[] = [];

    for (const phase of phases) {
      const phaseTasks = tasks.filter((t) => t.allocationId === phase.id);
      const pStart = parseDate(phase.dateDebut);
      const pEnd = parseDate(phase.dateFin);
      result.push({
        type: "phase",
        phase,
        label: phase.metierNom,
        tasks: phaseTasks,
        startDate: pStart,
        endDate: pEnd,
      });
    }

    const unassigned = tasks.filter(
      (t) => !t.allocationId || !phases.some((p) => p.id === t.allocationId),
    );
    if (unassigned.length > 0) {
      result.push({
        type: "unassigned",
        phase: null,
        label: "Non assigné",
        tasks: unassigned,
        startDate: null,
        endDate: null,
      });
    }

    return result;
  }, [phases, tasks]);

  // Compute timeline range from all dates
  const { timelineStart, timelineEnd, totalDays, columns } = useMemo(() => {
    const allDates: Date[] = [];
    const today = startOfDay(new Date());
    allDates.push(today);

    for (const g of groups) {
      if (g.startDate) allDates.push(g.startDate);
      if (g.endDate) allDates.push(g.endDate);
      for (const t of g.tasks) {
        const tStart = parseDate(t.dateDebut);
        const tEnd = parseDate(t.dateEcheance);
        if (tStart) allDates.push(tStart);
        if (tEnd) allDates.push(tEnd);
      }
    }

    if (allDates.length < 2) {
      // Fallback: show 30 days from today
      allDates.push(addDays(today, 30));
    }

    let minDate = allDates.reduce((a, b) => (a < b ? a : b));
    let maxDate = allDates.reduce((a, b) => (a > b ? a : b));

    // Add margin
    minDate = addDays(getMonday(minDate), -7);
    maxDate = addDays(maxDate, 14);

    const total = Math.max(diffDays(minDate, maxDate), 14);

    // Build column headers (weeks)
    const cols: { date: Date; label: string; isMonth: boolean }[] = [];
    let current = new Date(minDate);
    while (current <= maxDate) {
      cols.push({
        date: new Date(current),
        label: formatShortDate(current),
        isMonth: current.getDate() <= 7,
      });
      current = addDays(current, 7);
    }

    return { timelineStart: minDate, timelineEnd: maxDate, totalDays: total, columns: cols };
  }, [groups]);

  // Bar position helpers
  function getBarStyle(start: Date | null, end: Date | null): React.CSSProperties | null {
    if (!start && !end) return null;
    const s = start ?? end!;
    const e = end ?? start!;
    const left = Math.max(0, diffDays(timelineStart, s));
    const width = Math.max(1, diffDays(s, e) + 1);
    return {
      left: `${(left / totalDays) * 100}%`,
      width: `${(width / totalDays) * 100}%`,
    };
  }

  // Today marker position
  const today = startOfDay(new Date());
  const todayPct = (diffDays(timelineStart, today) / totalDays) * 100;
  const showToday = todayPct >= 0 && todayPct <= 100;

  // Month headers
  const months = useMemo(() => {
    const result: { label: string; left: number; width: number }[] = [];
    let current = new Date(timelineStart);
    while (current <= timelineEnd) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const clampedStart = monthStart < timelineStart ? timelineStart : monthStart;
      const clampedEnd = monthEnd > timelineEnd ? timelineEnd : monthEnd;
      const left = diffDays(timelineStart, clampedStart);
      const width = diffDays(clampedStart, clampedEnd) + 1;
      result.push({
        label: clampedStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        left: (left / totalDays) * 100,
        width: (width / totalDays) * 100,
      });
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    return result;
  }, [timelineStart, timelineEnd, totalDays]);

  if (groups.length === 0 || (phases.length === 0 && tasks.length === 0)) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
        Ajoutez des phases et des tâches avec des dates pour voir le diagramme de Gantt.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex">
        {/* Left: Labels column */}
        <div className="w-52 shrink-0 border-r bg-card z-10">
          {/* Month header spacer */}
          <div className="h-7 border-b" />
          {/* Week header spacer */}
          <div className="h-7 border-b" />
          {/* Rows */}
          {groups.map((g) => {
            const key = g.phase ? `phase-${g.phase.id}` : "unassigned";
            const isCollapsed = collapsed.has(key);
            return (
              <div key={key}>
                {/* Group header */}
                <div
                  className="flex h-8 items-center gap-1.5 border-b px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCollapse(key)}
                >
                  <svg
                    className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    viewBox="0 0 12 12"
                  >
                    <path d="M3 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span className="text-xs font-semibold truncate">{g.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {g.tasks.length}
                  </span>
                </div>
                {/* Task rows */}
                {!isCollapsed &&
                  g.tasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex h-7 items-center border-b px-2 pl-6 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onTaskClick(t)}
                    >
                      <span className="text-xs truncate text-muted-foreground">
                        {t.titre}
                      </span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>

        {/* Right: Timeline */}
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[600px] relative">
            {/* Month headers */}
            <div className="h-7 border-b relative">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center px-2 text-[10px] font-medium text-muted-foreground capitalize border-r"
                  style={{ left: `${m.left}%`, width: `${m.width}%` }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Week headers */}
            <div className="h-7 border-b relative">
              {columns.map((col, i) => {
                const colWidth = (7 / totalDays) * 100;
                const colLeft = (diffDays(timelineStart, col.date) / totalDays) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center justify-center text-[10px] text-muted-foreground border-r"
                    style={{ left: `${colLeft}%`, width: `${colWidth}%` }}
                  >
                    {formatShortDate(col.date)}
                  </div>
                );
              })}
            </div>

            {/* Rows with bars */}
            {groups.map((g) => {
              const key = g.phase ? `phase-${g.phase.id}` : "unassigned";
              const isCollapsed = collapsed.has(key);
              const phaseBar = getBarStyle(g.startDate, g.endDate);

              return (
                <div key={key}>
                  {/* Phase bar row */}
                  <div className="h-8 border-b relative">
                    {/* Week grid lines */}
                    {columns.map((col, i) => {
                      const colLeft = (diffDays(timelineStart, col.date) / totalDays) * 100;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 h-full border-r border-muted/30"
                          style={{ left: `${colLeft}%` }}
                        />
                      );
                    })}
                    {phaseBar && (
                      <div
                        className="absolute top-1.5 h-5 rounded border bg-primary/15 border-primary/30"
                        style={phaseBar}
                      />
                    )}
                  </div>

                  {/* Task bar rows */}
                  {!isCollapsed &&
                    g.tasks.map((t) => {
                      const tStart = parseDate(t.dateDebut);
                      const tEnd = parseDate(t.dateEcheance);
                      const barStyle = getBarStyle(tStart, tEnd);
                      const isDone = t.statutKanban === "done";

                      return (
                        <div
                          key={t.id}
                          className="h-7 border-b relative cursor-pointer"
                          onClick={() => onTaskClick(t)}
                        >
                          {/* Week grid lines */}
                          {columns.map((col, i) => {
                            const colLeft = (diffDays(timelineStart, col.date) / totalDays) * 100;
                            return (
                              <div
                                key={i}
                                className="absolute top-0 h-full border-r border-muted/30"
                                style={{ left: `${colLeft}%` }}
                              />
                            );
                          })}
                          {barStyle && (
                            <div
                              className={`absolute top-1.5 h-4 rounded-sm ${
                                isDone
                                  ? "bg-emerald-500/80"
                                  : "bg-blue-500/80"
                              }`}
                              style={barStyle}
                            >
                              <span className="px-1 text-[10px] text-white truncate block leading-4">
                                {t.titre}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {/* Today marker */}
            {showToday && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                style={{ left: `${todayPct}%` }}
              >
                <div className="absolute -top-0 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1 rounded-b">
                  Auj.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
