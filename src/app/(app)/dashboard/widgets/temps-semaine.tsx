"use client";

import { useState, useTransition } from "react";
import { Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { WidgetWrapper } from "./widget-wrapper";
import { createTimeEntry } from "@/app/(app)/timetracking/actions";
import type { WeeklyTimeData } from "../lib/dashboard-queries";

interface Props {
  data: WeeklyTimeData;
}

const CATEGORIES = [
  "Développement",
  "Design",
  "Gestion de projet",
  "Réunion",
  "Commercial",
  "Admin",
  "Autre",
] as const;

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function TempsSemaineWidget({ data }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string>("");
  const [categorie, setCategorie] = useState<string>(CATEGORIES[0]);
  const [duree, setDuree] = useState("");
  const [unite, setUnite] = useState<"heures" | "jours">("heures");

  function resetForm() {
    setProjectId("");
    setCategorie(CATEGORIES[0]);
    setDuree("");
    setUnite("heures");
    setShowForm(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = parseFloat(duree);
    if (!projectId || isNaN(d) || d <= 0) return;

    startTransition(async () => {
      await createTimeEntry({
        projectId: parseInt(projectId),
        semaine: isoWeek(new Date()),
        duree: d,
        unite,
        categorie,
      });
      resetForm();
    });
  }

  return (
    <WidgetWrapper title="Temps cette semaine" icon={Clock}>
      {/* Summary */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-2xl font-bold tabular-nums">
          {data.totalJours}
          <span className="text-sm font-normal text-muted-foreground ml-1">j</span>
        </span>
        <span className="text-sm text-muted-foreground">
          ({data.totalHeures}h)
        </span>
      </div>

      {/* Recent entries */}
      {data.entries.length > 0 && (
        <ul className="space-y-1 mb-3">
          {data.entries.slice(0, 5).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted transition-colors"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium truncate block">
                  {e.projectTitre}
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.categorie}
                </span>
              </div>
              <span className="shrink-0 text-xs tabular-nums font-medium">
                {e.duree}{e.unite === "jours" ? "j" : "h"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Quick add form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-2 border-t pt-3">
          <div>
            <Label htmlFor="wt-project" className="text-xs">Projet</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
              <SelectTrigger id="wt-project" className="h-8 text-xs" />
              <SelectContent>
                {data.projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.titre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="wt-cat" className="text-xs">Catégorie</Label>
            <Select value={categorie} onValueChange={(v) => setCategorie(v ?? CATEGORIES[0])}>
              <SelectTrigger id="wt-cat" className="h-8 text-xs" />
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="wt-duree" className="text-xs">Durée</Label>
              <Input
                id="wt-duree"
                type="number"
                step="0.25"
                min="0"
                className="h-8 text-xs"
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="w-24">
              <Label htmlFor="wt-unite" className="text-xs">Unité</Label>
              <Select value={unite} onValueChange={(v) => setUnite((v ?? "heures") as "heures" | "jours")}>
                <SelectTrigger id="wt-unite" className="h-8 text-xs" />
                <SelectContent>
                  <SelectItem value="heures">Heures</SelectItem>
                  <SelectItem value="jours">Jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="h-7 text-xs flex-1" disabled={isPending}>
              {isPending ? "Ajout..." : "Ajouter"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={resetForm}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs gap-1"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-3 w-3" />
          Ajouter du temps
        </Button>
      )}
    </WidgetWrapper>
  );
}
