"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { CheckCircle2, ChevronDown, Circle, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteTask, deleteTransaction, toggleTaskDone, createPhase, updatePhase, deletePhase } from "./actions";
import { DeleteDialog } from "./delete-dialog";
import { GanttChart } from "./gantt-chart";
import { TaskDialog } from "./task-dialog";
import { TransactionDialog } from "./transaction-dialog";

interface Task {
  id: number;
  titre: string;
  description: string | null;
  statutKanban: string;
  categorie: string | null;
  priorityLevel: number;
  estimationHeures: number | null;
  dateEcheance: string | null;
  dateDebut: string | null;
  allocationId: number | null;
  assignee: string | null;
  userId: number | null;
  isOutOfScope: boolean;
}

interface Transaction {
  id: number;
  label: string;
  categorie: string | null;
  montant: number;
  type: string;
  statut: string | null;
  montantPaye: number;
  dateTransaction: string;
}

interface TimeEntryItem {
  id: number;
  semaine: string;
  duree: number;
  unite: string;
  categorie: string;
  description: string | null;
  userName: string;
  userTjm: number | null;
  taskTitre: string | null;
}

interface UserOption {
  id: number;
  name: string;
}

interface PhaseItem {
  id: number;
  metierId: number;
  metierNom: string;
  joursPrevus: number;
  dateDebut: string | null;
  dateFin: string | null;
  userId: number | null;
  userName: string | null;
}

interface UserMetierOption {
  userId: number;
  metierId: number;
  userName: string;
}

interface MetierOption {
  id: number;
  nom: string;
}

const kanbanLabels: Record<string, string> = {
  todo: "À faire",
  done: "Terminé",
};

const transactionStatutLabels: Record<string, string> = {
  a_payer: "À payer",
  paye_partiel: "Partiel",
  "soldé": "Soldé",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function PriorityDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i <= level ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function computeEntryCost(te: TimeEntryItem): number {
  if (!te.userTjm) return 0;
  return te.unite === "jours" ? te.duree * te.userTjm : (te.duree / 8) * te.userTjm;
}

function toHours(te: TimeEntryItem): number {
  return te.unite === "jours" ? te.duree * 8 : te.duree;
}

function formatWeek(semaine: string): string {
  // "2026-W11" → "S11 2026"
  const match = semaine.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return semaine;
  return `S${match[2]} ${match[1]}`;
}

// Rail v2 tab trigger — uses Radix Tabs.Trigger via shadcn TabsTrigger but with overridden styles
function RailTabTrigger({ value, label, count }: { value: string; label: string; count?: string }) {
  return (
    <TabsTrigger
      value={value}
      className="
        relative h-auto rounded-none border-0 bg-transparent
        px-3 py-2 text-[12.5px] font-medium tracking-normal
        text-[var(--rail-muted)]
        data-[state=active]:bg-transparent
        data-[state=active]:text-[var(--rail-ink)]
        data-[state=active]:shadow-none
        data-[state=active]:border-b-2 data-[state=active]:border-[var(--b-accent)]
        -mb-px
      "
      style={{ borderBottom: "2px solid transparent" }}
    >
      {label}
      {count !== undefined && (
        <span
          className="ml-1.5 text-[10.5px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--rail-muted)" }}
        >
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}

export function ProjectTabs({
  projectId,
  tasks,
  transactions,
  timeEntries,
  users,
  phases,
  metiers,
  userMetiers,
}: {
  projectId: number;
  tasks: Task[];
  transactions: Transaction[];
  timeEntries: TimeEntryItem[];
  users: UserOption[];
  phases: PhaseItem[];
  metiers: MetierOption[];
  userMetiers: UserMetierOption[];
}) {
  const depenses = transactions.filter((t) => t.type === "depense");
  const revenus = transactions.filter((t) => t.type === "revenu");

  const totalDepenses = depenses.reduce((sum, t) => sum + t.montant, 0);
  const totalRevenus = revenus.reduce((sum, t) => sum + t.montant, 0);

  // Task filter: show done or not
  const [showDone, setShowDone] = useState(false);
  const filteredTasks = showDone ? tasks : tasks.filter((t) => t.statutKanban !== "done");
  const doneCount = tasks.filter((t) => t.statutKanban === "done").length;
  const todoCount = tasks.length - doneCount;

  // Expanded task descriptions
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  function toggleTaskExpand(taskId: number) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Transaction dialog state
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "task" | "transaction";
    id: number;
    label: string;
  } | null>(null);

  function openCreateTask() {
    setEditingTask(null);
    setTaskDialogOpen(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setTaskDialogOpen(true);
  }

  function openCreateTx() {
    setEditingTx(null);
    setTxDialogOpen(true);
  }

  function openEditTx(tx: Transaction) {
    setEditingTx(tx);
    setTxDialogOpen(true);
  }

  function openDelete(type: "task" | "transaction", id: number, label: string) {
    setDeleteTarget({ type, id, label });
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "task") {
      await deleteTask(deleteTarget.id, projectId);
    } else {
      await deleteTransaction(deleteTarget.id, projectId);
    }
  }

  return (
    <>
      <Tabs defaultValue="tasks">
        <TabsList
          className="bg-transparent border-0 rounded-none p-0 h-auto gap-0"
          style={{ borderBottom: "1px solid var(--rail-hair)" }}
        >
          <RailTabTrigger value="tasks" label="Tâches" count={`${todoCount}${doneCount > 0 ? ` / ${tasks.length}` : ""}`} />
          <RailTabTrigger value="transactions" label="Dépenses" count={String(transactions.length)} />
          <RailTabTrigger value="temps" label="Temps passé" count={String(timeEntries.length)} />
          <RailTabTrigger value="planning" label="Planning" count={String(phases.length)} />
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDone((v) => !v)}
              className="text-muted-foreground"
            >
              {showDone ? (
                <EyeOff className="mr-1.5 h-4 w-4" />
              ) : (
                <Eye className="mr-1.5 h-4 w-4" />
              )}
              {showDone ? "Masquer terminées" : `Afficher terminées (${doneCount})`}
            </Button>
            <button
              onClick={openCreateTask}
              className="inline-flex items-center gap-1.5 text-white rounded-md text-[12.5px] font-medium"
              style={{
                padding: "7px 12px",
                background: "var(--b-accent)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une tâche
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              {tasks.length === 0
                ? "Aucune tâche pour ce projet."
                : "Toutes les tâches sont terminées 🎉"}
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Tâche</TableHead>
                    <TableHead>Assigné</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead className="text-right">Estimation</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((t) => {
                    const isDone = t.statutKanban === "done";
                    const hasDescription = !!t.description && t.description !== "<p></p>" && t.description.replace(/<[^>]*>/g, "").trim().length > 0;
                    const isExpanded = expandedTasks.has(t.id);
                    return (
                      <>
                        <TableRow
                          key={t.id}
                          className={isDone ? "opacity-60" : undefined}
                        >
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => toggleTaskDone(t.id, projectId)}
                              className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent transition-colors"
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {hasDescription && (
                                <button
                                  type="button"
                                  onClick={() => toggleTaskExpand(t.id)}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-accent transition-colors"
                                >
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>
                              )}
                              <span
                                className={`font-medium ${isDone ? "line-through" : ""}`}
                              >
                                {t.titre}
                              </span>
                              {t.isOutOfScope && (
                                <Badge variant="outline" className="text-xs">
                                  Hors scope
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.assignee ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.categorie ?? "—"}
                          </TableCell>
                          <TableCell>
                            <PriorityDots level={t.priorityLevel} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {t.estimationHeures ? `${t.estimationHeures}h` : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(t.dateEcheance)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditTask(t)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openDelete("task", t.id, t.titre)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        {hasDescription && isExpanded && (
                          <TableRow key={`${t.id}-desc`} className={isDone ? "opacity-60" : undefined}>
                            <TableCell />
                            <TableCell colSpan={7} className="pt-0 pb-3">
                              <div
                                className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-muted-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
                                dangerouslySetInnerHTML={{ __html: t.description! }}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="rounded-lg border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Total revenus</p>
                <p className="text-lg font-semibold text-green-600 tabular-nums">
                  +{formatCurrency(totalRevenus)}
                </p>
              </div>
              <div className="rounded-lg border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Total dépenses</p>
                <p className="text-lg font-semibold text-destructive tabular-nums">
                  -{formatCurrency(totalDepenses)}
                </p>
              </div>
            </div>
            <button
              onClick={openCreateTx}
              className="inline-flex items-center gap-1.5 text-white rounded-md text-[12.5px] font-medium"
              style={{
                padding: "7px 12px",
                background: "var(--b-accent)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une transaction
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              Aucune transaction pour ce projet.
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.label}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.categorie ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.type === "revenu" ? "default" : "secondary"}
                        >
                          {tx.type === "revenu" ? "Revenu" : "Dépense"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.statut
                          ? transactionStatutLabels[tx.statut] ?? tx.statut
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          tx.type === "revenu"
                            ? "text-green-600"
                            : "text-destructive"
                        }`}
                      >
                        {tx.type === "revenu" ? "+" : "-"}
                        {formatCurrency(tx.montant)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(tx.dateTransaction)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditTx(tx)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDelete("transaction", tx.id, tx.label)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="temps" className="mt-4 space-y-4">
          <TimePasseTab timeEntries={timeEntries} />
        </TabsContent>

        <TabsContent value="planning" className="mt-4 space-y-4">
          <PlanningTab projectId={projectId} tasks={tasks} users={users} phases={phases} metiers={metiers} userMetiers={userMetiers} />
        </TabsContent>
      </Tabs>

      <TaskDialog
        projectId={projectId}
        task={editingTask}
        users={users}
        phases={phases.map((p) => ({ id: p.id, metierNom: p.metierNom }))}
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
      />

      <TransactionDialog
        projectId={projectId}
        transaction={editingTx}
        open={txDialogOpen}
        onOpenChange={setTxDialogOpen}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={
          deleteTarget?.type === "task"
            ? "Supprimer la tâche"
            : "Supprimer la transaction"
        }
        description={`Êtes-vous sûr de vouloir supprimer « ${deleteTarget?.label ?? ""} » ? Cette action est irréversible.`}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ─── Planning tab ────────────────────────────────────────

function PlanningTab({
  projectId,
  tasks,
  users,
  phases,
  metiers,
  userMetiers,
}: {
  projectId: number;
  tasks: Task[];
  users: UserOption[];
  phases: PhaseItem[];
  metiers: MetierOption[];
  userMetiers: UserMetierOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [addMetierId, setAddMetierId] = useState<string>("");
  const [showPhaseTable, setShowPhaseTable] = useState(false);

  // Task dialog state for Gantt clicks
  const [ganttTaskDialogOpen, setGanttTaskDialogOpen] = useState(false);
  const [ganttEditingTask, setGanttEditingTask] = useState<Task | null>(null);

  function handleTaskClick(task: Task) {
    setGanttEditingTask(task);
    setGanttTaskDialogOpen(true);
  }

  function handleAdd() {
    const metierId = parseInt(addMetierId);
    if (isNaN(metierId)) return;
    startTransition(async () => {
      await createPhase(projectId, metierId, 0, null, null);
      setAddMetierId("");
    });
  }

  function handleFieldBlur(
    phaseId: number,
    field: "joursPrevus" | "dateDebut" | "dateFin",
    value: string,
    currentPhase: PhaseItem,
  ) {
    if (field === "joursPrevus") {
      const jours = value.trim() === "" ? 0 : parseFloat(value);
      if (jours === currentPhase.joursPrevus) return;
      startTransition(async () => {
        await updatePhase(phaseId, projectId, { joursPrevus: jours });
      });
    } else if (field === "dateDebut") {
      const newVal = value || null;
      if (newVal === currentPhase.dateDebut) return;
      startTransition(async () => {
        await updatePhase(phaseId, projectId, { dateDebut: newVal });
      });
    } else if (field === "dateFin") {
      const newVal = value || null;
      if (newVal === currentPhase.dateFin) return;
      startTransition(async () => {
        await updatePhase(phaseId, projectId, { dateFin: newVal });
      });
    }
  }

  function handleMetierChange(phaseId: number, value: string | null) {
    if (!value) return;
    const metierId = parseInt(value);
    if (isNaN(metierId)) return;
    startTransition(async () => {
      await updatePhase(phaseId, projectId, { metierId, userId: null });
    });
  }

  function handleUserChange(phaseId: number, value: string | null) {
    const userId = value && value !== "none" ? parseInt(value) : null;
    startTransition(async () => {
      await updatePhase(phaseId, projectId, { userId });
    });
  }

  function handleDeletePhase(phaseId: number) {
    startTransition(async () => {
      await deletePhase(phaseId, projectId);
    });
  }

  const totalJours = phases.reduce((sum, p) => sum + p.joursPrevus, 0);

  return (
    <>
      {/* Gantt Chart */}
      <GanttChart
        phases={phases}
        tasks={tasks}
        onTaskClick={handleTaskClick}
      />

      {/* Collapsible phase management */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowPhaseTable((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showPhaseTable ? "rotate-180" : ""}`}
          />
          Gérer les phases ({phases.length})
          {totalJours > 0 && (
            <span className="font-normal">
              · {totalJours % 1 === 0 ? totalJours : totalJours.toFixed(1)}j prévus
            </span>
          )}
        </button>

        {showPhaseTable && (
          <>
            {phases.length > 0 && (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Métier</TableHead>
                      <TableHead>Personne</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead className="text-right">Jours</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phases.map((p) => (
                      <TableRow key={p.id} className={isPending ? "opacity-50" : ""}>
                        <TableCell>
                          <Select
                            value={String(p.metierId)}
                            onValueChange={(v) => handleMetierChange(p.id, v)}
                          >
                            <SelectTrigger className="h-7 w-40">
                              {p.metierNom}
                            </SelectTrigger>
                            <SelectContent>
                              {metiers.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                  {m.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={p.userId ? String(p.userId) : "none"}
                            onValueChange={(v) => handleUserChange(p.id, v)}
                          >
                            <SelectTrigger className="h-7 w-36">
                              {p.userName ?? "Non assigné"}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Non assigné</SelectItem>
                              {userMetiers
                                .filter((um) => um.metierId === p.metierId)
                                .map((um) => (
                                  <SelectItem key={um.userId} value={String(um.userId)}>
                                    {um.userName}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            defaultValue={p.dateDebut ?? ""}
                            onBlur={(e) => handleFieldBlur(p.id, "dateDebut", e.target.value, p)}
                            className="h-7 w-36"
                            disabled={isPending}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            defaultValue={p.dateFin ?? ""}
                            onBlur={(e) => handleFieldBlur(p.id, "dateFin", e.target.value, p)}
                            className="h-7 w-36"
                            disabled={isPending}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            defaultValue={p.joursPrevus || ""}
                            onBlur={(e) => handleFieldBlur(p.id, "joursPrevus", e.target.value, p)}
                            className="h-7 w-20 ml-auto text-right"
                            placeholder="0"
                            disabled={isPending}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleDeletePhase(p.id)}
                            disabled={isPending}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Select value={addMetierId} onValueChange={(v) => setAddMetierId(v ?? "")}>
                <SelectTrigger className="w-48">
                  {addMetierId
                    ? metiers.find((m) => m.id === parseInt(addMetierId))?.nom ?? "Métier"
                    : "Choisir un métier"}
                </SelectTrigger>
                <SelectContent>
                  {metiers.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdd}
                disabled={isPending || !addMetierId}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Ajouter une phase
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Task dialog for Gantt clicks */}
      <TaskDialog
        projectId={projectId}
        task={ganttEditingTask}
        users={users}
        phases={phases.map((p) => ({ id: p.id, metierNom: p.metierNom }))}
        open={ganttTaskDialogOpen}
        onOpenChange={setGanttTaskDialogOpen}
      />
    </>
  );
}

function TimePasseTab({ timeEntries }: { timeEntries: TimeEntryItem[] }) {
  // Résumé par personne
  const perUser = new Map<string, { heures: number; cout: number }>();
  for (const te of timeEntries) {
    const existing = perUser.get(te.userName) ?? { heures: 0, cout: 0 };
    existing.heures += toHours(te);
    existing.cout += computeEntryCost(te);
    perUser.set(te.userName, existing);
  }

  const userSummaries = [...perUser.entries()]
    .sort((a, b) => b[1].heures - a[1].heures)
    .map(([name, data]) => ({ name, ...data }));

  const totalHeures = userSummaries.reduce((sum, u) => sum + u.heures, 0);
  const totalCout = userSummaries.reduce((sum, u) => sum + u.cout, 0);

  return (
    <>
      {/* Résumé par personne */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold tabular-nums">
            {totalHeures % 1 === 0 ? totalHeures : totalHeures.toFixed(1)}h
            {totalCout > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({formatCurrency(totalCout)})
              </span>
            )}
          </p>
        </div>
        {userSummaries.map((u) => (
          <div key={u.name} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{u.name}</p>
            <p className="text-lg font-semibold tabular-nums">
              {u.heures % 1 === 0 ? u.heures : u.heures.toFixed(1)}h
              {u.cout > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({formatCurrency(u.cout)})
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Tableau détaillé */}
      {timeEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          Aucun temps enregistré sur ce projet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semaine</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Tâche</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Durée</TableHead>
                <TableHead className="text-right">Coût</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeEntries.map((te) => {
                const cost = computeEntryCost(te);
                return (
                  <TableRow key={te.id}>
                    <TableCell className="text-muted-foreground">
                      {formatWeek(te.semaine)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {te.userName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {te.taskTitre ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {te.categorie}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {te.duree}{te.unite === "jours" ? "j" : "h"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {cost > 0 ? formatCurrency(cost) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
