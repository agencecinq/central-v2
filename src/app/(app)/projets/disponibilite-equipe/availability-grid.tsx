"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
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
  kpis: KPIs;
}

// ─── Color palette for projects ──────────────────────────

const PROJECT_COLORS = [
  "bg-blue-200 text-blue-900 border-blue-300",
  "bg-emerald-200 text-emerald-900 border-emerald-300",
  "bg-violet-200 text-violet-900 border-violet-300",
  "bg-amber-200 text-amber-900 border-amber-300",
  "bg-rose-200 text-rose-900 border-rose-300",
  "bg-cyan-200 text-cyan-900 border-cyan-300",
  "bg-orange-200 text-orange-900 border-orange-300",
  "bg-pink-200 text-pink-900 border-pink-300",
  "bg-teal-200 text-teal-900 border-teal-300",
  "bg-indigo-200 text-indigo-900 border-indigo-300",
  "bg-lime-200 text-lime-900 border-lime-300",
  "bg-fuchsia-200 text-fuchsia-900 border-fuchsia-300",
];

// ─── Component ───────────────────────────────────────────

export function AvailabilityGrid({ weeks, people, projects, kpis }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [activePopup, setActivePopup] = useState<{
    userId: number;
    date: string;
    period: "AM" | "PM";
  } | null>(null);

  // Optimistic state for slots
  const [optimisticSlots, setOptimisticSlots] = useState<
    Record<number, Record<string, SlotData>>
  >(() => {
    const map: Record<number, Record<string, SlotData>> = {};
    for (const p of people) map[p.id] = { ...p.slots };
    return map;
  });

  // Show 4 weeks at a time for readability
  const VISIBLE_WEEKS = 4;
  const visibleWeeks = weeks.slice(weekOffset, weekOffset + VISIBLE_WEEKS);

  // Build project color map
  const projectColorMap = useMemo(() => {
    const map = new Map<number, string>();
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

  const handleAssign = useCallback(
    (userId: number, date: string, period: "AM" | "PM", project: ProjectOption) => {
      const slotKey = `${date}_${period}`;

      // Optimistic update
      setOptimisticSlots((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          [slotKey]: { projectId: project.id, projectTitre: project.titre },
        },
      }));
      setActivePopup(null);

      startTransition(async () => {
        try {
          await assignSlot(userId, project.id, date, period);
        } catch {
          toast.error("Erreur lors de l'assignation");
          // Revert optimistic
          setOptimisticSlots((prev) => {
            const copy = { ...prev, [userId]: { ...prev[userId] } };
            delete copy[userId][slotKey];
            return copy;
          });
        }
      });
    },
    [startTransition],
  );

  const handleRemove = useCallback(
    (userId: number, date: string, period: "AM" | "PM") => {
      const slotKey = `${date}_${period}`;
      const old = optimisticSlots[userId]?.[slotKey];

      // Optimistic remove
      setOptimisticSlots((prev) => {
        const copy = { ...prev, [userId]: { ...prev[userId] } };
        delete copy[userId][slotKey];
        return copy;
      });

      startTransition(async () => {
        try {
          await removeSlot(userId, date, period);
        } catch {
          toast.error("Erreur lors de la suppression");
          if (old) {
            setOptimisticSlots((prev) => ({
              ...prev,
              [userId]: { ...prev[userId], [slotKey]: old },
            }));
          }
        }
      });
    },
    [optimisticSlots, startTransition],
  );

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

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          icon={Users}
          label="Équipe"
          value={`${kpis.totalPersonnes} pers.`}
        />
        <KPICard
          icon={TrendingUp}
          label="Taux occupation"
          value={`${kpis.tauxOccupation}%`}
          accent={kpis.tauxOccupation > 90}
        />
        <KPICard
          icon={Calendar}
          label="Demi-journées planifiées"
          value={String(kpis.usedSlots)}
        />
        <KPICard
          icon={Calendar}
          label="Demi-journées dispo"
          value={String(kpis.dispoHalfDays)}
        />
      </div>

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
          Semaines {weekOffset + 1} à{" "}
          {Math.min(weekOffset + VISIBLE_WEEKS, weeks.length)} sur{" "}
          {weeks.length}
        </span>
        <button
          onClick={() =>
            setWeekOffset(
              Math.min(weeks.length - VISIBLE_WEEKS, weekOffset + 1),
            )
          }
          disabled={weekOffset >= weeks.length - VISIBLE_WEEKS}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-30 transition-colors"
        >
          Suivant <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                {/* Week header */}
                <tr className="border-b">
                  <th className="sticky left-0 z-20 bg-card px-3 py-1.5 text-left font-medium text-muted-foreground min-w-[140px] border-r" />
                  {visibleWeeks.map((w) => (
                    <th
                      key={w.key}
                      colSpan={10}
                      className="px-1 py-1.5 text-center font-medium text-muted-foreground border-r capitalize"
                    >
                      Sem. {w.label}
                    </th>
                  ))}
                </tr>
                {/* Day header */}
                <tr className="border-b">
                  <th className="sticky left-0 z-20 bg-card px-3 py-1 text-left font-medium text-muted-foreground min-w-[140px] border-r">
                    Personne
                  </th>
                  {visibleWeeks.map((w) =>
                    w.days.map((d) => (
                      <th
                        key={d.date}
                        colSpan={2}
                        className="px-0.5 py-1 text-center font-medium text-muted-foreground min-w-[64px] border-r"
                      >
                        {d.dayLabel}
                      </th>
                    )),
                  )}
                </tr>
                {/* AM/PM header */}
                <tr className="border-b bg-muted/20">
                  <th className="sticky left-0 z-20 bg-muted/20 px-3 py-0.5 border-r" />
                  {visibleWeeks.map((w) =>
                    w.days.map((d) => (
                      <>
                        <th
                          key={`${d.date}_AM`}
                          className="px-0.5 py-0.5 text-center text-[10px] text-muted-foreground/60 font-normal min-w-[32px]"
                        >
                          AM
                        </th>
                        <th
                          key={`${d.date}_PM`}
                          className="px-0.5 py-0.5 text-center text-[10px] text-muted-foreground/60 font-normal min-w-[32px] border-r"
                        >
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

                  return (
                    <tr
                      key={person.id}
                      className="border-b hover:bg-muted/10 transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r">
                        <p className="font-medium text-sm truncate max-w-[130px]">
                          {person.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {person.metiers.length > 0 && (
                            <span className="text-muted-foreground text-[10px] truncate max-w-[80px]">
                              {person.metiers.join(", ")}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-medium ${
                              ratio > 0.8
                                ? "text-red-600"
                                : ratio > 0.5
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                            }`}
                          >
                            {Math.round(ratio * 100)}%
                          </span>
                        </div>
                      </td>
                      {visibleWeeks.map((w) =>
                        w.days.map((d) =>
                          (["AM", "PM"] as const).map((period) => {
                            const slotKey = `${d.date}_${period}`;
                            const slot =
                              optimisticSlots[person.id]?.[slotKey];
                            const isActive =
                              activePopup?.userId === person.id &&
                              activePopup?.date === d.date &&
                              activePopup?.period === period;
                            const color = slot
                              ? projectColorMap.get(slot.projectId) ??
                                "bg-gray-200"
                              : "";

                            return (
                              <td
                                key={slotKey}
                                className={`relative px-0 py-0 text-center ${
                                  period === "PM" ? "border-r" : ""
                                }`}
                              >
                                {slot ? (
                                  <div
                                    className={`group h-8 flex items-center justify-center cursor-pointer border ${color} transition-colors`}
                                    title={`${slot.projectTitre} — ${d.dayLabel} ${period}`}
                                    onClick={() =>
                                      handleRemove(
                                        person.id,
                                        d.date,
                                        period,
                                      )
                                    }
                                  >
                                    <span className="text-[9px] font-medium truncate max-w-[28px] group-hover:hidden">
                                      {slot.projectTitre
                                        .split(" ")
                                        .map((w) => w[0])
                                        .join("")
                                        .slice(0, 3)
                                        .toUpperCase()}
                                    </span>
                                    <X className="h-3 w-3 hidden group-hover:block text-red-600" />
                                  </div>
                                ) : (
                                  <div
                                    className="h-8 flex items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                                    onClick={() =>
                                      setActivePopup(
                                        isActive
                                          ? null
                                          : {
                                              userId: person.id,
                                              date: d.date,
                                              period,
                                            },
                                      )
                                    }
                                  />
                                )}

                                {/* Project picker popup */}
                                {isActive && (
                                  <div className="absolute z-50 top-full left-0 mt-0.5 w-48 bg-popover border rounded-md shadow-lg p-1 max-h-48 overflow-y-auto">
                                    {projects.map((proj) => {
                                      const projColor =
                                        projectColorMap.get(proj.id) ??
                                        "bg-gray-100";
                                      return (
                                        <button
                                          key={proj.id}
                                          className={`w-full text-left px-2 py-1 text-xs rounded hover:opacity-80 transition-opacity truncate ${projColor}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAssign(
                                              person.id,
                                              d.date,
                                              period,
                                              proj,
                                            );
                                          }}
                                        >
                                          {proj.titre}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          }),
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">Projets :</span>
        {projects
          .filter((p) => projectColorMap.has(p.id))
          .slice(0, 12)
          .map((p) => (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${projectColorMap.get(p.id)}`}
            >
              {p.titre}
            </span>
          ))}
      </div>

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
      <p
        className={`text-lg font-semibold tabular-nums ${accent ? "text-red-600" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
