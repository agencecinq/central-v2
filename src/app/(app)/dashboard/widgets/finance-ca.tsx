"use client";

import Link from "next/link";
import { Landmark, FileWarning, FileText, AlertCircle } from "lucide-react";
import { WidgetWrapper } from "./widget-wrapper";
import { formatEuro } from "@/lib/budget-calc";
import type { FinanceSummary } from "../lib/dashboard-queries";

interface Props {
  data: FinanceSummary | null;
}

export function FinanceCaWidget({ data }: Props) {
  if (!data) return null;

  return (
    <WidgetWrapper title="Finance / CA" icon={Landmark}>
      <div className="space-y-4">
        {data.qontoError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Qonto indisponible</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {/* Solde */}
          <Link
            href="/finance"
            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Solde du compte</p>
              <p className="text-lg font-bold tabular-nums">
                {data.balance !== null ? formatEuro(data.balance) : "—"}
              </p>
            </div>
          </Link>

          {/* Reste à facturer */}
          <Link
            href="/finance"
            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                Signé non facturé
              </p>
              <p className="text-lg font-bold tabular-nums">
                {formatEuro(data.resteAFacturer)}
              </p>
              {data.dealsCount > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {data.dealsCount} deal{data.dealsCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </Link>

          {/* Factures en attente */}
          <Link
            href="/finance"
            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <FileWarning className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                Factures en attente
              </p>
              <p className="text-lg font-bold tabular-nums">
                {data.qontoError ? "—" : formatEuro(data.pendingTotal)}
              </p>
              {!data.qontoError && data.pendingCount > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {data.pendingCount} facture
                  {data.pendingCount > 1 ? "s" : ""} impayée
                  {data.pendingCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </Link>
        </div>
      </div>
    </WidgetWrapper>
  );
}
