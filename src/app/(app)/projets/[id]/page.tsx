import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeBudgetConsomme } from "@/lib/compute-budget";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectHeaderActions } from "./project-header-actions";
import { ProjectTabs } from "./project-tabs";
import { WidgetIntegration } from "./widget-integration";

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      deal: { include: { dealFactures: true } },
      chefProjet: true,
      tasks: {
        include: { user: true },
        orderBy: [{ statutKanban: "asc" }, { priorityLevel: "desc" }],
      },
      transactions: {
        orderBy: { dateTransaction: "desc" },
      },
    },
  });

  if (!project) notFound();

  const [users, clients, deals, rawPhases, metiers, rawUserMetiers] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      select: { id: true, nom: true, entreprise: true },
      orderBy: { entreprise: "asc" },
    }),
    prisma.deal.findMany({
      where: { etape: "Gagné" },
      select: { id: true, titre: true, montantFinal: true },
      orderBy: { dateSignature: "desc" },
    }),
    prisma.projectAllocation.findMany({
      where: { projectId },
      include: {
        metier: { select: { nom: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ dateDebut: "asc" }, { metierId: "asc" }],
    }),
    prisma.metier.findMany({ orderBy: { nom: "asc" } }),
    prisma.userMetier.findMany({
      where: { user: { role: { in: ["admin", "equipe"] } } },
      select: {
        userId: true,
        metierId: true,
        user: { select: { id: true, name: true } },
      },
    }),
  ]);

  const projectData = {
    id: project.id,
    titre: project.titre,
    description: project.description,
    statut: project.statut,
    clientId: project.clientId,
    chefProjetId: project.chefProjetId,
    dealId: project.dealId,
    budgetTotal: Number(project.budgetTotal),
    joursVendus: project.joursVendus ? Number(project.joursVendus) : null,
    dateDebut: project.dateDebut?.toISOString() ?? null,
    deadline: project.deadline?.toISOString() ?? null,
    githubUrl: project.githubUrl,
    figmaUrl: project.figmaUrl,
  };

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.entreprise || c.nom,
  }));

  const dealOptions = deals.map((d) => ({
    id: d.id,
    titre: d.titre,
    montantFinal: d.montantFinal ? Number(d.montantFinal) : null,
  }));

  // Calcul dynamique du budget consommé (dépenses + temps × TJM)
  const budgetMap = await computeBudgetConsomme([projectId]);
  const budgetBreakdown = budgetMap.get(projectId) ?? { total: 0, depenses: 0, temps: 0 };

  const budgetTotal = Number(project.budgetTotal);
  const budgetConsomme = budgetBreakdown.total;
  const budgetPct = budgetTotal > 0 ? Math.min((budgetConsomme / budgetTotal) * 100, 100) : 0;

  // Facturation data from linked deal
  const deal = project.deal;
  const montantSigne = deal?.montantFinal ? Number(deal.montantFinal) : null;
  const totalFacture = deal
    ? deal.dealFactures.reduce((sum, df) => sum + Number(df.montantHT), 0)
    : 0;
  const resteAFacturer = montantSigne !== null
    ? Math.max(0, montantSigne - totalFacture)
    : null;
  const facturePct = montantSigne && montantSigne > 0
    ? Math.min((totalFacture / montantSigne) * 100, 100)
    : 0;

  const tasks = project.tasks.map((t) => ({
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

  const transactions = project.transactions.map((tx) => ({
    id: tx.id,
    label: tx.label,
    categorie: tx.categorie,
    montant: Number(tx.montant),
    type: tx.type,
    statut: tx.statut,
    montantPaye: Number(tx.montantPaye),
    dateTransaction: tx.dateTransaction.toISOString(),
  }));

  // Time entries pour l'onglet Temps passé
  const rawTimeEntries = await prisma.timeEntry.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, name: true, tjm: true } },
      task: { select: { titre: true } },
    },
    orderBy: { semaine: "desc" },
  });

  const timeEntries = rawTimeEntries.map((te) => ({
    id: te.id,
    semaine: te.semaine,
    duree: Number(te.duree),
    unite: te.unite,
    categorie: te.categorie,
    description: te.description,
    userName: te.user.name,
    userTjm: te.user.tjm ? Number(te.user.tjm) : null,
    taskTitre: te.task?.titre ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/projets"
          className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              {project.titre}
            </h2>
            <Badge variant={statutVariants[project.statut] ?? "secondary"}>
              {statutLabels[project.statut] ?? project.statut}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {project.client?.entreprise ?? project.client?.nom ?? "Sans client"}
            {project.chefProjet && ` · ${project.chefProjet.name}`}
            {deal && ` · Deal: ${deal.titre}`}
          </p>
        </div>
        <ProjectHeaderActions
          project={projectData}
          clients={clientOptions}
          users={users.map((u) => ({ id: u.id, name: u.name ?? "" }))}
          deals={dealOptions}
        />
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 ${deal ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(budgetConsomme)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {formatCurrency(budgetTotal)}
              </span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            {(budgetBreakdown.depenses > 0 || budgetBreakdown.temps > 0) && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {budgetBreakdown.depenses > 0 && (
                  <span>{formatCurrency(budgetBreakdown.depenses)} dépenses</span>
                )}
                {budgetBreakdown.depenses > 0 && budgetBreakdown.temps > 0 && (
                  <span> · </span>
                )}
                {budgetBreakdown.temps > 0 && (
                  <span>{formatCurrency(budgetBreakdown.temps)} temps</span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        {deal && montantSigne !== null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Facturation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(totalFacture)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}/ {formatCurrency(montantSigne)}
                </span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${facturePct}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tâches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {tasks.filter((t) => t.statutKanban === "done").length}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {tasks.length}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Début
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

      {/* Linked invoices from deal */}
      {deal && deal.dealFactures.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Factures liées
              {resteAFacturer !== null && resteAFacturer > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  · Reste à facturer : {formatCurrency(resteAFacturer)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">N°</th>
                    <th className="px-4 py-2.5 font-medium">Client</th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Montant HT
                    </th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deal.dealFactures.map((df) => (
                    <tr key={df.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono text-xs">{df.numero}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {df.clientNom}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {formatCurrency(Number(df.montantHT))}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {df.dateFacture
                          ? formatDate(df.dateFacture)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ProjectTabs
        projectId={projectId}
        tasks={tasks}
        transactions={transactions}
        timeEntries={timeEntries}
        users={users}
        phases={rawPhases.map((a) => ({
          id: a.id,
          metierId: a.metierId,
          metierNom: a.metier.nom,
          joursPrevus: Number(a.joursPrevus),
          dateDebut: a.dateDebut?.toISOString().slice(0, 10) ?? null,
          dateFin: a.dateFin?.toISOString().slice(0, 10) ?? null,
          userId: a.userId,
          userName: a.user?.name ?? null,
        }))}
        metiers={metiers.map((m) => ({ id: m.id, nom: m.nom }))}
        userMetiers={rawUserMetiers.map((um) => ({
          userId: um.userId,
          metierId: um.metierId,
          userName: um.user.name,
        }))}
      />

      <WidgetIntegration
        projectId={projectId}
        widgetToken={project.widgetToken}
        appUrl={process.env.NEXT_PUBLIC_APP_URL || "https://app.cinqteam.com"}
      />
    </div>
  );
}
