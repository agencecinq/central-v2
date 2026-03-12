import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ticket } from "lucide-react";
import { requireClient } from "@/lib/require-client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientGantt } from "./client-gantt";

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

const kanbanLabels: Record<string, string> = {
  todo: "À faire",
  done: "Terminé",
};

const kanbanVariants: Record<string, "default" | "secondary" | "outline"> = {
  todo: "secondary",
  done: "outline",
};

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
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

export default async function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { clientId } = await requireClient();
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        include: { user: { select: { name: true } } },
        orderBy: [{ statutKanban: "asc" }, { priorityLevel: "desc" }],
      },
      deal: { include: { dealFactures: { orderBy: { dateFacture: "desc" } } } },
      allocations: {
        include: { metier: { select: { nom: true } } },
        orderBy: { dateDebut: "asc" },
      },
    },
  });

  if (!project || project.clientId !== clientId) notFound();

  // Task stats
  const tasksDone = project.tasks.filter((t) => t.statutKanban === "done").length;
  const tasksTotal = project.tasks.length;
  const tasksPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  // Deal / factures
  const deal = project.deal;
  const montantSigne = deal?.montantFinal ? Number(deal.montantFinal) : null;
  const totalFacture = deal
    ? deal.dealFactures.reduce((sum, df) => sum + Number(df.montantHT), 0)
    : 0;
  const resteAFacturer =
    montantSigne !== null ? Math.max(0, montantSigne - totalFacture) : null;

  // Gantt data
  const phases = project.allocations.map((a) => ({
    id: a.id,
    metierId: a.metierId,
    metierNom: a.metier.nom,
    joursPrevus: Number(a.joursPrevus),
    dateDebut: a.dateDebut?.toISOString() ?? null,
    dateFin: a.dateFin?.toISOString() ?? null,
  }));

  const ganttTasks = project.tasks.map((t) => ({
    id: t.id,
    titre: t.titre,
    description: t.description,
    statutKanban: t.statutKanban,
    categorie: t.categorie,
    priorityLevel: t.priorityLevel,
    estimationHeures: t.estimationHeures ? Number(t.estimationHeures) : null,
    dateEcheance: t.dateEcheance?.toISOString() ?? null,
    dateDebut: t.dateDebut?.toISOString() ?? null,
    allocationId: t.allocationId,
    assignee: t.user?.name ?? null,
    userId: t.userId,
    isOutOfScope: t.isOutOfScope,
  }));

  const hasGanttData = phases.length > 0 || ganttTasks.some((t) => t.dateDebut || t.dateEcheance);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/espace-client/projets"
          className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            {project.titre}
          </h2>
          <Badge variant={statutVariants[project.statut] ?? "secondary"}>
            {statutLabels[project.statut] ?? project.statut}
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avancement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold tabular-nums">{tasksPct}%</p>
              <div className="flex-1">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${tasksPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasksDone}/{tasksTotal} tâches
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Date de début
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatDate(project.dateDebut)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deadline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatDate(project.deadline)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Planning (Gantt) */}
      {hasGanttData && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Planning</h3>
          <ClientGantt phases={phases} tasks={ganttTasks} />
        </div>
      )}

      {/* Factures liées */}
      {deal && deal.dealFactures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Factures
              {resteAFacturer !== null && resteAFacturer > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  · Reste à facturer : {formatCurrency(resteAFacturer)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead className="text-right">Montant HT</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deal.dealFactures.map((df) => (
                  <TableRow key={df.id}>
                    <TableCell className="font-medium">{df.numero}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(df.montantHT))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(df.dateFacture)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tâches */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Tâches ({tasksTotal})
          </h3>
          <Link
            href="/tickets"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Ticket className="h-4 w-4" />
            Voir les tickets
          </Link>
        </div>

        {tasksTotal === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
            Aucune tâche pour ce projet.
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tâche</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Assigné</TableHead>
                  <TableHead>Échéance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.tasks.map((t) => (
                  <TableRow
                    key={t.id}
                    className={
                      t.statutKanban === "done" ? "opacity-60" : undefined
                    }
                  >
                    <TableCell>
                      <span
                        className={`font-medium ${t.statutKanban === "done" ? "line-through" : ""}`}
                      >
                        {t.titre}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={kanbanVariants[t.statutKanban] ?? "secondary"}
                      >
                        {kanbanLabels[t.statutKanban] ?? t.statutKanban}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.user?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(t.dateEcheance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
