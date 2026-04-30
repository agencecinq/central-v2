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

  const statutTone =
    project.statut === "en_cours"
      ? { c: "var(--rail-success)", bg: "var(--rail-success-bg)" }
      : project.statut === "termine"
        ? { c: "var(--rail-info)", bg: "var(--rail-info-bg)" }
        : { c: "var(--rail-warn)", bg: "var(--rail-warn-bg)" };

  return (
    <>
      {/* Header sticky */}
      <div
        className="sticky top-0 z-10"
        style={{
          borderBottom: "1px solid var(--rail-hair)",
          background: "var(--rail-panel)",
        }}
      >
        <div className="px-7 pt-3.5 pb-3.5">
          <Link
            href="/projets"
            className="inline-flex items-center gap-1.5 text-[12px]"
            style={{ color: "var(--rail-muted)" }}
          >
            <ArrowLeft className="h-3 w-3" /> Projets
          </Link>
          <div className="mt-2 flex items-end justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="m-0 text-[22px] font-semibold" style={{ letterSpacing: "-0.4px" }}>
                  {project.titre}
                </h1>
                <span
                  className="text-[10.5px] uppercase font-medium"
                  style={{
                    padding: "3px 7px",
                    background: statutTone.bg,
                    color: statutTone.c,
                    borderRadius: 3,
                    letterSpacing: "0.04em",
                  }}
                >
                  {statutLabels[project.statut] ?? project.statut}
                </span>
              </div>
              <p
                className="mt-1 text-[13px]"
                style={{ color: "var(--rail-muted)" }}
              >
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
        </div>
      </div>

      <div className="space-y-6 px-7 pt-5 pb-12">
        {/* KPI strip — Rail v2 */}
        <div className={`grid gap-4 sm:grid-cols-2 ${deal ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          <RailKpi label="Budget" main={formatCurrency(budgetConsomme)} sub={`/ ${formatCurrency(budgetTotal)}`} pct={budgetPct} subline={
            (budgetBreakdown.depenses > 0 || budgetBreakdown.temps > 0)
              ? [
                  budgetBreakdown.depenses > 0 ? `${formatCurrency(budgetBreakdown.depenses)} dépenses` : "",
                  budgetBreakdown.temps > 0 ? `${formatCurrency(budgetBreakdown.temps)} temps` : "",
                ].filter(Boolean).join(" · ")
              : undefined
          } tone={budgetPct > 95 ? "danger" : budgetPct > 80 ? "warn" : "default"} />
          {deal && montantSigne !== null && (
            <RailKpi label="Facturation" main={formatCurrency(totalFacture)} sub={`/ ${formatCurrency(montantSigne)}`} pct={facturePct} tone="info" />
          )}
          <RailKpi label="Tâches" main={`${tasks.filter((t) => t.statutKanban === "done").length}`} sub={`/ ${tasks.length}`} pct={tasks.length > 0 ? Math.round((tasks.filter((t) => t.statutKanban === "done").length / tasks.length) * 100) : 0} />
          <RailKpi label="Début" main={formatDate(project.dateDebut)} />
          <RailKpi label="Deadline" main={formatDate(project.deadline)} />
        </div>

      {/* Linked invoices from deal — Rail v2 panel */}
      {deal && deal.dealFactures.length > 0 && (
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
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">Factures liées</span>
              <span className="text-[11.5px]" style={{ color: "var(--rail-muted)" }}>
                · {deal.dealFactures.length} facture{deal.dealFactures.length > 1 ? "s" : ""}
              </span>
            </div>
            {resteAFacturer !== null && resteAFacturer > 0 && (
              <span className="text-[11.5px]" style={{ color: "var(--rail-warn)" }}>
                Reste à facturer : <strong>{formatCurrency(resteAFacturer)}</strong>
              </span>
            )}
          </header>
          <div>
            <div
              className="grid gap-3 text-[10.5px] uppercase"
              style={{
                gridTemplateColumns: "120px 1fr 140px 120px",
                padding: "8px 18px",
                letterSpacing: "0.08em",
                color: "var(--rail-muted)",
                background: "var(--rail-hair3)",
                borderBottom: "1px solid var(--rail-hair2)",
              }}
            >
              <span>N°</span>
              <span>Client</span>
              <span className="text-right">Montant HT</span>
              <span>Date</span>
            </div>
            {deal.dealFactures.map((df, i) => (
              <div
                key={df.id}
                className="grid gap-3 items-center text-[13px]"
                style={{
                  gridTemplateColumns: "120px 1fr 140px 120px",
                  padding: "10px 18px",
                  borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                }}
              >
                <span
                  className="inline-flex items-center gap-1.5 text-[11.5px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--rail-ink2)" }}
                >
                  <Link2 className="h-3 w-3" style={{ color: "var(--rail-muted2)" }} />
                  {df.numero}
                </span>
                <span style={{ color: "var(--rail-ink2)" }}>{df.clientNom}</span>
                <span
                  className="text-right font-medium"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {formatCurrency(Number(df.montantHT))}
                </span>
                <span
                  className="text-[12px]"
                  style={{ color: "var(--rail-muted)" }}
                >
                  {df.dateFacture ? formatDate(df.dateFacture) : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
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
    </>
  );
}

// ─── Rail KPI Card (no sparkline) ─────────────────────────
function RailKpi({
  label,
  main,
  sub,
  pct,
  subline,
  tone,
}: {
  label: string;
  main: string;
  sub?: string;
  pct?: number;
  subline?: string;
  tone?: "default" | "warn" | "danger" | "info";
}) {
  const barColor =
    tone === "danger"
      ? "var(--rail-danger)"
      : tone === "warn"
        ? "var(--rail-warn)"
        : tone === "info"
          ? "var(--rail-info)"
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
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[22px] font-semibold tabular leading-tight"
          style={{ letterSpacing: "-0.4px" }}
        >
          {main}
        </span>
        {sub && (
          <span
            className="text-[12px]"
            style={{ color: "var(--rail-muted)", fontFamily: "var(--font-mono)" }}
          >
            {sub}
          </span>
        )}
      </div>
      {pct !== undefined && (
        <div
          className="mt-2.5 h-1 rounded overflow-hidden"
          style={{ background: "var(--rail-hair)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, Math.max(0, pct))}%`,
              background: barColor,
            }}
          />
        </div>
      )}
      {subline && (
        <div
          className="mt-1.5 text-[11px]"
          style={{ color: "var(--rail-muted)" }}
        >
          {subline}
        </div>
      )}
    </div>
  );
}
