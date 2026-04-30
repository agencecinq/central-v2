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

  // KPIs
  const kpiTotal = tickets.length;
  const kpiOuverts = tickets.filter((t) => t.statut === "ouvert").length;
  const kpiEnCours = tickets.filter((t) => t.statut === "en_cours").length;
  const kpiResolu = tickets.filter((t) => t.statut === "resolu").length;
  const kpiMoy = tickets.filter((t) => t.assigneId === currentUserId && t.statut !== "ferme").length;

  const cols = "32px 1.6fr 1fr 110px 130px 120px 110px";

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <section className="grid grid-cols-4 gap-4">
        <RailTicketKpi label="Tickets ouverts" value={kpiOuverts} sub={`${kpiTotal} au total`} tone={kpiOuverts > 5 ? "warn" : "default"} />
        <RailTicketKpi label="En cours" value={kpiEnCours} sub={`${kpiResolu} résolus`} />
        <RailTicketKpi label="Résolus" value={kpiResolu} sub={`${Math.round((kpiResolu / Math.max(1, kpiTotal)) * 100)}% du total`} tone="good" />
        <RailTicketKpi label="Mes tickets actifs" value={kpiMoy} sub="assignés à moi · non fermés" />
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => setShowMine(!showMine)}
          className="text-[12.5px] font-medium rounded-md transition-colors"
          style={{
            padding: "7px 12px",
            background: showMine ? "var(--b-accent)" : "var(--rail-panel)",
            color: showMine ? "#fff" : "var(--rail-ink)",
            border: `1px solid ${showMine ? "var(--b-accent)" : "var(--rail-hair)"}`,
          }}
        >
          {showMine ? "Mes tickets" : "Tous les tickets"}
        </button>

        {/* Statut filter chips */}
        <div
          className="flex items-center gap-px rounded-md p-0.5"
          style={{ background: "var(--rail-hair)", border: "1px solid var(--rail-hair)" }}
        >
          {ALL_STATUTS.map((s) => {
            const active = activeStatuts.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatut(s)}
                className="rounded text-[11.5px] font-medium"
                style={{
                  padding: "5px 10px",
                  background: active ? "var(--rail-panel)" : "transparent",
                  color: active ? "var(--rail-ink)" : "var(--rail-muted)",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                }}
              >
                {statutLabels[s]}
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center gap-px rounded-md p-0.5"
          style={{ background: "var(--rail-hair)", border: "1px solid var(--rail-hair)" }}
        >
          {ALL_PROJECT_STATUTS.map((s) => {
            const active = activeProjectStatuts.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleProjectStatut(s)}
                className="rounded text-[11.5px] font-medium"
                style={{
                  padding: "5px 10px",
                  background: active ? "var(--rail-panel)" : "transparent",
                  color: active ? "var(--rail-ink)" : "var(--rail-muted)",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                }}
              >
                {projectStatutLabels[s]}
              </button>
            );
          })}
        </div>

        {(showMine || !allStatutsActive || !allProjectStatutsActive) && (
          <button
            onClick={() => {
              setShowMine(false);
              setActiveStatuts(new Set(ALL_STATUTS));
              setActiveProjectStatuts(new Set(ALL_PROJECT_STATUTS));
            }}
            className="text-[12px]"
            style={{ color: "var(--rail-muted)" }}
          >
            Réinitialiser
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[12px]" style={{ color: "var(--rail-muted)" }}>
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 text-white rounded-md text-[12.5px] font-medium"
            style={{ padding: "7px 12px", background: "var(--b-accent)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Nouveau ticket
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center text-[13px]"
          style={{
            padding: "60px 20px",
            border: "1px dashed var(--rail-hair)",
            borderRadius: 8,
            background: "var(--rail-panel)",
            color: "var(--rail-muted)",
          }}
        >
          Aucun ticket trouvé.
        </div>
      ) : (
        <div
          className="overflow-hidden"
          style={{
            background: "var(--rail-panel)",
            border: "1px solid var(--rail-hair)",
            borderRadius: 8,
          }}
        >
          {/* Header */}
          <div
            className="grid gap-3 text-[10.5px] uppercase"
            style={{
              gridTemplateColumns: cols,
              padding: "10px 16px",
              letterSpacing: "0.08em",
              color: "var(--rail-muted)",
              background: "var(--rail-hair3)",
              borderBottom: "1px solid var(--rail-hair2)",
            }}
          >
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Sélectionner tout"
            />
            <span>Titre</span>
            <span>Projet</span>
            <span>Statut</span>
            <span>Assigné</span>
            <span>Créé par</span>
            <span>Date</span>
          </div>
          {/* Rows */}
          {filtered.map((t, i) => {
            const isSelected = selected.has(t.id);
            return (
              <div
                key={t.id}
                className="grid gap-3 items-center text-[13px] transition-colors"
                style={{
                  gridTemplateColumns: cols,
                  padding: "10px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                  background: isSelected ? "var(--rail-hair3)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "var(--rail-hair3)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleOne(t.id)}
                  aria-label={`Sélectionner ${t.titre}`}
                />
                <div className="min-w-0">
                  <Link
                    href={`/tickets/${t.id}`}
                    className="font-medium hover:underline whitespace-nowrap overflow-hidden text-ellipsis inline-flex items-center gap-1.5"
                  >
                    {t.titre}
                    {t.attachmentCount > 0 && (
                      <Paperclip className="h-3 w-3" style={{ color: "var(--rail-muted2)" }} />
                    )}
                  </Link>
                </div>
                <span
                  className="whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ color: "var(--rail-ink2)" }}
                >
                  {t.projectTitre}
                </span>
                <InlineStatusSelect ticketId={t.id} statut={t.statut} />
                <InlineAssigneSelect
                  ticketId={t.id}
                  assigneId={t.assigneId}
                  assigneName={t.assigneName}
                  users={users}
                />
                <span style={{ color: "var(--rail-ink2)" }}>{t.createurName}</span>
                <span className="text-[12px]" style={{ color: "var(--rail-muted)" }}>
                  {formatDate(t.createdAt)}
                </span>
              </div>
            );
          })}
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

// ─── Rail v2 Ticket KPI ──────────────────────────────────
function RailTicketKpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "good" | "warn" | "default";
}) {
  const accent =
    tone === "good"
      ? "var(--rail-success)"
      : tone === "warn"
        ? "var(--rail-warn)"
        : "var(--b-accent)";
  return (
    <div
      style={{
        background: "var(--rail-panel)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 8,
        padding: "16px 18px 14px",
      }}
    >
      <div
        className="text-[11px] tracking-[0.06em] uppercase mb-2"
        style={{ color: "var(--rail-muted)" }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div
          className="text-[26px] font-semibold tabular leading-tight"
          style={{
            letterSpacing: "-0.5px",
            color: tone === "warn" ? "var(--rail-warn)" : "var(--rail-ink)",
          }}
        >
          {value}
        </div>
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--rail-muted)" }}>
          {sub}
        </div>
      )}
      <div
        className="mt-2.5 h-0.5 rounded"
        style={{
          background:
            value === 0 ? "var(--rail-hair)" : accent,
          opacity: value === 0 ? 1 : 0.8,
        }}
      />
    </div>
  );
}
