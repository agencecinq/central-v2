"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface DealData {
  montantFinal: number | null;
  etape: string;
  dateSignature: string | null;
}

interface Props {
  deals: DealData[];
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const QUARTER_LABELS = ["T1", "T2", "T3", "T4"];

export function SignedRevenueTable({ deals }: Props) {
  const year = new Date().getFullYear();

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
    const maxMonth = Math.max(...months, 1);

    return { months, quarters, total, maxMonth };
  }, [deals, year]);

  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base font-semibold flex-1">
          Signé {year}
        </CardTitle>
        <span className="text-lg font-bold tabular-nums">
          {formatEuro(total)}
        </span>
      </CardHeader>
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
                {months.map((v, i) => (
                  <td
                    key={i}
                    className={`px-1 pt-2 pb-0 align-bottom h-16 ${
                      i > 0 && i % 3 === 0 ? "border-l" : ""
                    }`}
                  >
                    <div className="flex justify-center">
                      <div
                        className={`w-5 rounded-t ${
                          v > 0 ? "bg-primary" : "bg-transparent"
                        }`}
                        style={{
                          height: `${Math.max(v > 0 ? 4 : 0, Math.round((v / maxMonth) * 48))}px`,
                        }}
                      />
                    </div>
                  </td>
                ))}
                {quarters.map((v, i) => (
                  <td
                    key={`q-${i}`}
                    className="px-1 pt-2 pb-0 align-bottom h-16 border-l bg-muted/30"
                  >
                    <div className="flex justify-center">
                      <div
                        className={`w-5 rounded-t ${
                          v > 0 ? "bg-primary/60" : "bg-transparent"
                        }`}
                        style={{
                          height: `${Math.max(v > 0 ? 4 : 0, Math.round((v / (maxMonth * 3)) * 48))}px`,
                        }}
                      />
                    </div>
                  </td>
                ))}
              </tr>
              {/* Values */}
              <tr className="border-t">
                {months.map((v, i) => (
                  <td
                    key={i}
                    className={`px-1 py-1.5 text-center tabular-nums text-xs ${
                      i > 0 && i % 3 === 0 ? "border-l" : ""
                    } ${v > 0 ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {v > 0 ? formatEuro(v) : "—"}
                  </td>
                ))}
                {quarters.map((v, i) => (
                  <td
                    key={`q-${i}`}
                    className={`px-1 py-1.5 text-center tabular-nums text-xs border-l bg-muted/30 ${
                      v > 0 ? "font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {v > 0 ? formatEuro(v) : "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
