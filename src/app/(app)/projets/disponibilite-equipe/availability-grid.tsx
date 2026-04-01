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
  Paintbrush,
  GripVertical,
  X,
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

// ─── Helpers ─────────────────────────────────────────────

/** Build ordered list of all slot positions for visible weeks */
function buildSlotPositions(visibleWeeks: WeekInfo[]) {
  const positions: { date: string; period: "AM" | "PM" }[] = [];
  for (const w of visibleWeeks) {
    for (const d of w.days) {
      positions.push({ date: d.date, period: "AM" });
      positions.push({ date: d.date, period: "PM" });
    }
  }
  return positions;
}

function slotKey(date: string, period: "AM" | "PM") {
  return `${date}_${period}`;
}

// ─── Merged cell type ────────────────────────────────────

interface MergedBlock {
  type: "block";
  startIdx: number;
  colspan: number;
  projectId: number;
  projectTitre: string;
  slots: { date: string; period: "AM" | "PM" }[];
  isOverPlan: boolean;
}

interface EmptyCell {
  type: "empty";
  idx: number;
  date: string;
  period: "AM" | "PM";
}

type GridCell = MergedBlock | EmptyCell;

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

  // ─── Active project selection ─────────────────────────
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  function selectProject(id: number) {
    setActiveProjectId((prev) => (prev === id ? null : id));
  }

  // ─── Optimistic slots (source of truth for UI) ────────
  const [optimisticSlots, setOptimisticSlots] = useState<
    Record<number, Record<string, SlotData>>
  >(() => {
    const map: Record<number, Record<string, SlotData>> = {};
    for (const p of people) map[p.id] = { ...p.slots };
    return map;
  });

  const VISIBLE_WEEKS = 4;
  const visibleWeeks = weeks.slice(weekOffset, weekOffset + VISIBLE_WEEKS);
  const slotPositions = useMemo(() => buildSlotPositions(visibleWeeks), [visibleWeeks]);

  // ─── Compute live stats from optimisticSlots ──────────
  const liveProjectStats = useMemo(() => {
    // Count all planned half-days per project from optimistic state
    const planCounts: Record<number, number> = {};
    for (const userSlots of Object.values(optimisticSlots)) {
      for (const slot of Object.values(userSlots)) {
        planCounts[slot.projectId] = (planCounts[slot.projectId] ?? 0) + 0.5;
      }
    }

    const stats: Record<number, ProjectStats> = {};
    // Start from initial stats to get vendus values
    for (const [pidStr, base] of Object.entries(initialProjectStats)) {
      const pid = Number(pidStr);
      const planifies = planCounts[pid] ?? 0;
      stats[pid] = {
        vendus: base.vendus,
        planifies,
        restants: Math.round((base.vendus - planifies) * 10) / 10,
      };
    }
    // Also handle projects that have planned slots but no initial stats
    for (const [pidStr, count] of Object.entries(planCounts)) {
      const pid = Number(pidStr);
      if (!stats[pid]) {
        stats[pid] = { vendus: 0, planifies: count, restants: -count };
      }
    }
    return stats;
  }, [optimisticSlots, initialProjectStats]);

  // ─── Color map ────────────────────────────────────────
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

  // ─── Server mutations ─────────────────────────────────
  const doAssign = useCallback(
    (userId: number, date: string, period: "AM" | "PM", project: ProjectOption) => {
      const key = slotKey(date, period);
      if (optimisticSlots[userId]?.[key]?.projectId === project.id) return;

      setOptimisticSlots((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          [key]: { projectId: project.id, projectTitre: project.titre },
        },
      }));

      startTransition(async () => {
        try {
          await assignSlot(userId, project.id, date, period);
        } catch {
          toast.error("Erreur lors de l'assignation");
        }
      });
    },
    [optimisticSlots],
  );

  const doRemove = useCallback(
    (userId: number, date: string, period: "AM" | "PM") => {
      const key = slotKey(date, period);
      if (!optimisticSlots[userId]?.[key]) return;

      setOptimisticSlots((prev) => {
        const copy = { ...prev, [userId]: { ...prev[userId] } };
        delete copy[userId][key];
        return copy;
      });

      startTransition(async () => {
        try {
          await removeSlot(userId, date, period);
        } catch {
          toast.error("Erreur lors de la suppression");
        }
      });
    },
    [optimisticSlots],
  );

  // ─── Click on empty cell: place active project ────────
  function handleEmptyCellClick(userId: number, date: string, period: "AM" | "PM") {
    if (!activeProject) return;
    doAssign(userId, date, period, activeProject);
  }

  // ─── Click on block: delete it ────────────────────────
  function handleBlockDelete(userId: number, slots: { date: string; period: "AM" | "PM" }[]) {
    for (const s of slots) {
      doRemove(userId, s.date, s.period);
    }
  }

  // ─── Resize logic ─────────────────────────────────────
  const resizeState = useRef<{
    userId: number;
    projectId: number;
    projectTitre: string;
    side: "left" | "right";
    startIdx: number;
    endIdx: number; // inclusive
    originalStartIdx: number;
    originalEndIdx: number;
    startX: number;
  } | null>(null);

  const [resizePreview, setResizePreview] = useState<{
    userId: number;
    startIdx: number;
    endIdx: number;
  } | null>(null);

  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  function registerCellRef(userId: number, idx: number, el: HTMLElement | null) {
    const key = `${userId}_${idx}`;
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  }

  /** Get slot index from a mouse X position within a person row */
  function getSlotIdxFromX(userId: number, clientX: number): number {
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < slotPositions.length; i++) {
      const el = cellRefs.current.get(`${userId}_${i}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - center);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    return closest;
  }

  function handleResizeStart(
    e: React.MouseEvent,
    userId: number,
    block: MergedBlock,
    side: "left" | "right",
  ) {
    e.preventDefault();
    e.stopPropagation();
    const endIdx = block.startIdx + block.colspan - 1;
    resizeState.current = {
      userId,
      projectId: block.projectId,
      projectTitre: block.projectTitre,
      side,
      startIdx: block.startIdx,
      endIdx,
      originalStartIdx: block.startIdx,
      originalEndIdx: endIdx,
      startX: e.clientX,
    };
    setResizePreview({ userId, startIdx: block.startIdx, endIdx });
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const rs = resizeState.current;
      if (!rs) return;

      const newIdx = getSlotIdxFromX(rs.userId, e.clientX);

      let newStart = rs.originalStartIdx;
      let newEnd = rs.originalEndIdx;

      if (rs.side === "right") {
        newEnd = Math.max(rs.originalStartIdx, newIdx);
      } else {
        newStart = Math.min(rs.originalEndIdx, newIdx);
      }

      resizeState.current!.startIdx = newStart;
      resizeState.current!.endIdx = newEnd;
      setResizePreview({ userId: rs.userId, startIdx: newStart, endIdx: newEnd });
    }

    function handleMouseUp() {
      const rs = resizeState.current;
      if (!rs) return;

      const { userId, projectId, projectTitre, originalStartIdx, originalEndIdx, startIdx, endIdx } = rs;

      // Remove slots that are no longer in range
      for (let i = originalStartIdx; i <= originalEndIdx; i++) {
        if (i < startIdx || i > endIdx) {
          const pos = slotPositions[i];
          if (pos) doRemove(userId, pos.date, pos.period);
        }
      }

      // Add new slots that were added by expanding
      for (let i = startIdx; i <= endIdx; i++) {
        if (i < originalStartIdx || i > originalEndIdx) {
          const pos = slotPositions[i];
          if (pos) {
            // Check if slot is free
            const key = slotKey(pos.date, pos.period);
            const existing = optimisticSlots[userId]?.[key];
            if (!existing) {
              doAssign(userId, pos.date, pos.period, { id: projectId, titre: projectTitre });
            }
          }
        }
      }

      resizeState.current = null;
      setResizePreview(null);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [slotPositions, optimisticSlots, doAssign, doRemove]);

  // ─── Compute merged blocks ────────────────────────────
  function getMergedCells(personId: number): GridCell[] {
    const userSlots = optimisticSlots[personId] ?? {};
    const cells: GridCell[] = [];

    let i = 0;
    while (i < slotPositions.length) {
      const pos = slotPositions[i];
      const key = slotKey(pos.date, pos.period);
      const slot = userSlots[key];

      if (!slot) {
        cells.push({ type: "empty", idx: i, date: pos.date, period: pos.period });
        i++;
      } else {
        // Merge consecutive same-project slots
        const startIdx = i;
        const blockSlots: { date: string; period: "AM" | "PM" }[] = [{ date: pos.date, period: pos.period }];
        let j = i + 1;
        while (j < slotPositions.length) {
          const nextPos = slotPositions[j];
          const nextKey = slotKey(nextPos.date, nextPos.period);
          const nextSlot = userSlots[nextKey];
          if (nextSlot?.projectId === slot.projectId) {
            blockSlots.push({ date: nextPos.date, period: nextPos.period });
            j++;
          } else {
            break;
          }
        }

        const isOverPlan = (liveProjectStats[slot.projectId]?.restants ?? 0) < 0;

        cells.push({
          type: "block",
          startIdx,
          colspan: j - i,
          projectId: slot.projectId,
          projectTitre: slot.projectTitre,
          slots: blockSlots,
          isOverPlan,
        });
        i = j;
      }
    }

    return cells;
  }

  // ─── Count occupied per person ────────────────────────
  function countOccupied(userId: number): { used: number; total: number } {
    const userSlots = optimisticSlots[userId] ?? {};
    let used = 0;
    for (const pos of slotPositions) {
      if (userSlots[slotKey(pos.date, pos.period)]) used++;
    }
    return { used, total: slotPositions.length };
  }

  // ─── Projects with stats ──────────────────────────────
  const projectsWithStats = projects
    .map((p) => ({
      ...p,
      stats: liveProjectStats[p.id] ?? { vendus: 0, planifies: 0, restants: 0 },
      color: projectColorMap.get(p.id),
    }))
    .filter((p) => p.stats.vendus > 0 || p.stats.planifies > 0);

  const overPlanProjects = projectsWithStats.filter((p) => p.stats.restants < 0);

  const cursorClass = activeProject ? "cursor-cell" : "cursor-default";

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

      {/* Toolbar: project selector */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Paintbrush className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {activeProject
                ? `Projet sélectionné : ${activeProject.titre}`
                : "Sélectionnez un projet puis cliquez sur les cases pour planifier"}
            </span>
            {activeProject && (
              <button
                onClick={() => setActiveProjectId(null)}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5"
              >
                Désélectionner
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
                  <span>{p.titre}</span>
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
                    <span className="font-medium flex-shrink-0">{p.titre}</span>
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
                      <th key={`${d.date}_AM_h`} colSpan={2} className="px-0.5 py-0.5 text-center text-[10px] text-muted-foreground/60 font-normal border-r">
                        <span className="inline-block w-1/2">AM</span>
                        <span className="inline-block w-1/2">PM</span>
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {
                  const { used, total } = countOccupied(person.id);
                  const ratio = total > 0 ? used / total : 0;
                  const mergedCells = getMergedCells(person.id);

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
                          return (
                            <BlockCell
                              key={`block_${person.id}_${cell.startIdx}`}
                              cell={cell}
                              personId={person.id}
                              color={projectColorMap.get(cell.projectId)}
                              resizePreview={resizePreview}
                              slotPositions={slotPositions}
                              onResizeStart={(e, side) => handleResizeStart(e, person.id, cell, side)}
                              onDelete={() => handleBlockDelete(person.id, cell.slots)}
                              registerCellRef={registerCellRef}
                            />
                          );
                        }

                        // Empty cell
                        const isPreviewTarget =
                          resizePreview &&
                          resizePreview.userId === person.id &&
                          cell.idx >= resizePreview.startIdx &&
                          cell.idx <= resizePreview.endIdx;

                        return (
                          <td
                            key={`empty_${person.id}_${cell.idx}`}
                            ref={(el) => registerCellRef(person.id, cell.idx, el)}
                            className={`px-0 py-0 text-center ${cell.period === "PM" ? "border-r" : ""}`}
                          >
                            <div
                              className={`h-8 transition-colors border border-transparent ${
                                isPreviewTarget
                                  ? "bg-primary/20 border-primary/40"
                                  : activeProject
                                    ? "hover:bg-primary/10 hover:border-primary/30"
                                    : "hover:bg-accent/30"
                              }`}
                              onClick={() => handleEmptyCellClick(person.id, cell.date, cell.period)}
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

      {/* Resize hint */}
      {resizePreview && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background px-3 py-1.5 rounded-md text-sm shadow-lg z-50">
          Relâchez pour confirmer le redimensionnement
        </div>
      )}

      {isPending && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm shadow-lg animate-pulse">
          Enregistrement…
        </div>
      )}
    </div>
  );
}

// ─── Block Cell Component ───────────────────────────────

function BlockCell({
  cell,
  personId,
  color,
  resizePreview,
  slotPositions,
  onResizeStart,
  onDelete,
  registerCellRef,
}: {
  cell: MergedBlock;
  personId: number;
  color: ColorInfo | undefined;
  resizePreview: { userId: number; startIdx: number; endIdx: number } | null;
  slotPositions: { date: string; period: "AM" | "PM" }[];
  onResizeStart: (e: React.MouseEvent, side: "left" | "right") => void;
  onDelete: () => void;
  registerCellRef: (userId: number, idx: number, el: HTMLElement | null) => void;
}) {
  const jours = cell.colspan * 0.5;
  const label =
    cell.colspan >= 4
      ? `${cell.projectTitre} (${jours}j)`
      : cell.colspan >= 2
        ? cell.projectTitre
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 4)
            .toUpperCase()
        : cell.projectTitre
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

  // Check if last slot in block is PM (for border-right)
  const lastPos = slotPositions[cell.startIdx + cell.colspan - 1];
  const needsBorderR = lastPos?.period === "PM";

  return (
    <td
      ref={(el) => {
        // Register each slot index within this merged block
        for (let i = 0; i < cell.colspan; i++) {
          registerCellRef(personId, cell.startIdx + i, el);
        }
      }}
      colSpan={cell.colspan}
      className={`px-0 py-0 text-center ${needsBorderR ? "border-r" : ""}`}
    >
      <div
        className={`group relative h-8 flex items-center justify-center border transition-colors ${
          color?.classes ?? "bg-gray-200"
        } ${cell.isOverPlan ? "ring-1 ring-red-500 ring-inset" : ""} ${
          cell.colspan > 1 ? "rounded-sm mx-px" : "rounded-sm"
        }`}
        title={`${cell.projectTitre} — ${jours}j${cell.isOverPlan ? " ⚠ Dépassement" : ""}`}
      >
        {/* Left resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => onResizeStart(e, "left")}
        >
          <div className="w-0.5 h-4 bg-current opacity-40 rounded-full" />
        </div>

        {/* Label */}
        <span className="text-[9px] font-medium truncate px-2">{label}</span>

        {/* Delete button */}
        <button
          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm hover:bg-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Supprimer"
        >
          <X className="h-2.5 w-2.5" />
        </button>

        {/* Right resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => onResizeStart(e, "right")}
        >
          <div className="w-0.5 h-4 bg-current opacity-40 rounded-full" />
        </div>
      </div>
    </td>
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
