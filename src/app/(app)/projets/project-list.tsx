"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createProject } from "./[id]/actions";

interface Project {
  id: number;
  titre: string;
  statut: string;
  budgetTotal: number;
  budgetConsomme: number;
  deadline: string | null;
  dateDebut: string | null;
  clientNom: string | null;
  clientId: number | null;
  chefProjet: string | null;
  resteAFacturer: number | null;
}

interface ClientOption {
  id: number;
  label: string;
}

interface UserOption {
  id: number;
  name: string;
}

// ─── Create Project Dialog ───────────────────────────────

function CreateProjectDialog({
  clients,
  users,
  open,
  onOpenChange,
}: {
  clients: ClientOption[];
  users: UserOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState<string>("none");
  const [chefProjetId, setChefProjetId] = useState<string>("none");
  const [statut, setStatut] = useState<string>("en_attente");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("clientId", clientId === "none" ? "" : clientId);
    formData.set("chefProjetId", chefProjetId === "none" ? "" : chefProjetId);
    formData.set("statut", statut);

    startTransition(async () => {
      const projectId = await createProject(formData);
      onOpenChange(false);
      router.push(`/projets/${projectId}`);
    });
  }

  const clientLabel =
    clientId === "none"
      ? "Aucun"
      : clients.find((c) => String(c.id) === clientId)?.label ?? "Sélectionner";
  const chefLabel =
    chefProjetId === "none"
      ? "Aucun"
      : users.find((u) => String(u.id) === chefProjetId)?.name ?? "Sélectionner";
  const statutLabel =
    { en_attente: "En attente", en_cours: "En cours", termine: "Terminé" }[
      statut
    ] ?? statut;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input id="titre" name="titre" required placeholder="Nom du projet" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v ?? "none")}>
                <SelectTrigger className="w-full">{clientLabel}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chef de projet</Label>
              <Select
                value={chefProjetId}
                onValueChange={(v) => setChefProjetId(v ?? "none")}
              >
                <SelectTrigger className="w-full">{chefLabel}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
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
              <Label>Statut</Label>
              <Select value={statut} onValueChange={(v) => setStatut(v ?? "en_attente")}>
                <SelectTrigger className="w-full">{statutLabel}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="termine">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budgetTotal">Budget total (€)</Label>
              <Input
                id="budgetTotal"
                name="budgetTotal"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date début</Label>
              <Input id="dateDebut" name="dateDebut" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" name="deadline" type="date" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Constants ────────────────────────────────────────────

const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
};

const statutVariants: Record<string, "default" | "secondary" | "outline"> = {
  en_cours: "default",
  en_attente: "secondary",
  termine: "outline",
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
    maximumFractionDigits: 0,
  }).format(amount);
}

function BudgetBar({ consumed, total }: { consumed: number; total: number }) {
  const pct = total > 0 ? Math.min((consumed / total) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs tabular-nums">
        <span>{formatCurrency(consumed)}</span>
        <span className="text-muted-foreground">{formatCurrency(total)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ProjectList({
  projects,
  clients,
  allClients,
  users,
}: {
  projects: Project[];
  clients: ClientOption[];
  allClients: ClientOption[];
  users: UserOption[];
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.statut !== statusFilter) return false;
      if (clientFilter !== "all" && String(p.clientId) !== clientFilter)
        return false;
      return true;
    });
  }, [projects, statusFilter, clientFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-44">
            {statusFilter === "all" ? "Tous les statuts" : (statutLabels[statusFilter] ?? statusFilter)}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="termine">Terminé</SelectItem>
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={(v) => setClientFilter(v ?? "all")}>
          <SelectTrigger className="w-52">
            {clientFilter === "all" ? "Tous les clients" : (clients.find((c) => String(c.id) === clientFilter)?.label ?? clientFilter)}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || clientFilter !== "all") && (
          <button
            onClick={() => {
              setStatusFilter("all");
              setClientFilter("all");
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Réinitialiser
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filtered.length} projet{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="flex rounded-md border">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nouveau projet
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          Aucun projet trouvé.
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-snug">
                    <Link href={`/projets/${p.id}`} className="hover:text-primary transition-colors">
                      {p.titre}
                    </Link>
                  </CardTitle>
                  <Badge
                    variant={statutVariants[p.statut] ?? "secondary"}
                    className="shrink-0"
                  >
                    {statutLabels[p.statut] ?? p.statut}
                  </Badge>
                </div>
                {p.clientNom && (
                  <p className="text-sm text-muted-foreground">{p.clientNom}</p>
                )}
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <BudgetBar consumed={p.budgetConsomme} total={p.budgetTotal} />
                {p.resteAFacturer !== null && p.resteAFacturer > 0 && (
                  <p className="text-xs text-blue-600">
                    À facturer : {formatCurrency(p.resteAFacturer)}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.chefProjet ?? "—"}</span>
                  <span>{formatDate(p.deadline)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projet</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Chef de projet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">À facturer</TableHead>
                <TableHead>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link href={`/projets/${p.id}`} className="hover:text-primary transition-colors">
                      {p.titre}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.clientNom ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.chefProjet ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statutVariants[p.statut] ?? "secondary"}>
                      {statutLabels[p.statut] ?? p.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.budgetConsomme)} /{" "}
                    {formatCurrency(p.budgetTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.resteAFacturer !== null && p.resteAFacturer > 0 ? (
                      <span className="text-blue-600">
                        {formatCurrency(p.resteAFacturer)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.deadline)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateProjectDialog
        clients={allClients}
        users={users}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
