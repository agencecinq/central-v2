"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderKanban,
  ListTodo,
  Plus,
  Trash2,
} from "lucide-react";
import { createTimeEntry, deleteTimeEntry } from "./actions";

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Développement",
  "Design",
  "Gestion de projet",
  "Réunion",
  "Commercial",
  "Admin",
  "Autre",
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProjectItem {
  id: number;
  titre: string;
  clientName: string;
}

interface TaskItem {
  id: number;
  titre: string;
  projectId: number;
  projectTitre: string;
}

interface EntryItem {
  id: number;
  userId: number;
  projectId: number | null;
  taskId: number | null;
  semaine: string;
  duree: number;
  unite: "heures" | "jours";
  categorie: string;
  description: string | null;
  projectTitre: string | null;
  taskTitre: string | null;
}

interface UserItem {
  id: number;
  name: string;
  tjm: number | null;
}

interface Props {
  currentWeek: string;
  currentUserId: number;
  projects: ProjectItem[];
  tasks: TaskItem[];
  entries: EntryItem[];
  users: UserItem[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** "2026-W11" → { start: Date, end: Date } (Monday → Sunday) */
function weekRange(isoWeek: string): { start: Date; end: Date } {
  const [yearStr, wStr] = isoWeek.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);
  // Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

/** Offset an ISO week string by n weeks */
function offsetWeek(isoWeek: string, n: number): string {
  const { start } = weekRange(isoWeek);
  start.setDate(start.getDate() + n * 7);
  return dateToIsoWeek(start);
}

function dateToIsoWeek(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatWeekLabel(isoWeek: string): string {
  const weekNum = isoWeek.split("-W")[1];
  const { start, end } = weekRange(isoWeek);
  return `Semaine ${parseInt(weekNum, 10)} — ${formatDateShort(start)} au ${formatDateShort(end)}`;
}

function formatDuree(duree: number, unite: "heures" | "jours"): string {
  if (unite === "jours") {
    return `${duree}j`;
  }
  return `${duree}h`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TimeTracker({
  currentWeek,
  currentUserId,
  projects,
  tasks,
  entries,
  users,
}: Props) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Week entries
  const weekEntries = useMemo(
    () => entries.filter((e) => e.semaine === selectedWeek),
    [entries, selectedWeek],
  );

  // Summaries
  const totalHeures = useMemo(() => {
    return weekEntries.reduce((sum, e) => {
      return sum + (e.unite === "jours" ? e.duree * 8 : e.duree);
    }, 0);
  }, [weekEntries]);

  const totalJours = Math.round((totalHeures / 8) * 100) / 100;

  const isCurrentWeek = selectedWeek === currentWeek;

  return (
    <>
      {/* ─── Week navigation ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedWeek(offsetWeek(selectedWeek, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[260px] text-center">
            {formatWeekLabel(selectedWeek)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedWeek(offsetWeek(selectedWeek, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setSelectedWeek(currentWeek)}
            >
              Aujourd&apos;hui
            </Button>
          )}
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Ajouter du temps
        </Button>
      </div>

      {/* ─── Summary cards ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total heures</p>
              <p className="text-xl font-bold">{totalHeures}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Clock className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total jours</p>
              <p className="text-xl font-bold">{totalJours}j</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Entries table ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Temps saisis</CardTitle>
        </CardHeader>
        <CardContent>
          {weekEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun temps saisi cette semaine.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Projet / Tâche</th>
                    <th className="pb-2 pr-4 font-medium">Catégorie</th>
                    <th className="pb-2 pr-4 font-medium text-right">Durée</th>
                    <th className="pb-2 pr-4 font-medium">Description</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {weekEntries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Add dialog ───────────────────────────────────────────── */}
      <AddEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedWeek={selectedWeek}
        projects={projects}
        tasks={tasks}
      />
    </>
  );
}

// ─── Entry Row ──────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: EntryItem }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteTimeEntry(entry.id);
    });
  }

  const label = entry.taskId
    ? `${entry.projectTitre} › ${entry.taskTitre}`
    : entry.projectTitre ?? "—";

  const icon = entry.taskId ? (
    <ListTodo className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  ) : (
    <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  );

  return (
    <tr className="border-b last:border-0">
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2">
          {icon}
          <span className="truncate max-w-[260px]">{label}</span>
        </div>
      </td>
      <td className="py-2.5 pr-4">
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">
          {entry.categorie}
        </span>
      </td>
      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
        {formatDuree(entry.duree, entry.unite)}
      </td>
      <td className="py-2.5 pr-4 text-muted-foreground truncate max-w-[200px]">
        {entry.description || "—"}
      </td>
      <td className="py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ─── Add Entry Dialog ───────────────────────────────────────────────────────

function AddEntryDialog({
  open,
  onOpenChange,
  selectedWeek,
  projects,
  tasks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWeek: string;
  projects: ProjectItem[];
  tasks: TaskItem[];
}) {
  const [isPending, startTransition] = useTransition();

  // Form state
  const [cible, setCible] = useState<"projet" | "tache">("projet");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [categorie, setCategorie] = useState<string>(CATEGORIES[0]);
  const [duree, setDuree] = useState("");
  const [unite, setUnite] = useState<"heures" | "jours">("heures");
  const [description, setDescription] = useState("");

  // Filtered tasks when in "tache" mode
  const filteredTasks = useMemo(() => {
    if (!projectId) return tasks;
    return tasks.filter((t) => t.projectId === Number(projectId));
  }, [tasks, projectId]);

  // Reset form on close
  function resetForm() {
    setCible("projet");
    setProjectId("");
    setTaskId("");
    setCategorie(CATEGORIES[0]);
    setDuree("");
    setUnite("heures");
    setDescription("");
  }

  function handleOpenChange(v: boolean) {
    if (!v) resetForm();
    onOpenChange(v);
  }

  // Derive labels for selects
  const projectLabel = projectId
    ? projects.find((p) => String(p.id) === projectId)?.titre ?? "—"
    : "Choisir un projet";

  const taskLabel = taskId
    ? tasks.find((t) => String(t.id) === taskId)?.titre ?? "—"
    : "Choisir une tâche";

  const cibleLabel = cible === "projet" ? "Projet" : "Tâche";
  const uniteLabel = unite === "heures" ? "Heures" : "Jours";
  const categorieLabel = categorie;

  function handleSubmit() {
    const dureeNum = parseFloat(duree);
    if (!dureeNum || dureeNum <= 0) return;

    startTransition(async () => {
      if (cible === "projet") {
        await createTimeEntry({
          projectId: Number(projectId),
          taskId: null,
          semaine: selectedWeek,
          duree: dureeNum,
          unite,
          categorie,
          description: description || undefined,
        });
      } else {
        const task = tasks.find((t) => String(t.id) === taskId);
        await createTimeEntry({
          projectId: task?.projectId ?? null,
          taskId: Number(taskId),
          semaine: selectedWeek,
          duree: dureeNum,
          unite,
          categorie,
          description: description || undefined,
        });
      }
      resetForm();
      onOpenChange(false);
    });
  }

  const canSubmit =
    !isPending &&
    duree &&
    parseFloat(duree) > 0 &&
    categorie &&
    ((cible === "projet" && projectId) || (cible === "tache" && taskId));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter du temps</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type: Projet ou Tâche */}
          <div className="space-y-2">
            <Label>Saisir sur</Label>
            <Select
              value={cible}
              onValueChange={(v) => {
                const val = (v ?? "projet") as "projet" | "tache";
                setCible(val);
                setProjectId("");
                setTaskId("");
              }}
            >
              <SelectTrigger className="w-full">{cibleLabel}</SelectTrigger>
              <SelectContent>
                <SelectItem value="projet">Projet</SelectItem>
                <SelectItem value="tache">Tâche</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Project select (always shown when cible=projet, optionally for filtering tasks) */}
          {cible === "projet" ? (
            <div className="space-y-2">
              <Label>Projet</Label>
              <Select
                value={projectId}
                onValueChange={(v) => setProjectId(v ?? "")}
              >
                <SelectTrigger className="w-full">{projectLabel}</SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.clientName ? `${p.clientName} — ` : ""}
                      {p.titre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              {/* Optional project filter for tasks */}
              <div className="space-y-2">
                <Label>Filtrer par projet (optionnel)</Label>
                <Select
                  value={projectId}
                  onValueChange={(v) => {
                    setProjectId(v ?? "");
                    setTaskId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    {projectId ? projectLabel : "Tous les projets"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tous les projets</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.clientName ? `${p.clientName} — ` : ""}
                        {p.titre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tâche</Label>
                <Select
                  value={taskId}
                  onValueChange={(v) => setTaskId(v ?? "")}
                >
                  <SelectTrigger className="w-full">{taskLabel}</SelectTrigger>
                  <SelectContent>
                    {filteredTasks.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.projectTitre} › {t.titre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Catégorie */}
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select
              value={categorie}
              onValueChange={(v) => setCategorie(v ?? CATEGORIES[0])}
            >
              <SelectTrigger className="w-full">{categorieLabel}</SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Durée + Unité */}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="te-duree">Durée</Label>
              <Input
                id="te-duree"
                type="number"
                min={0}
                step={0.25}
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                placeholder={unite === "heures" ? "ex: 4" : "ex: 0.5"}
              />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select
                value={unite}
                onValueChange={(v) =>
                  setUnite((v ?? "heures") as "heures" | "jours")
                }
              >
                <SelectTrigger className="w-full">{uniteLabel}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="heures">Heures</SelectItem>
                  <SelectItem value="jours">Jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="te-desc">Description (optionnel)</Label>
            <Input
              id="te-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes sur le travail effectué…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
