"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}: {
  projects: Project[];
  clients: ClientOption[];
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");

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
    </div>
  );
}
