"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, AlertTriangle, Calendar } from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface WeekInfo {
  key: string;
  label: string;
  monthLabel: string;
}

interface ProjectCharge {
  projectId: number;
  projectTitre: string;
  jours: number;
}

interface PersonRow {
  userId: number;
  userName: string;
  metiers: string[];
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

interface KPIs {
  totalPersonnes: number;
  capaciteHebdo: number;
  tauxOccupation: number;
  totalDispoSur12Sem: number;
  semainesEnSurcharge: number;
}

interface Props {
  weeks: WeekInfo[];
  personRows: PersonRow[];
  summaryRow: SummaryRow;
  kpis: KPIs;
}

// ─── Helpers ──────────────────────────────────────────────

function getCellColor(dispo: number): string {
  if (dispo > 2.5) return "bg-emerald-100 text-emerald-800";
  if (dispo > 0) return "bg-amber-100 text-amber-800";
  if (dispo === 0) return "bg-red-100 text-red-700";
  return "bg-red-200 text-red-900 font-semibold";
}

function getSummaryColor(dispo: number, capacite: number): string {
  const ratio = capacite > 0 ? dispo / capacite : 1;
  if (ratio > 0.5) return "bg-emerald-50 text-emerald-700";
  if (ratio > 0) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

// ─── Component ────────────────────────────────────────────

export function PersonPlanningView({ weeks, personRows, summaryRow, kpis }: Props) {
  // Group weeks by month for header
  const monthSpans: { label: string; count: number }[] = [];
  for (const w of weeks) {
    const last = monthSpans[monthSpans.length - 1];
    if (last && last.label === w.monthLabel) {
      last.count++;
    } else {
      monthSpans.push({ label: w.monthLabel, count: 1 });
    }
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KPICard icon={Users} label="Équipe" value={`${kpis.totalPersonnes} pers.`} />
        <KPICard icon={Calendar} label="Capacité/sem" value={`${kpis.capaciteHebdo}j`} />
        <KPICard icon={TrendingUp} label="Taux occupation" value={`${kpis.tauxOccupation}%`} accent={kpis.tauxOccupation > 90} />
        <KPICard icon={Calendar} label="Dispo 12 sem" value={`${kpis.totalDispoSur12Sem}j`} />
        <KPICard icon={AlertTriangle} label="Sem. surcharge" value={String(kpis.semainesEnSurcharge)} accent={kpis.semainesEnSurcharge > 0} />
      </div>

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              {/* Month header */}
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-medium text-muted-foreground min-w-[160px]" />
                  {monthSpans.map((ms, i) => (
                    <th
                      key={i}
                      colSpan={ms.count}
                      className="px-1 py-1.5 text-center font-medium text-muted-foreground border-l capitalize"
                    >
                      {ms.label}
                    </th>
                  ))}
                </tr>
                {/* Week header */}
                <tr className="border-b">
                  <th className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-medium text-muted-foreground min-w-[160px]">
                    Personne
                  </th>
                  {weeks.map((w, i) => (
                    <th
                      key={w.key}
                      className={`px-1 py-1.5 text-center font-medium text-muted-foreground min-w-[64px] ${
                        i > 0 && weeks[i - 1].monthLabel !== w.monthLabel ? "border-l" : ""
                      }`}
                    >
                      {w.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Person rows */}
                {personRows.map((person) => (
                  <PersonRowComp
                    key={person.userId}
                    person={person}
                    weeks={weeks}
                  />
                ))}

                {/* Summary */}
                <tr className="border-t-2 bg-muted/30 font-medium">
                  <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2">
                    Total équipe
                  </td>
                  {weeks.map((w, i) => {
                    const wd = summaryRow.weeks[w.key];
                    return (
                      <td
                        key={w.key}
                        className={`px-1 py-2 text-center tabular-nums ${
                          i > 0 && weeks[i - 1].monthLabel !== w.monthLabel ? "border-l" : ""
                        } ${getSummaryColor(wd?.dispo ?? 0, summaryRow.capaciteHebdo)}`}
                      >
                        {wd ? `${wd.charge}j` : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 border border-emerald-200" />
          Disponible (&gt;2.5j)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-amber-100 border border-amber-200" />
          Chargé (0-2.5j dispo)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100 border border-red-200" />
          Saturé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-200 border border-red-300" />
          Surcharge
        </span>
      </div>
    </div>
  );
}

// ─── Person row ───────────────────────────────────────────

function PersonRowComp({
  person,
  weeks,
}: {
  person: PersonRow;
  weeks: WeekInfo[];
}) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  return (
    <>
      <tr className="border-b hover:bg-muted/30 transition-colors">
        <td className="sticky left-0 z-10 bg-card px-3 py-2">
          <p className="font-medium text-sm">{person.userName}</p>
          {person.metiers.length > 0 && (
            <p className="text-muted-foreground text-[10px]">
              {person.metiers.join(", ")}
            </p>
          )}
        </td>
        {weeks.map((w, i) => {
          const wd = person.weeks[w.key];
          if (!wd) return <td key={w.key} className="px-1 py-2 text-center">—</td>;

          const isExpanded = expandedWeek === w.key;

          return (
            <td
              key={w.key}
              className={`px-1 py-2 text-center tabular-nums cursor-pointer transition-colors ${
                i > 0 && weeks[i - 1].monthLabel !== w.monthLabel ? "border-l" : ""
              } ${getCellColor(wd.dispo)}`}
              onClick={() => setExpandedWeek(isExpanded ? null : w.key)}
              title={`Charge: ${wd.charge}j — Dispo: ${wd.dispo}j`}
            >
              {wd.charge > 0 ? `${wd.charge}j` : "—"}
            </td>
          );
        })}
      </tr>
      {/* Expanded detail row */}
      {expandedWeek && person.weeks[expandedWeek]?.projects.length > 0 && (
        <tr className="border-b bg-muted/20">
          <td className="sticky left-0 z-10 bg-muted/20 px-3 py-1.5 text-muted-foreground">
            Détail sem. {weeks.find((w) => w.key === expandedWeek)?.label}
          </td>
          <td colSpan={weeks.length} className="px-3 py-1.5">
            <div className="flex flex-wrap gap-3">
              {person.weeks[expandedWeek].projects.map((p) => (
                <span key={p.projectId} className="inline-flex items-center gap-1 text-xs">
                  <span className="font-medium">{p.projectTitre}</span>
                  <span className="text-muted-foreground">{p.jours}j</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── KPI Card ─────────────────────────────────────────────

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
