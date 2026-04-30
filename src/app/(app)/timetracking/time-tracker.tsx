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

  // Breakdown by project
  const byProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of weekEntries) {
      const key = e.projectTitre ?? "—";
      const hrs = e.unite === "jours" ? e.duree * 8 : e.duree;
      map.set(key, (map.get(key) ?? 0) + hrs);
    }
    return Array.from(map.entries())
      .map(([titre, heures]) => ({ titre, heures }))
      .sort((a, b) => b.heures - a.heures);
  }, [weekEntries]);

  // History 8 weeks
  const last8Weeks = useMemo(() => {
    const weeks: { semaine: string; total: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const w = offsetWeek(currentWeek, -i);
      const wEntries = entries.filter((e) => e.semaine === w);
      const total = wEntries.reduce(
        (s, e) => s + (e.unite === "jours" ? e.duree * 8 : e.duree),
        0,
      );
      weeks.push({ semaine: w, total });
    }
    return weeks;
  }, [entries, currentWeek]);

  const TARGET_HOURS = 35;
  const tempsPct = Math.min(100, (totalHeures / TARGET_HOURS) * 100);
  const isCurrentWeek = selectedWeek === currentWeek;

  const maxBar = Math.max(...last8Weeks.map((w) => w.total), TARGET_HOURS);

  return (
    <div className="space-y-5">
      {/* ─── Week navigation + add ───────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedWeek(offsetWeek(selectedWeek, -1))}
            className="h-8 w-8 grid place-items-center rounded transition-colors hover:bg-[var(--rail-hair2)]"
            style={{ border: "1px solid var(--rail-hair)" }}
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "var(--rail-muted)" }} />
          </button>
          <span
            className="text-[13px] font-medium min-w-[260px] text-center"
            style={{ color: "var(--rail-ink)" }}
          >
            {formatWeekLabel(selectedWeek)}
          </span>
          <button
            onClick={() => setSelectedWeek(offsetWeek(selectedWeek, 1))}
            className="h-8 w-8 grid place-items-center rounded transition-colors hover:bg-[var(--rail-hair2)]"
            style={{ border: "1px solid var(--rail-hair)" }}
          >
            <ChevronRight className="h-4 w-4" style={{ color: "var(--rail-muted)" }} />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setSelectedWeek(currentWeek)}
              className="text-[12px]"
              style={{
                color: "var(--rail-muted)",
                padding: "5px 10px",
              }}
            >
              Aujourd&apos;hui
            </button>
          )}
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 text-white rounded-md text-[12.5px] font-medium"
          style={{ padding: "7px 12px", background: "var(--b-accent)" }}
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter du temps
        </button>
      </div>

      {/* ─── Hero: total + breakdown by project ────────────────── */}
      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: "1.2fr 1.6fr" }}
      >
        {/* Total + progress */}
        <div
          style={{
            background: "var(--rail-panel)",
            border: "1px solid var(--rail-hair)",
            borderRadius: 8,
            padding: "20px 22px",
          }}
        >
          <div
            className="text-[11.5px] tracking-[0.1em] uppercase mb-2.5"
            style={{ color: "var(--rail-muted)" }}
          >
            Total — {formatWeekLabel(selectedWeek)}
          </div>
          <div className="flex items-baseline gap-2">
            <div
              className="text-[40px] font-semibold tabular leading-none"
              style={{ letterSpacing: "-1px" }}
            >
              {totalHeures}h
            </div>
            <div
              className="text-[14px]"
              style={{
                color: "var(--rail-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              / {TARGET_HOURS}h · {totalJours}j
            </div>
          </div>
          <div
            className="mt-3.5 h-1 rounded overflow-hidden"
            style={{ background: "var(--rail-hair)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${tempsPct}%`,
                background: "var(--b-accent)",
              }}
            />
          </div>
          <div
            className="mt-2 text-[11.5px]"
            style={{ color: "var(--rail-muted)" }}
          >
            {totalHeures < TARGET_HOURS
              ? `${(TARGET_HOURS - totalHeures).toFixed(1)}h à saisir`
              : `+${(totalHeures - TARGET_HOURS).toFixed(1)}h au-dessus de l'objectif`}
          </div>
        </div>

        {/* Breakdown by project */}
        <div
          className="overflow-hidden"
          style={{
            background: "var(--rail-panel)",
            border: "1px solid var(--rail-hair)",
            borderRadius: 8,
          }}
        >
          <header
            className="flex items-center justify-between"
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid var(--rail-hair)",
            }}
          >
            <div>
              <div className="text-[13px] font-semibold">Répartition par projet</div>
              <div
                className="text-[11.5px] mt-0.5"
                style={{ color: "var(--rail-muted)" }}
              >
                {byProject.length} projet{byProject.length > 1 ? "s" : ""}
              </div>
            </div>
          </header>
          <div className="px-[18px] py-2">
            {byProject.length === 0 ? (
              <p
                className="text-[12.5px] py-6 text-center"
                style={{ color: "var(--rail-muted)" }}
              >
                Aucune saisie cette semaine
              </p>
            ) : (
              byProject.slice(0, 5).map((p) => {
                const pct = (p.heures / Math.max(1, totalHeures)) * 100;
                return (
                  <div
                    key={p.titre}
                    className="flex items-center gap-3 py-1.5"
                  >
                    <span
                      className="text-[12.5px] flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ color: "var(--rail-ink2)" }}
                    >
                      {p.titre}
                    </span>
                    <div
                      className="w-32 h-1 rounded overflow-hidden"
                      style={{ background: "var(--rail-hair)" }}
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          background: "var(--b-accent)",
                        }}
                      />
                    </div>
                    <span
                      className="text-[11.5px] w-16 text-right"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--rail-ink2)",
                      }}
                    >
                      {p.heures.toFixed(1)}h
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ─── Entries grid ──────────────────────────────────────── */}
      <section
        className="overflow-hidden"
        style={{
          background: "var(--rail-panel)",
          border: "1px solid var(--rail-hair)",
          borderRadius: 8,
        }}
      >
        <header
          className="flex items-center justify-between"
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--rail-hair)",
          }}
        >
          <div>
            <div className="text-[13px] font-semibold">Saisies de la semaine</div>
            <div
              className="text-[11.5px] mt-0.5"
              style={{ color: "var(--rail-muted)" }}
            >
              {weekEntries.length} ligne{weekEntries.length > 1 ? "s" : ""}
            </div>
          </div>
        </header>
        {weekEntries.length === 0 ? (
          <p
            className="text-[12.5px] text-center"
            style={{ padding: "32px 20px", color: "var(--rail-muted)" }}
          >
            Aucun temps saisi cette semaine.
          </p>
        ) : (
          <div>
            <div
              className="grid gap-3 text-[10.5px] uppercase"
              style={{
                gridTemplateColumns: "1.6fr 130px 90px 1fr 32px",
                padding: "8px 18px",
                letterSpacing: "0.08em",
                color: "var(--rail-muted)",
                background: "var(--rail-hair3)",
                borderBottom: "1px solid var(--rail-hair2)",
              }}
            >
              <span>Projet / Tâche</span>
              <span>Catégorie</span>
              <span className="text-right">Durée</span>
              <span>Description</span>
              <span />
            </div>
            {weekEntries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Week history (8 weeks) ────────────────────────────── */}
      <section
        className="overflow-hidden"
        style={{
          background: "var(--rail-panel)",
          border: "1px solid var(--rail-hair)",
          borderRadius: 8,
        }}
      >
        <header
          className="flex items-center justify-between"
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--rail-hair)",
          }}
        >
          <div>
            <div className="text-[13px] font-semibold">8 dernières semaines</div>
            <div
              className="text-[11.5px] mt-0.5"
              style={{ color: "var(--rail-muted)" }}
            >
              cliquez pour aller à une semaine
            </div>
          </div>
        </header>
        <div className="px-[18px] py-4">
          <div className="flex items-end gap-3 h-32">
            {last8Weeks.map((w) => {
              const pct = (w.total / maxBar) * 100;
              const isSelected = w.semaine === selectedWeek;
              const isCur = w.semaine === currentWeek;
              return (
                <button
                  key={w.semaine}
                  onClick={() => setSelectedWeek(w.semaine)}
                  className="flex-1 flex flex-col items-center gap-1.5 group"
                >
                  <div className="flex-1 w-full flex flex-col justify-end">
                    <div
                      className="rounded-t transition-all"
                      style={{
                        height: `${Math.max(2, pct)}%`,
                        background: isSelected
                          ? "var(--b-accent)"
                          : w.total === 0
                            ? "var(--rail-hair)"
                            : "var(--rail-muted2)",
                        opacity: isSelected ? 1 : 0.85,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: isSelected ? "var(--rail-ink)" : "var(--rail-muted)",
                      fontWeight: isSelected || isCur ? 600 : 400,
                    }}
                  >
                    {w.semaine.replace(/^\d{4}-W/, "S")}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: w.total > 0 ? "var(--rail-ink)" : "var(--rail-muted2)",
                    }}
                  >
                    {w.total > 0 ? `${w.total.toFixed(0)}h` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Add dialog ───────────────────────────────────────────── */}
      <AddEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedWeek={selectedWeek}
        projects={projects}
        tasks={tasks}
      />
    </div>
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
    <div
      className="grid gap-3 items-center text-[13px] group"
      style={{
        gridTemplateColumns: "1.6fr 130px 90px 1fr 32px",
        padding: "10px 18px",
        borderTop: "1px solid var(--rail-hair2)",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
      </div>
      <span
        className="text-[11px] font-medium uppercase inline-block w-fit"
        style={{
          padding: "2px 7px",
          background: "var(--rail-hair2)",
          color: "var(--rail-ink2)",
          borderRadius: 3,
          letterSpacing: "0.02em",
        }}
      >
        {entry.categorie}
      </span>
      <span
        className="text-right font-medium"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {formatDuree(entry.duree, entry.unite)}
      </span>
      <span
        className="whitespace-nowrap overflow-hidden text-ellipsis text-[12px]"
        style={{ color: "var(--rail-muted)" }}
      >
        {entry.description || "—"}
      </span>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="h-7 w-7 grid place-items-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--rail-danger-bg)]"
      >
        <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--rail-muted)" }} />
      </button>
    </div>
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
