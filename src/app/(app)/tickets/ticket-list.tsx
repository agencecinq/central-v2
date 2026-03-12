"use client";

import { useMemo, useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Paperclip, Upload, X, Trash2, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createTicket,
  updateTicketStatus,
  updateTicketAssigne,
  bulkUpdateStatus,
  bulkUpdateAssigne,
  bulkDeleteTickets,
} from "./actions";

// ─── Types ────────────────────────────────────────────────

interface TicketItem {
  id: number;
  titre: string;
  statut: string;
  projectId: number;
  projectTitre: string;
  projectStatut: string;
  projectChefProjetId: number | null;
  createurName: string;
  assigneId: number | null;
  assigneName: string | null;
  attachmentCount: number;
  createdAt: string | null;
}

interface ProjectOption {
  id: number;
  titre: string;
  chefProjetId: number | null;
  clientName: string | null;
}

interface UserOption {
  id: number;
  name: string;
}

// ─── Constants ────────────────────────────────────────────

const statutLabels: Record<string, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
  ferme: "Fermé",
};

const statutVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ouvert: "default",
  en_cours: "secondary",
  resolu: "outline",
  ferme: "outline",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Create Ticket Dialog ─────────────────────────────────

function CreateTicketDialog({
  projects,
  users,
  open,
  onOpenChange,
}: {
  projects: ProjectOption[];
  users: UserOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string>("");
  const [assigneId, setAssigneId] = useState<string>("auto");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quand on change de projet, auto-assigner au chef de projet
  useEffect(() => {
    if (projectId) {
      const project = projects.find((p) => String(p.id) === projectId);
      if (project?.chefProjetId) {
        setAssigneId(String(project.chefProjetId));
      } else {
        setAssigneId("none");
      }
    }
  }, [projectId, projects]);

  useEffect(() => {
    if (open) {
      setProjectId("");
      setAssigneId("auto");
      setDescription("");
      setFiles([]);
    }
  }, [open]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);
    formData.set("description", description);
    formData.set("assigneId", assigneId === "none" || assigneId === "auto" ? "" : assigneId);

    startTransition(async () => {
      const ticketId = await createTicket(formData);

      // Upload des fichiers après création
      if (files.length > 0 && ticketId) {
        for (const file of files) {
          const uploadData = new FormData();
          uploadData.append("file", file);
          await fetch(`/api/tickets/${ticketId}/upload`, {
            method: "POST",
            body: uploadData,
          });
        }
        router.refresh();
      }

      onOpenChange(false);
    });
  }

  const projectLabel = projectId
    ? projects.find((p) => String(p.id) === projectId)?.titre ?? "Sélectionner"
    : "Sélectionner un projet";

  const assigneLabel = assigneId === "none" || assigneId === "auto"
    ? "Auto (chef de projet)"
    : users.find((u) => String(u.id) === assigneId)?.name ?? "Non assigné";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Projet *</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
              <SelectTrigger className="w-full">
                {projectLabel}
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.titre}
                    {p.clientName && (
                      <span className="text-muted-foreground"> — {p.clientName}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              name="titre"
              required
              placeholder="Titre du ticket"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <MiniEditor content="" onChange={setDescription} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="navigateur">Navigateur</Label>
              <Input
                id="navigateur"
                name="navigateur"
                placeholder="Ex: Chrome 120"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tailleEcran">Taille écran</Label>
              <Input
                id="tailleEcran"
                name="tailleEcran"
                placeholder="Ex: 1920x1080"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assigné</Label>
            <Select value={assigneId} onValueChange={(v) => setAssigneId(v ?? "none")}>
              <SelectTrigger className="w-full">
                {assigneLabel}
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

          {/* Pièces jointes */}
          <div className="space-y-2">
            <Label>Pièces jointes</Label>
            <div className="space-y-2">
              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(0)} Ko`
                          : `${(file.size / (1024 * 1024)).toFixed(1)} Mo`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Ajouter un fichier
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !projectId}>
              {isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Action Bar ─────────────────────────────────────

function BulkActionBar({
  selectedIds,
  users,
  onClear,
  onDone,
}: {
  selectedIds: Set<number>;
  users: UserOption[];
  onClear: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const count = selectedIds.size;
  const ids = Array.from(selectedIds);

  function handleStatusChange(statut: string | null) {
    if (!statut) return;
    startTransition(async () => {
      await bulkUpdateStatus(ids, statut);
      onDone();
    });
  }

  function handleAssigneChange(val: string | null) {
    const assigneId = val === "none" || !val ? null : parseInt(val);
    startTransition(async () => {
      await bulkUpdateAssigne(ids, assigneId);
      onDone();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await bulkDeleteTickets(ids);
      setConfirmDelete(false);
      onDone();
    });
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
      <span className="text-sm font-medium whitespace-nowrap">
        <CheckSquare className="mr-1.5 inline h-4 w-4" />
        {count} sélectionné{count > 1 ? "s" : ""}
      </span>

      <div className="h-5 w-px bg-border" />

      {/* Changer statut */}
      <Select onValueChange={handleStatusChange}>
        <SelectTrigger className="h-8 w-36" disabled={isPending}>
          Changer statut
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ouvert">Ouvert</SelectItem>
          <SelectItem value="en_cours">En cours</SelectItem>
          <SelectItem value="resolu">Résolu</SelectItem>
          <SelectItem value="ferme">Fermé</SelectItem>
        </SelectContent>
      </Select>

      {/* Assigner */}
      <Select onValueChange={handleAssigneChange}>
        <SelectTrigger className="h-8 w-36" disabled={isPending}>
          Assigner à
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

      {/* Supprimer */}
      {confirmDelete ? (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? "Suppression..." : "Confirmer"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => setConfirmDelete(false)}
          >
            Annuler
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmDelete(true)}
          disabled={isPending}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Supprimer
        </Button>
      )}

      <div className="h-5 w-px bg-border" />

      <button
        onClick={onClear}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        disabled={isPending}
      >
        Désélectionner
      </button>
    </div>
  );
}

// ─── Inline Row Controls ──────────────────────────────────

function InlineStatusSelect({
  ticketId,
  statut,
}: {
  ticketId: number;
  statut: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(val: string | null) {
    if (!val || val === statut) return;
    startTransition(async () => {
      await updateTicketStatus(ticketId, val);
    });
  }

  return (
    <Select value={statut} onValueChange={handleChange}>
      <SelectTrigger
        className="h-7 w-auto gap-1 border-none bg-transparent px-0 shadow-none hover:bg-accent/50 rounded transition-colors"
        disabled={isPending}
      >
        <Badge variant={statutVariants[statut] ?? "secondary"}>
          {statutLabels[statut] ?? statut}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ouvert">Ouvert</SelectItem>
        <SelectItem value="en_cours">En cours</SelectItem>
        <SelectItem value="resolu">Résolu</SelectItem>
        <SelectItem value="ferme">Fermé</SelectItem>
      </SelectContent>
    </Select>
  );
}

function InlineAssigneSelect({
  ticketId,
  assigneId,
  assigneName,
  users,
}: {
  ticketId: number;
  assigneId: number | null;
  assigneName: string | null;
  users: UserOption[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(val: string | null) {
    const newId = val === "none" || !val ? null : parseInt(val);
    if (newId === assigneId) return;
    startTransition(async () => {
      await updateTicketAssigne(ticketId, newId);
    });
  }

  return (
    <Select
      value={assigneId ? String(assigneId) : "none"}
      onValueChange={handleChange}
    >
      <SelectTrigger
        className="h-7 w-auto gap-1 border-none bg-transparent px-0 shadow-none hover:bg-accent/50 rounded text-muted-foreground transition-colors"
        disabled={isPending}
      >
        {assigneName ?? "—"}
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
  );
}

// ─── Ticket List ──────────────────────────────────────────

export function TicketList({
  tickets,
  projects,
  users,
  currentUserId,
}: {
  tickets: TicketItem[];
  projects: ProjectOption[];
  users: UserOption[];
  currentUserId: number;
}) {
  const ALL_STATUTS = ["ouvert", "en_cours", "resolu", "ferme"] as const;
  const DEFAULT_STATUTS = new Set<string>(["ouvert", "en_cours", "resolu"]);

  const ALL_PROJECT_STATUTS = ["en_attente", "en_cours", "termine"] as const;
  const DEFAULT_PROJECT_STATUTS = new Set<string>(["en_cours"]);

  const projectStatutLabels: Record<string, string> = {
    en_attente: "En attente",
    en_cours: "En cours",
    termine: "Terminé",
  };

  const [showMine, setShowMine] = useState(true);
  const [activeStatuts, setActiveStatuts] = useState<Set<string>>(new Set(DEFAULT_STATUTS));
  const [activeProjectStatuts, setActiveProjectStatuts] = useState<Set<string>>(new Set(DEFAULT_PROJECT_STATUTS));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleStatut = useCallback((statut: string) => {
    setActiveStatuts((prev) => {
      const next = new Set(prev);
      if (next.has(statut)) {
        if (next.size <= 1) return prev;
        next.delete(statut);
      } else {
        next.add(statut);
      }
      return next;
    });
  }, []);

  const toggleProjectStatut = useCallback((statut: string) => {
    setActiveProjectStatuts((prev) => {
      const next = new Set(prev);
      if (next.has(statut)) {
        if (next.size <= 1) return prev;
        next.delete(statut);
      } else {
        next.add(statut);
      }
      return next;
    });
  }, []);

  const allStatutsActive = activeStatuts.size === ALL_STATUTS.length;
  const allProjectStatutsActive = activeProjectStatuts.size === ALL_PROJECT_STATUTS.length;

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (showMine && t.assigneId !== currentUserId) return false;
      if (!activeStatuts.has(t.statut)) return false;
      if (!activeProjectStatuts.has(t.projectStatut)) return false;
      return true;
    });
  }, [tickets, showMine, activeStatuts, activeProjectStatuts, currentUserId]);

  // Clear selection when filters change
  useEffect(() => {
    setSelected(new Set());
  }, [showMine, activeStatuts, activeProjectStatuts]);

  const allFilteredIds = useMemo(() => new Set(filtered.map((t) => t.id)), [filtered]);
  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const someSelected = selected.size > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  }, [allSelected, filtered]);

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Only keep selected IDs that are in the filtered set
  const activeSelection = useMemo(() => {
    const s = new Set<number>();
    for (const id of selected) {
      if (allFilteredIds.has(id)) s.add(id);
    }
    return s;
  }, [selected, allFilteredIds]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={showMine ? "default" : "outline"}
          size="sm"
          onClick={() => setShowMine(!showMine)}
        >
          {showMine ? "Mes tickets" : "Tous les tickets"}
        </Button>

        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {ALL_STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatut(s)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeStatuts.has(s)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {statutLabels[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {ALL_PROJECT_STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => toggleProjectStatut(s)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeProjectStatuts.has(s)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {projectStatutLabels[s]}
            </button>
          ))}
        </div>

        {(showMine || !allStatutsActive || !allProjectStatutsActive) && (
          <button
            onClick={() => {
              setShowMine(false);
              setActiveStatuts(new Set(ALL_STATUTS));
              setActiveProjectStatuts(new Set(ALL_PROJECT_STATUTS));
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Réinitialiser
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
          </span>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nouveau ticket
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          Aucun ticket trouvé.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Sélectionner tout"
                  />
                </TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Projet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Assigné</TableHead>
                <TableHead>Créé par</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={() => toggleOne(t.id)}
                      aria-label={`Sélectionner ${t.titre}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {t.titre}
                    </Link>
                    {t.attachmentCount > 0 && (
                      <Paperclip className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.projectTitre}
                  </TableCell>
                  <TableCell>
                    <InlineStatusSelect ticketId={t.id} statut={t.statut} />
                  </TableCell>
                  <TableCell>
                    <InlineAssigneSelect
                      ticketId={t.id}
                      assigneId={t.assigneId}
                      assigneName={t.assigneName}
                      users={users}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.createurName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activeSelection.size > 0 && (
        <BulkActionBar
          selectedIds={activeSelection}
          users={users}
          onClear={() => setSelected(new Set())}
          onDone={() => setSelected(new Set())}
        />
      )}

      <CreateTicketDialog
        projects={projects}
        users={users}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
