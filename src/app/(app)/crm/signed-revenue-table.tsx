"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Settings2 } from "lucide-react";

interface DealData {
  montantFinal: number | null;
  etape: string;
  dateSignature: string | null;
}

interface Props {
  deals: DealData[];
  initialObjectif?: number;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

const QUARTER_LABELS = ["T1", "T2", "T3", "T4"];

const OBJECTIF_STORAGE_KEY = "crm-objectif-mensuel";

function getStoredObjectif(): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(OBJECTIF_STORAGE_KEY);
  return stored ? Number(stored) : 0;
}

export function SignedRevenueTable({ deals, initialObjectif }: Props) {
  const year = new Date().getFullYear();
  const [objectif, setObjectif] = useState<number>(() => initialObjectif ?? getStoredObjectif());
  const [showSettings, setShowSettings] = useState(false);

  function handleObjectifChange(value: string) {
    const n = parseFloat(value) || 0;
    setObjectif(n);
    if (typeof window !== "undefined") {
      localStorage.setItem(OBJECTIF_STORAGE_KEY, String(n));
    }
  }

  const objectifTrimestriel = objectif * 3;

  const { months, quarters, total, maxMonth } = useMemo(() => {
    const months = new Array(12).fill(0) as number[];

    const wonDeals = deals.filter(
      (d) =>
        d.etape === "Gagné" &&
        d.montantFinal &&
        d.dateSignature &&
        d.dateSignature.startsWith(String(year)),
    );

    for (const deal of wonDeals) {
      const month = new Date(deal.dateSignature!).getMonth();
      months[month] += deal.montantFinal!;
    }

    const quarters = [0, 1, 2, 3].map((q) =>
      months.slice(q * 3, q * 3 + 3).reduce((s, v) => s + v, 0),
    );

    const total = months.reduce((s, v) => s + v, 0);
    // Max includes objectif for bar scaling
    const maxMonth = Math.max(...months, objectif || 1, 1);

    return { months, quarters, total, maxMonth };
  }, [deals, year, objectif]);

  const objectifAnnuel = objectif * 12;
  const ecartAnnuel = objectifAnnuel > 0 ? total - objectifAnnuel : 0;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base font-semibold flex-1">
          Signé {year}
        </CardTitle>
        <div className="flex items-center gap-3">
          {objectifAnnuel > 0 && (
            <span className={`text-sm tabular-nums font-medium ${ecartAnnuel >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {ecartAnnuel >= 0 ? "+" : ""}{formatEuro(ecartAnnuel)} vs obj.
            </span>
          )}
          <span className="text-lg font-bold tabular-nums">
            {formatEuro(total)}
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Objectif mensuel"
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>

      {/* Objectif settings */}
      {showSettings && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Label htmlFor="objectif-mensuel" className="text-xs whitespace-nowrap">
              Objectif mensuel
            </Label>
            <Input
              id="objectif-mensuel"
              type="number"
              min={0}
              step={1000}
              value={objectif || ""}
              onChange={(e) => handleObjectifChange(e.target.value)}
              placeholder="Ex : 30000"
              className="h-8 w-[160px] text-sm"
            />
            {objectif > 0 && (
              <span className="text-xs text-muted-foreground">
                = {formatEuro(objectifTrimestriel)}/trim. · {formatEuro(objectifAnnuel)}/an
              </span>
            )}
          </div>
        </div>
      )}

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                {MONTH_LABELS.map((label, i) => (
                  <th
                    key={i}
                    className={`px-2 py-2 text-center font-medium text-xs ${
                      i > 0 && i % 3 === 0 ? "border-l" : ""
                    }`}
                  >
                    {label}
                  </th>
                ))}
                {QUARTER_LABELS.map((label, i) => (
                  <th
                    key={`q-${i}`}
                    className="px-2 py-2 text-center font-medium text-xs border-l bg-muted/30"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Bars */}
              <tr>
                {months.map((v, i) => {
                  const barMax = Math.max(maxMonth, 1);
                  const barH = Math.max(v > 0 ? 4 : 0, Math.round((v / barMax) * 48));
                  const objH = objectif > 0 ? Math.round((objectif / barMax) * 48) : 0;
                  const overObj = objectif > 0 && v >= objectif;
                  const underObj = objectif > 0 && v > 0 && v < objectif;

                  return (
                    <td
                      key={i}
                      className={`px-1 pt-2 pb-0 align-bottom h-16 relative ${
                        i > 0 && i % 3 === 0 ? "border-l" : ""
                      }`}
                    >
                      {/* Objectif line */}
                      {objectif > 0 && (
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-amber-400/60"
                          style={{ bottom: `${objH}px` }}
                        />
                      )}
                      <div className="flex justify-center">
                        <div
                          className={`w-5 rounded-t ${
                            v > 0
                              ? overObj
                                ? "bg-emerald-500"
                                : underObj
                                  ? "bg-amber-500"
                                  : "bg-primary"
                              : "bg-transparent"
                          }`}
                          style={{ height: `${barH}px` }}
                        />
                      </div>
                    </td>
                  );
                })}
                {quarters.map((v, i) => {
                  const qMax = Math.max(maxMonth * 3, 1);
                  const barH = Math.max(v > 0 ? 4 : 0, Math.round((v / qMax) * 48));
                  const objH = objectifTrimestriel > 0 ? Math.round((objectifTrimestriel / qMax) * 48) : 0;
                  const overObj = objectifTrimestriel > 0 && v >= objectifTrimestriel;
                  const underObj = objectifTrimestriel > 0 && v > 0 && v < objectifTrimestriel;

                  return (
                    <td
                      key={`q-${i}`}
                      className="px-1 pt-2 pb-0 align-bottom h-16 border-l bg-muted/30 relative"
                    >
                      {objectifTrimestriel > 0 && (
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-amber-400/60"
                          style={{ bottom: `${objH}px` }}
                        />
                      )}
                      <div className="flex justify-center">
                        <div
                          className={`w-5 rounded-t ${
                            v > 0
                              ? overObj
                                ? "bg-emerald-500/70"
                                : underObj
                                  ? "bg-amber-500/70"
                                  : "bg-primary/60"
                              : "bg-transparent"
                          }`}
                          style={{ height: `${barH}px` }}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
              {/* Values */}
              <tr className="border-t">
                {months.map((v, i) => {
                  const overObj = objectif > 0 && v >= objectif;
                  const underObj = objectif > 0 && v > 0 && v < objectif;
                  return (
                    <td
                      key={i}
                      className={`px-1 py-1.5 text-center tabular-nums text-xs ${
                        i > 0 && i % 3 === 0 ? "border-l" : ""
                      } ${
                        v > 0
                          ? overObj
                            ? "font-medium text-emerald-600"
                            : underObj
                              ? "font-medium text-amber-600"
                              : "font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {v > 0 ? formatEuro(v) : "—"}
                    </td>
                  );
                })}
                {quarters.map((v, i) => {
                  const overObj = objectifTrimestriel > 0 && v >= objectifTrimestriel;
                  const underObj = objectifTrimestriel > 0 && v > 0 && v < objectifTrimestriel;
                  return (
                    <td
                      key={`q-${i}`}
                      className={`px-1 py-1.5 text-center tabular-nums text-xs border-l bg-muted/30 ${
                        v > 0
                          ? overObj
                            ? "font-semibold text-emerald-600"
                            : underObj
                              ? "font-semibold text-amber-600"
                              : "font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {v > 0 ? formatEuro(v) : "—"}
                    </td>
                  );
                })}
              </tr>
              {/* Objectif row */}
              {objectif > 0 && (
                <tr className="border-t border-dashed">
                  {months.map((_, i) => (
                    <td
                      key={i}
                      className={`px-1 py-1 text-center tabular-nums text-[10px] text-amber-500/70 ${
                        i > 0 && i % 3 === 0 ? "border-l" : ""
                      }`}
                    >
                      {formatEuro(objectif)}
                    </td>
                  ))}
                  {quarters.map((_, i) => (
                    <td
                      key={`q-${i}`}
                      className="px-1 py-1 text-center tabular-nums text-[10px] text-amber-500/70 border-l bg-muted/30"
                    >
                      {formatEuro(objectifTrimestriel)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
