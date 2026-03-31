"use client";

import {
  useState,
  useTransition,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Eraser,
  Paintbrush,
} from "lucide-react";
import { assignSlot, removeSlot } from "./actions";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────

interface DayInfo {
  date: string;
  dayLabel: string;
}

interface WeekInfo {
  key: string;
  label: string;
  monthLabel: string;
  days: DayInfo[];
}

interface SlotData {
  projectId: number;
  projectTitre: string;
}

interface Person {
  id: number;
  name: string;
  metiers: string[];
  slots: Record<string, SlotData>;
}

interface ProjectOption {
  id: number;
  titre: string;
}

interface ProjectStats {
  vendus: number;
  planifies: number;
  restants: number;
}

interface KPIs {
  totalPersonnes: number;
  totalSlots: number;
  usedSlots: number;
  tauxOccupation: number;
  dispoHalfDays: number;
}

interface Props {
  weeks: WeekInfo[];
  people: Person[];
  projects: ProjectOption[];
  projectStats: Record<number, ProjectStats>;
  kpis: KPIs;
}

// ─── Color palette ───────────────────────────────────────

const PROJECT_COLORS = [
  { classes: "bg-blue-200 text-blue-900 border-blue-300", hex: "#bfdbfe", ring: "ring-blue-400" },
  { classes: "bg-emerald-200 text-emerald-900 border-emerald-300", hex: "#a7f3d0", ring: "ring-emerald-400" },
  { classes: "bg-violet-200 text-violet-900 border-violet-300", hex: "#c4b5fd", ring: "ring-violet-400" },
  { classes: "bg-amber-200 text-amber-900 border-amber-300", hex: "#fde68a", ring: "ring-amber-400" },
  { classes: "bg-rose-200 text-rose-900 border-rose-300", hex: "#fecdd3", ring: "ring-rose-400" },
  { classes: "bg-cyan-200 text-cyan-900 border-cyan-300", hex: "#a5f3fc", ring: "ring-cyan-400" },
  { classes: "bg-orange-200 text-orange-900 border-orange-300", hex: "#fed7aa", ring: "ring-orange-400" },
  { classes: "bg-pink-200 text-pink-900 border-pink-300", hex: "#fbcfe8", ring: "ring-pink-400" },
  { classes: "bg-teal-200 text-teal-900 border-teal-300", hex: "#99f6e4", ring: "ring-teal-400" },
  { classes: "bg-indigo-200 text-indigo-900 border-indigo-300", hex: "#c7d2fe", ring: "ring-indigo-400" },
  { classes: "bg-lime-200 text-lime-900 border-lime-300", hex: "#d9f99d", ring: "ring-lime-400" },
  { classes: "bg-fuchsia-200 text-fuchsia-900 border-fuchsia-300", hex: "#f0abfc", ring: "ring-fuchsia-400" },
];

type ColorInfo = (typeof PROJECT_COLORS)[number];

// ─── Component ───────────────────────────────────────────

export function AvailabilityGrid({
  weeks,
  people,
  projects,
  projectStats: initialProjectStats,
  kpis,
}: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [isPending, startTransition] = useTransition();

  // ─── Active brush: selected project or eraser ──────────
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [eraserMode, setEraserMode] = useState(false);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  function selectProject(id: number) {
    setEraserMode(false);
    setActiveProjectId((prev) => (prev === id ? null : id));
  }

  function toggleEraser() {
    setActiveProjectId(null);
    setEraserMode((prev) => !prev);
  }

  // ─── Optimistic state ──────────────────────────────────
  const [optimisticSlots, setOptimisticSlots] = useState<
    Record<number, Record<string, SlotData>>
  >(() => {
    const map: Record<number, Record<string, SlotData>> = {};
    for (const p of people) map[p.id] = { ...p.slots };
    return map;
  });

  const [statsDelta, setStatsDelta] = useState<Record<number, number>>({});

  const VISIBLE_WEEKS = 4;
  const visibleWeeks = weeks.slice(weekOffset, weekOffset + VISIBLE_WEEKS);

  // Live project stats
  const liveProjectStats = useMemo(() => {
    const stats: Record<number, ProjectStats> = {};
    for (const [pidStr, base] of Object.entries(initialProjectStats)) {
      const pid = Number(pidStr);
      const delta = statsDelta[pid] ?? 0;
      const planifies = Math.round((base.planifies + delta) * 10) / 10;
      stats[pid] = {
        vendus: base.vendus,
        planifies,
        restants: Math.round((base.vendus - planifies) * 10) / 10,
      };
    }
    return stats;
  }, [initialProjectStats, statsDelta]);

  // Project color map
  const projectColorMap = useMemo(() => {
    const map = new Map<number, ColorInfo>();
    const allProjectIds = new Set<number>();
    for (const person of people) {
      for (const slot of Object.values(person.slots)) {
        allProjectIds.add(slot.projectId);
      }
    }
    for (const p of projects) allProjectIds.add(p.id);
    let idx = 0;
    for (const pid of allProjectIds) {
      map.set(pid, PROJECT_COLORS[idx % PROJECT_COLORS.length]);
      idx++;
    }
    return map;
  }, [people, projects]);

  // ─── Painting (drag) ──────────────────────────────────
  const isPainting = useRef(false);
  const paintUserId = useRef<number | null>(null);

  const doAssign = useCallback(
    (userId: number, date: string, period: "AM" | "PM", project: ProjectOption) => {
      const slotKey = `${date}_${period}`;
      if (optimisticSlots[userId]?.[slotKey]?.projectId === project.id) return;

      // If replacing another project, adjust delta
      const existing = optimisticSlots[userId]?.[slotKey];
      if (existing) {
        setStatsDelta((prev) => ({
          ...prev,
          [existing.projectId]: (prev[existing.projectId] ?? 0) - 0.5,
        }));
      }

      setOptimisticSlots((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          [slotKey]: { projectId: project.id, projectTitre: project.titre },
        },
      }));
      setStatsDelta((prev) => ({
        ...prev,
        [project.id]: (prev[project.id] ?? 0) + 0.5,
      }));

      startTransition(async () => {
        try {
          await assignSlot(userId, project.id, date, period);
        } catch {
          toast.error("Erreur lors de l'assignation");
        }
      });
    },
    [optimisticSlots, startTransition],
  );

  const doRemove = useCallback(
    (userId: number, date: string, period: "AM" | "PM") => {
      const slotKey = `${date}_${period}`;
      const old = optimisticSlots[userId]?.[slotKey];
      if (!old) return;

      setOptimisticSlots((prev) => {
        const copy = { ...prev, [userId]: { ...prev[userId] } };
        delete copy[userId][slotKey];
        return copy;
      });
      setStatsDelta((prev) => ({
        ...prev,
        [old.projectId]: (prev[old.projectId] ?? 0) - 0.5,
      }));

      startTransition(async () => {
        try {
          await removeSlot(userId, date, period);
        } catch {
          toast.error("Erreur lors de la suppression");
        }
      });
    },
    [optimisticSlots, startTransition],
  );

  function handleCellAction(userId: number, date: string, period: "AM" | "PM") {
    const slotKey = `${date}_${period}`;
    const existing = optimisticSlots[userId]?.[slotKey];

    if (eraserMode) {
      if (existing) doRemove(userId, date, period);
      return;
    }

    if (activeProject) {
      if (existing?.projectId === activeProject.id) {
        // Toggle off if same project
        doRemove(userId, date, period);
      } else {
        doAssign(userId, date, period, activeProject);
      }
      return;
    }

    // No tool selected: if occupied, remove
    if (existing) {
      doRemove(userId, date, period);
    }
  }

  function handleMouseDown(userId: number, date: string, period: "AM" | "PM") {
    if (!activeProject && !eraserMode) return;
    isPainting.current = true;
    paintUserId.current = userId;
    handleCellAction(userId, date, period);
  }

  function handleMouseEnter(userId: number, date: string, period: "AM" | "PM") {
    if (!isPainting.current || paintUserId.current !== userId) return;
    handleCellAction(userId, date, period);
  }

  useEffect(() => {
    function stop() {
      isPainting.current = false;
      paintUserId.current = null;
    }
    document.addEventListener("mouseup", stop);
    return () => document.removeEventListener("mouseup", stop);
  }, []);

  // ─── Compute merged blocks for a person row ───────────
  // Returns an array of cells: either a merged block or an empty slot
  function getMergedCells(person: Person) {
    const allSlotKeys: { date: string; period: "AM" | "PM"; weekIdx: number; dayIdx: number; halfIdx: number }[] = [];
    for (let wi = 0; wi < visibleWeeks.length; wi++) {
      const w = visibleWeeks[wi];
      for (let di = 0; di < w.days.length; di++) {
        const d = w.days[di];
        allSlotKeys.push({ date: d.date, period: "AM", weekIdx: wi, dayIdx: di, halfIdx: 0 });
        allSlotKeys.push({ date: d.date, period: "PM", weekIdx: wi, dayIdx: di, halfIdx: 1 });
      }
    }

    const cells: {
      type: "empty" | "block";
      slotKey: string;
      date: string;
      period: "AM" | "PM";
      colspan: number;
      projectId?: number;
      projectTitre?: string;
      isOverPlan?: boolean;
    }[] = [];

    let i = 0;
    while (i < allSlotKeys.length) {
      const s = allSlotKeys[i];
      const slotKey = `${s.date}_${s.period}`;
      const slot = optimisticSlots[person.id]?.[slotKey];

      if (!slot) {
        cells.push({
          type: "empty",
          slotKey,
          date: s.date,
          period: s.period,
          colspan: 1,
        });
        i++;
      } else {
        // Merge consecutive slots with the same project
        let span = 1;
        let j = i + 1;
        while (j < allSlotKeys.length) {
          const next = allSlotKeys[j];
          const nextKey = `${next.date}_${next.period}`;
          const nextSlot = optimisticSlots[person.id]?.[nextKey];
          if (nextSlot?.projectId === slot.projectId) {
            span++;
            j++;
          } else {
            break;
          }
        }

        const isOverPlan = (liveProjectStats[slot.projectId]?.restants ?? 0) < 0;

        cells.push({
          type: "block",
          slotKey,
          date: s.date,
          period: s.period,
          colspan: span,
          projectId: slot.projectId,
          projectTitre: slot.projectTitre,
          isOverPlan,
        });

        i = j;
      }
    }

    return cells;
  }

  // Count occupied per person for visible weeks
  function countOccupied(userId: number): { used: number; total: number } {
    const userSlots = optimisticSlots[userId] ?? {};
    let used = 0;
    for (const week of visibleWeeks) {
      for (const day of week.days) {
        if (userSlots[`${day.date}_AM`]) used++;
        if (userSlots[`${day.date}_PM`]) used++;
      }
    }
    return { used, total: visibleWeeks.length * 10 };
  }

  // Projects with stats
  const projectsWithStats = projects
    .map((p) => ({
      ...p,
      stats: liveProjectStats[p.id] ?? { vendus: 0, planifies: 0, restants: 0 },
      color: projectColorMap.get(p.id),
    }))
    .filter((p) => p.stats.vendus > 0 || p.stats.planifies > 0);

  const overPlanProjects = projectsWithStats.filter((p) => p.stats.restants < 0);

  // Cursor style
  const cursorClass =
    activeProject || eraserMode ? "cursor-crosshair" : "cursor-default";

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={Users} label="Équipe" value={`${kpis.totalPersonnes} pers.`} />
        <KPICard icon={TrendingUp} label="Taux occupation" value={`${kpis.tauxOccupation}%`} accent={kpis.tauxOccupation > 90} />
        <KPICard icon={Calendar} label="½ journées planifiées" value={String(kpis.usedSlots)} />
        <KPICard icon={Calendar} label="½ journées dispo" value={String(kpis.dispoHalfDays)} />
      </div>

      {/* Alerts */}
      {overPlanProjects.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-1">
            <AlertTriangle className="h-4 w-4" />
            Dépassement de jours vendus
          </div>
          <div className="flex flex-wrap gap-3">
            {overPlanProjects.map((p) => (
              <span key={p.id} className="text-xs text-red-700 font-medium">
                {p.titre} : {p.stats.planifies}j planifiés / {p.stats.vendus}j vendus ({Math.abs(p.stats.restants)}j en trop)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar: project selector + eraser */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Paintbrush className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {activeProject
                ? `Pinceau : ${activeProject.titre}`
                : eraserMode
                  ? "Mode gomme"
                  : "Sélectionnez un projet pour commencer à planifier"}
            </span>
            {(activeProject || eraserMode) && (
              <button
                onClick={() => {
                  setActiveProjectId(null);
                  setEraserMode(false);
                }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5"
              >
                Désélectionner
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Eraser */}
            <button
              onClick={toggleEraser}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-all ${
                eraserMode
                  ? "bg-foreground text-background border-foreground ring-2 ring-foreground/30"
                  : "bg-muted text-muted-foreground hover:bg-accent border-border"
              }`}
            >
              <Eraser className="h-3 w-3" />
              Gomme
            </button>
            {/* Project buttons */}
            {projects.map((p) => {
              const color = projectColorMap.get(p.id);
              const isActive = activeProjectId === p.id;
              const stats = liveProjectStats[p.id];
              const isOver = stats && stats.restants < 0;

              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-all ${
                    color?.classes ?? "bg-gray-100"
                  } ${isActive ? `ring-2 ${color?.ring ?? "ring-primary"} shadow-sm` : "opacity-70 hover:opacity-100"}`}
                >
                  <span className="truncate max-w-[120px]">{p.titre}</span>
                  {stats && stats.vendus > 0 && (
                    <span
                      className={`text-[10px] tabular-nums ${
                        isOver ? "text-red-700 font-bold" : "opacity-60"
                      }`}
                    >
                      {stats.restants}j
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Project stats */}
      {projectsWithStats.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-sm font-medium mb-2">Jours par projet</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {projectsWithStats.map((p) => {
                const pct =
                  p.stats.vendus > 0
                    ? Math.min(100, Math.round((p.stats.planifies / p.stats.vendus) * 100))
                    : p.stats.planifies > 0
                      ? 100
                      : 0;
                const isOver = p.stats.restants < 0;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${
                      isOver ? "border-red-300 bg-red-50" : "border-border"
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-sm flex-shrink-0 border"
                      style={{ backgroundColor: p.color?.hex ?? "#e5e7eb" }}
                    />
                    <span className="font-medium truncate flex-1 min-w-0">{p.titre}</span>
                    <span className="tabular-nums text-muted-foreground flex-shrink-0">
                      {p.stats.planifies}
                    </span>
                    <span className="text-muted-foreground/50">/</span>
                    <span className="tabular-nums flex-shrink-0">{p.stats.vendus}j</span>
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOver ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span
                      className={`tabular-nums text-[10px] font-medium flex-shrink-0 ${
                        isOver
                          ? "text-red-600"
                          : p.stats.restants <= 2
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {isOver ? `+${Math.abs(p.stats.restants)}` : p.stats.restants}j
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
          disabled={weekOffset === 0}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Précédent
        </button>
        <span className="text-sm text-muted-foreground">
          Semaines {weekOffset + 1} à {Math.min(weekOffset + VISIBLE_WEEKS, weeks.length)} sur {weeks.length}
        </span>
        <button
          onClick={() => setWeekOffset(Math.min(weeks.length - VISIBLE_WEEKS, weekOffset + 1))}
          disabled={weekOffset >= weeks.length - VISIBLE_WEEKS}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-30 transition-colors"
        >
          Suivant <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          <div className={`overflow-x-auto select-none ${cursorClass}`}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-20 bg-card px-3 py-1.5 text-left font-medium text-muted-foreground min-w-[140px] border-r" />
                  {visibleWeeks.map((w) => (
                    <th key={w.key} colSpan={10} className="px-1 py-1.5 text-center font-medium text-muted-foreground border-r capitalize">
                      Sem. {w.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-b">
                  <th className="sticky left-0 z-20 bg-card px-3 py-1 text-left font-medium text-muted-foreground min-w-[140px] border-r">
                    Personne
                  </th>
                  {visibleWeeks.map((w) =>
                    w.days.map((d) => (
                      <th key={d.date} colSpan={2} className="px-0.5 py-1 text-center font-medium text-muted-foreground min-w-[64px] border-r">
                        {d.dayLabel}
                      </th>
                    )),
                  )}
                </tr>
                <tr className="border-b bg-muted/20">
                  <th className="sticky left-0 z-20 bg-muted/20 px-3 py-0.5 border-r" />
                  {visibleWeeks.map((w) =>
                    w.days.map((d) => (
                      <>
                        <th key={`${d.date}_AM_h`} className="px-0.5 py-0.5 text-center text-[10px] text-muted-foreground/60 font-normal min-w-[32px]">
                          AM
                        </th>
                        <th key={`${d.date}_PM_h`} className="px-0.5 py-0.5 text-center text-[10px] text-muted-foreground/60 font-normal min-w-[32px] border-r">
                          PM
                        </th>
                      </>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {
                  const { used, total } = countOccupied(person.id);
                  const ratio = total > 0 ? used / total : 0;
                  const mergedCells = getMergedCells(person);

                  return (
                    <tr key={person.id} className="border-b hover:bg-muted/10 transition-colors">
                      <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r">
                        <p className="font-medium text-sm truncate max-w-[130px]">{person.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {person.metiers.length > 0 && (
                            <span className="text-muted-foreground text-[10px] truncate max-w-[80px]">
                              {person.metiers.join(", ")}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-medium ${
                              ratio > 0.8 ? "text-red-600" : ratio > 0.5 ? "text-amber-600" : "text-emerald-600"
                            }`}
                          >
                            {Math.round(ratio * 100)}%
                          </span>
                        </div>
                      </td>
                      {mergedCells.map((cell) => {
                        if (cell.type === "block") {
                          const color = projectColorMap.get(cell.projectId!);
                          const jours = cell.colspan * 0.5;

                          return (
                            <td
                              key={cell.slotKey}
                              colSpan={cell.colspan}
                              className="px-0 py-0 text-center"
                            >
                              <div
                                className={`group h-8 flex items-center justify-center border transition-colors ${
                                  color?.classes ?? "bg-gray-200"
                                } ${cell.isOverPlan ? "ring-1 ring-red-500 ring-inset" : ""} ${
                                  cell.colspan > 1 ? "rounded-sm mx-px" : ""
                                }`}
                                title={`${cell.projectTitre} — ${jours}j${cell.isOverPlan ? " ⚠ Dépassement" : ""}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleMouseDown(person.id, cell.date, cell.period);
                                }}
                                onMouseEnter={() => handleMouseEnter(person.id, cell.date, cell.period)}
                              >
                                <span className="text-[9px] font-medium whitespace-nowrap px-0.5">
                                  {cell.projectTitre}{cell.colspan >= 4 ? ` (${jours}j)` : ""}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        // Empty cell
                        return (
                          <td key={cell.slotKey} className={`px-0 py-0 text-center ${cell.period === "PM" ? "border-r" : ""}`}>
                            <div
                              className={`h-8 transition-colors border border-transparent ${
                                activeProject
                                  ? "hover:border-primary/40"
                                  : eraserMode
                                    ? ""
                                    : "hover:bg-accent/30"
                              }`}
                              style={
                                activeProject
                                  ? {
                                      backgroundColor: `${projectColorMap.get(activeProject.id)?.hex ?? "#e5e7eb"}40`,
                                    }
                                  : undefined
                              }
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleMouseDown(person.id, cell.date, cell.period);
                              }}
                              onMouseEnter={() => handleMouseEnter(person.id, cell.date, cell.period)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isPending && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm shadow-lg animate-pulse">
          Enregistrement…
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-lg font-semibold tabular-nums ${accent ? "text-red-600" : ""}`}>
        {value}
      </p>
    </div>
  );
}
