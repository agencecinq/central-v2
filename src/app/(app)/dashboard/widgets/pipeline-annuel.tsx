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

function getAlert(data: YearlyPipelineData): string | null {
  const { signe, facture, encaisse } = data;
  if (signe === 0) return null;

  const ratioFacture = signe > 0 ? facture / signe : 0;
  const ratioEncaisse = signe > 0 ? encaisse / signe : 0;

  if (ratioFacture < 0.3 && signe > 10000) {
    return `Seulement ${Math.round(ratioFacture * 100)}% du signé a été facturé — relancez la facturation.`;
  }
  if (ratioEncaisse < 0.3 && facture > 10000) {
    return `Seulement ${Math.round(ratioEncaisse * 100)}% du signé a été encaissé — vérifiez les paiements en attente.`;
  }
  if (facture > 0 && encaisse / facture < 0.5) {
    return `Attention : ${Math.round((1 - encaisse / facture) * 100)}% du facturé n'est pas encore encaissé.`;
  }
  return null;
}

export function PipelineAnnuelWidget({ data }: Props) {
  if (!data) return null;

  const max = Math.max(data.signe, data.facture, data.encaisse, 1);
  const alert = getAlert(data);

  const rows = [
    { label: "Signé", value: data.signe, color: "bg-blue-500" },
    { label: "Facturé", value: data.facture, color: "bg-amber-500" },
    { label: "Encaissé", value: data.encaisse, color: "bg-emerald-500" },
  ];

  return (
    <WidgetWrapper title={`Pipeline ${data.year}`} icon={TrendingUp}>
      <div className="space-y-4">
        <div className="space-y-3">
          {rows.map((row) => (
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
                  style={{ width: `${barWidth(row.value, max)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {alert && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">{alert}</p>
          </div>
        )}

        {data.qontoError && (
          <p className="text-xs text-muted-foreground">
            Qonto indisponible — encaissé non disponible.
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
