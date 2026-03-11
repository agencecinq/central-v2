"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface ProjectCharge {
  projectId: number;
  projectTitre: string;
  jours: number;
}

interface MetierRow {
  metierId: number;
  metierNom: string;
  nbPersonnes: number;
  capaciteHebdo: number;
  weeks: Record<
    string,
    { charge: number; dispo: number; projects: ProjectCharge[] }
  >;
}

interface SummaryRow {
  capaciteHebdo: number;
  weeks: Record<string, { charge: number; dispo: number }>;
}

interface WeekCol {
  key: string;
  label: string;
  monthLabel: string;
}

interface KPIs {
  totalPersonnes: number;
  capaciteHebdo: number;
  tauxOccupation: number;
  totalDispoSur12Sem: number;
  semainesEnSurcharge: number;
}

// ─── Helpers ──────────────────────────────────────────────

/** Couleur basée sur la disponibilité */
function dispoColor(dispo: number, capacity: number): string {
  if (capacity <= 0) return "";
  const pctDispo = dispo / capacity;
  if (pctDispo > 0.5) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (pctDispo > 0) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}

function dispoColorSummary(dispo: number, capacity: number): string {
  if (capacity <= 0) return "";
  const pctDispo = dispo / capacity;
  if (pctDispo > 0.5) return "bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200";
  if (pctDispo > 0) return "bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200";
  return "bg-red-200/80 text-red-900 dark:bg-red-900/60 dark:text-red-200";
}

function formatDispo(dispo: number): string {
  const rounded = Math.round(dispo * 10) / 10;
  if (rounded === 0) return "0j";
  const formatted = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return `${formatted}j`;
}

function formatPct(pct: number): string {
  return `${pct}%`;
}

/** Regroupe les semaines consécutives ayant le même monthLabel */
function getMonthSpans(weeks: WeekCol[]): { label: string; span: number }[] {
  const result: { label: string; span: number }[] = [];
  for (const w of weeks) {
    const last = result[result.length - 1];
    if (last && last.label === w.monthLabel) {
      last.span++;
    } else {
      result.push({ label: w.monthLabel, span: 1 });
    }
  }
  return result;
}

// ─── Component ────────────────────────────────────────────

export function PlanningView({
  weeks,
  metierRows,
  summaryRow,
  kpis,
}: {
  weeks: WeekCol[];
  metierRows: MetierRow[];
  summaryRow: SummaryRow;
  kpis: KPIs;
}) {
  const monthSpans = getMonthSpans(weeks);

  // Gauge color
  const gaugeColor =
    kpis.tauxOccupation > 100
      ? "text-red-600 dark:text-red-400"
      : kpis.tauxOccupation > 70
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-5">
      {/* KPI row — compact */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Équipe</p>
          <p className="text-xl font-bold tabular-nums">
            {kpis.totalPersonnes}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              pers.
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Capacité / sem</p>
          <p className="text-xl font-bold tabular-nums">
            {kpis.capaciteHebdo}j
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Taux d&apos;occupation</p>
          <p className={`text-xl font-bold tabular-nums ${gaugeColor}`}>
            {formatPct(kpis.tauxOccupation)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Dispo sur 12 sem</p>
          <p className="text-xl font-bold tabular-nums">
            {formatDispo(kpis.totalDispoSur12Sem)}
          </p>
        </div>
        {kpis.semainesEnSurcharge > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Semaines en surcharge</p>
            <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {kpis.semainesEnSurcharge}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ 12
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Disponibilité :</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-700" />
          &gt; 50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-amber-100 border border-amber-200 dark:bg-amber-900/40 dark:border-amber-700" />
          1–50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-red-100 border border-red-200 dark:bg-red-900/40 dark:border-red-700" />
          Saturé / surcharge
        </span>
      </div>

      {/* Planning Grid */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {/* Month header row */}
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th
                  className="sticky left-0 bg-card z-10 px-4 py-1.5 font-medium min-w-[180px]"
                  rowSpan={2}
                >
                  Métier
                </th>
                {monthSpans.map((ms, i) => (
                  <th
                    key={i}
                    colSpan={ms.span}
                    className="px-1 py-1.5 text-center text-xs font-medium capitalize border-l border-border/50"
                  >
                    {ms.label}
                  </th>
                ))}
              </tr>
              {/* Week header row */}
              <tr className="border-b text-muted-foreground">
                {weeks.map((w, i) => {
                  const isMonthStart =
                    i === 0 ||
                    w.monthLabel !== weeks[i - 1].monthLabel;
                  return (
                    <th
                      key={w.key}
                      className={`px-1 py-1.5 text-center text-xs font-normal min-w-[64px] ${isMonthStart ? "border-l border-border/50" : ""}`}
                    >
                      {w.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Summary row (global) */}
              <tr className="border-b bg-muted/40 font-medium">
                <td className="sticky left-0 bg-muted/40 z-10 px-4 py-2.5">
                  <div className="font-semibold">TOTAL</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {kpis.totalPersonnes} pers. · {kpis.capaciteHebdo}j/sem
                  </div>
                </td>
                {weeks.map((w, i) => {
                  const cell = summaryRow.weeks[w.key];
                  const dispo = cell?.dispo ?? summaryRow.capaciteHebdo;
                  const isMonthStart =
                    i === 0 || w.monthLabel !== weeks[i - 1].monthLabel;

                  return (
                    <td
                      key={w.key}
                      className={`px-1 py-1.5 text-center ${isMonthStart ? "border-l border-border/50" : ""}`}
                    >
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${dispoColorSummary(dispo, summaryRow.capaciteHebdo)}`}
                      >
                        {formatDispo(dispo)}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Per-métier rows */}
              {metierRows.map((row) => (
                <MetierRowComp key={row.metierId} row={row} weeks={weeks} />
              ))}
              {metierRows.length === 0 && (
                <tr>
                  <td
                    colSpan={weeks.length + 1}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Aucune donnée. Assignez des métiers aux utilisateurs et
                    ajoutez des allocations aux projets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Métier Row ───────────────────────────────────────────

function MetierRowComp({
  row,
  weeks,
}: {
  row: MetierRow;
  weeks: WeekCol[];
}) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
        <td className="sticky left-0 bg-card z-10 px-4 py-2.5">
          <div className="font-medium">{row.metierNom}</div>
          <div className="text-xs text-muted-foreground">
            {row.nbPersonnes} pers. · {row.capaciteHebdo}j/sem
          </div>
        </td>
        {weeks.map((w, i) => {
          const cell = row.weeks[w.key];
          const dispo = cell?.dispo ?? row.capaciteHebdo;
          const hasProjects = cell?.projects && cell.projects.length > 0;
          const isExpanded = expandedWeek === w.key;
          const isMonthStart =
            i === 0 || w.monthLabel !== weeks[i - 1].monthLabel;

          return (
            <td
              key={w.key}
              className={`px-1 py-1.5 text-center ${isMonthStart ? "border-l border-border/50" : ""}`}
            >
              <button
                onClick={() =>
                  hasProjects
                    ? setExpandedWeek(isExpanded ? null : w.key)
                    : undefined
                }
                className={`
                  inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums transition-colors
                  ${dispoColor(dispo, row.capaciteHebdo)}
                  ${hasProjects ? "cursor-pointer hover:opacity-80" : "cursor-default"}
                  ${!hasProjects && dispo === row.capaciteHebdo ? "text-muted-foreground/50" : ""}
                `}
              >
                {!hasProjects && dispo === row.capaciteHebdo
                  ? `${row.capaciteHebdo}j`
                  : formatDispo(dispo)}
                {hasProjects &&
                  (isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  ))}
              </button>
            </td>
          );
        })}
      </tr>

      {/* Expanded detail row */}
      {expandedWeek && (
        <tr className="border-b bg-muted/20">
          <td className="sticky left-0 bg-muted/20 z-10 px-4 py-1" />
          {weeks.map((w, i) => {
            const isMonthStart =
              i === 0 || w.monthLabel !== weeks[i - 1].monthLabel;

            if (w.key !== expandedWeek) {
              return (
                <td
                  key={w.key}
                  className={`px-1 py-1 ${isMonthStart ? "border-l border-border/50" : ""}`}
                />
              );
            }
            const cell = row.weeks[w.key];
            if (!cell || cell.projects.length === 0) {
              return (
                <td
                  key={w.key}
                  className={`px-1 py-1 ${isMonthStart ? "border-l border-border/50" : ""}`}
                />
              );
            }
            return (
              <td
                key={w.key}
                className={`px-1 py-1 ${isMonthStart ? "border-l border-border/50" : ""}`}
              >
                <div className="space-y-0.5 text-xs min-w-[120px]">
                  {cell.projects.map((p) => (
                    <div
                      key={p.projectId}
                      className="flex items-center justify-between gap-1 rounded px-1.5 py-0.5 bg-card"
                    >
                      <span className="truncate text-muted-foreground">
                        {p.projectTitre}
                      </span>
                      <span className="font-medium tabular-nums shrink-0">
                        {formatDispo(p.jours)}
                      </span>
                    </div>
                  ))}
                </div>
              </td>
            );
          })}
        </tr>
      )}
    </>
  );
}
