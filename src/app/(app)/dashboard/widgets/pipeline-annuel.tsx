"use client";

import Link from "next/link";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { WidgetWrapper } from "./widget-wrapper";
import { formatEuro } from "@/lib/budget-calc";
import type { YearlyPipelineData } from "../lib/dashboard-queries";

interface Props {
  data: YearlyPipelineData | null;
}

function barWidth(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function getAlerts(data: YearlyPipelineData): string[] {
  const { signe, facture, encaisse, depense } = data;
  const alerts: string[] = [];

  if (signe > 10000) {
    const ratioFacture = facture / signe;
    if (ratioFacture < 0.3) {
      alerts.push(
        `Seulement ${Math.round(ratioFacture * 100)}% du signé a été facturé.`,
      );
    }
  }

  if (facture > 10000 && encaisse / facture < 0.5) {
    alerts.push(
      `${Math.round((1 - encaisse / facture) * 100)}% du facturé n'est pas encore encaissé.`,
    );
  }

  if (encaisse > 0 && depense > encaisse * 0.9) {
    alerts.push(
      `Les dépenses (${formatEuro(depense)}) approchent les encaissements.`,
    );
  }

  return alerts;
}

export function PipelineAnnuelWidget({ data }: Props) {
  if (!data) return null;

  const revenueMax = Math.max(data.signe, data.facture, data.encaisse, 1);
  const alerts = getAlerts(data);
  const marge = data.encaisse - data.depense;

  const revenueRows = [
    { label: "Signé", value: data.signe, color: "bg-blue-500" },
    { label: "Facturé", value: data.facture, color: "bg-amber-500" },
    { label: "Encaissé", value: data.encaisse, color: "bg-emerald-500" },
  ];

  return (
    <WidgetWrapper title={`Pipeline ${data.year}`} icon={TrendingUp}>
      <div className="space-y-4">
        {/* Revenue bars */}
        <div className="space-y-3">
          {revenueRows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {row.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatEuro(row.value)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.color} transition-all`}
                  style={{ width: `${barWidth(row.value, revenueMax)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="border-t" />

        {/* Dépensé + Marge */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Dépensé</p>
            <p className="text-sm font-semibold tabular-nums text-red-600">
              {formatEuro(data.depense)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Marge brute</p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                marge >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {marge >= 0 ? "+" : ""}
              {formatEuro(marge)}
            </p>
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-1.5">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">{alert}</p>
              </div>
            ))}
          </div>
        )}

        {data.qontoError && (
          <p className="text-xs text-muted-foreground">
            Qonto indisponible — données bancaires non disponibles.
          </p>
        )}

        <Link
          href="/finance"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          Voir la finance →
        </Link>
      </div>
    </WidgetWrapper>
  );
}
