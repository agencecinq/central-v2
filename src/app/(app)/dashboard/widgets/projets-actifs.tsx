"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { WidgetWrapper } from "./widget-wrapper";
import type { ActiveProject } from "../lib/dashboard-queries";

interface Props {
  data: { count: number; items: ActiveProject[] };
}

export function ProjetsActifsWidget({ data }: Props) {
  return (
    <WidgetWrapper title="Projets actifs" icon={FolderKanban} count={data.count}>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun projet actif.</p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projets/${p.id}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.titre}</p>
                  {p.clientName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {p.clientName}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.budgetPct > 90
                            ? "bg-destructive"
                            : p.budgetPct > 70
                              ? "bg-amber-500"
                              : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(100, p.budgetPct)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {p.budgetPct}%
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetWrapper>
  );
}
