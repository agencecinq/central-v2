"use client";

import { useTransition, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MiniEditor } from "@/components/mini-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createTask, updateTask } from "./actions";

interface TaskData {
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

interface UserOption {
  id: number;
  name: string;
}

interface PhaseOption {
  id: number;
  metierNom: string;
}

export function TaskDialog({
  projectId,
  task,
  users,
  phases = [],
  open,
  onOpenChange,
}: {
  projectId: number;
  task?: TaskData | null;
  users: UserOption[];
  phases?: PhaseOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [statutKanban, setStatutKanban] = useState("todo");
  const [priorityLevel, setPriorityLevel] = useState("1");
  const [userId, setUserId] = useState<string>("none");
  const [allocationId, setAllocationId] = useState<string>("none");
  const [isOutOfScope, setIsOutOfScope] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setStatutKanban(task?.statutKanban ?? "todo");
      setPriorityLevel(String(task?.priorityLevel ?? 1));
      setUserId(task?.userId ? String(task.userId) : "none");
      setAllocationId(task?.allocationId ? String(task.allocationId) : "none");
      setIsOutOfScope(task?.isOutOfScope ?? false);
      setDescription(task?.description ?? "");
    }
  }, [open, task]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("description", description);
    formData.set("statutKanban", statutKanban);
    formData.set("priorityLevel", priorityLevel);
    formData.set("userId", userId === "none" ? "" : userId);
    formData.set("allocationId", allocationId === "none" ? "" : allocationId);
    formData.set("isOutOfScope", String(isOutOfScope));

    startTransition(async () => {
      if (task) {
        await updateTask(task.id, projectId, formData);
      } else {
        await createTask(projectId, formData);
      }
      onOpenChange(false);
    });
  }

  const isEditing = !!task;

  const statutLabels: Record<string, string> = { todo: "À faire", done: "Terminé" };
  const priorityLabels: Record<string, string> = { "1": "1 — Basse", "2": "2", "3": "3 — Moyenne", "4": "4", "5": "5 — Haute" };
  const userLabel = userId === "none" ? "Non assigné" : users.find((u) => String(u.id) === userId)?.name ?? "Non assigné";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier la tâche" : "Nouvelle tâche"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              name="titre"
              required
              defaultValue={task?.titre ?? ""}
              placeholder="Titre de la tâche"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <MiniEditor
              content={description}
              onChange={setDescription}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={statutKanban} onValueChange={(v) => setStatutKanban(v ?? "todo")}>
                <SelectTrigger className="w-full">
                  {statutLabels[statutKanban] ?? statutKanban}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priorityLevel} onValueChange={(v) => setPriorityLevel(v ?? "1")}>
                <SelectTrigger className="w-full">
                  {priorityLabels[priorityLevel] ?? priorityLevel}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Basse</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3 — Moyenne</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5 — Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categorie">Catégorie</Label>
              <Input
                id="categorie"
                name="categorie"
                defaultValue={task?.categorie ?? ""}
                placeholder="Ex: Design, Dev..."
              />
            </div>

            <div className="space-y-2">
              <Label>Assigné</Label>
              <Select value={userId} onValueChange={(v) => setUserId(v ?? "none")}>
                <SelectTrigger className="w-full">
                  {userLabel}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date de début</Label>
              <Input
                id="dateDebut"
                name="dateDebut"
                type="date"
                defaultValue={
                  task?.dateDebut
                    ? task.dateDebut.substring(0, 10)
                    : ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateEcheance">Échéance</Label>
              <Input
                id="dateEcheance"
                name="dateEcheance"
                type="date"
                defaultValue={
                  task?.dateEcheance
                    ? task.dateEcheance.substring(0, 10)
                    : ""
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimationHeures">Estimation (h)</Label>
              <Input
                id="estimationHeures"
                name="estimationHeures"
                type="number"
                step="0.5"
                min="0"
                defaultValue={task?.estimationHeures ?? ""}
                placeholder="0"
              />
            </div>

            {phases.length > 0 && (
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={allocationId} onValueChange={(v) => setAllocationId(v ?? "none")}>
                  <SelectTrigger className="w-full">
                    {allocationId === "none"
                      ? "Aucune phase"
                      : phases.find((p) => String(p.id) === allocationId)?.metierNom ?? "Phase"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune phase</SelectItem>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.metierNom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isOutOfScope"
              checked={isOutOfScope}
              onCheckedChange={(checked) => setIsOutOfScope(!!checked)}
            />
            <Label htmlFor="isOutOfScope" className="font-normal">
              Hors scope
            </Label>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Enregistrement..."
                : isEditing
                  ? "Enregistrer"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
