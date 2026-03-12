"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { WidgetWrapper } from "./widget-wrapper";
import type { UserTask } from "../lib/dashboard-queries";

interface Props {
  data: { count: number; items: UserTask[] };
}

const PRIORITE_COLORS: Record<string, string> = {
  haute: "bg-destructive/10 text-destructive",
  moyenne: "bg-amber-500/10 text-amber-700",
  basse: "bg-muted text-muted-foreground",
};

const STATUT_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "En cours",
  review: "Review",
};

export function TachesEnCoursWidget({ data }: Props) {
  return (
    <WidgetWrapper title="Mes tâches" icon={ListChecks} count={data.count}>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune tâche en cours.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/projets/${t.projectId}`}
                className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{t.titre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.projectTitre}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITE_COLORS[t.priorite] ?? PRIORITE_COLORS.moyenne}`}
                  >
                    {t.priorite}
                  </span>
                  {t.dateEcheance && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(t.dateEcheance).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetWrapper>
  );
}
