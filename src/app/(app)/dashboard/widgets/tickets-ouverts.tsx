"use client";

import Link from "next/link";
import { Bug } from "lucide-react";
import { WidgetWrapper } from "./widget-wrapper";
import type { OpenTicket } from "../lib/dashboard-queries";

interface Props {
  data: { count: number; items: OpenTicket[] };
}

const STATUT_STYLES: Record<string, string> = {
  ouvert: "bg-amber-500/10 text-amber-700",
  en_cours: "bg-blue-500/10 text-blue-700",
};

export function TicketsOuvertsWidget({ data }: Props) {
  return (
    <WidgetWrapper title="Tickets ouverts" icon={Bug} count={data.count}>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun ticket ouvert.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tickets?id=${t.id}`}
                className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{t.titre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.projectTitre}
                    {t.assigneName && ` · ${t.assigneName}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUT_STYLES[t.statut] ?? "bg-muted text-muted-foreground"}`}
                >
                  {t.statut === "en_cours" ? "En cours" : "Ouvert"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetWrapper>
  );
}
