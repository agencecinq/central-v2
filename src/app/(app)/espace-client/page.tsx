import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Ticket, FileText, ArrowRight } from "lucide-react";
import { requireClient } from "@/lib/require-client";
import { prisma } from "@/lib/prisma";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function EspaceClientPage() {
  const { projectIds, userName } = await requireClient();

  const [projects, tickets, deals] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, statut: true },
    }),
    prisma.ticket.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, statut: true },
    }),
    prisma.deal.findMany({
      where: { projects: { some: { id: { in: projectIds } } } },
      include: { dealFactures: { select: { montantHT: true } } },
    }),
  ]);

  const activeProjects = projects.filter((p) => p.statut === "en_cours").length;
  const openTickets = tickets.filter((t) => t.statut === "ouvert" || t.statut === "en_cours").length;
  const totalFacture = deals.reduce(
    (sum, d) =>
      sum + d.dealFactures.reduce((s, f) => s + Number(f.montantHT), 0),
    0,
  );

  const firstName = userName?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8 px-7 pt-6 pb-12">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Bonjour, {firstName}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Bienvenue sur votre espace client.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FolderKanban className="h-4 w-4" />
              Projets actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{activeProjects}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {projects.length} projet{projects.length > 1 ? "s" : ""} au total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Ticket className="h-4 w-4" />
              Tickets ouverts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{openTickets}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tickets.length} ticket{tickets.length > 1 ? "s" : ""} au total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Total facturé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {totalFacture > 0 ? formatCurrency(totalFacture) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {deals.reduce((s, d) => s + d.dealFactures.length, 0)} facture
              {deals.reduce((s, d) => s + d.dealFactures.length, 0) > 1
                ? "s"
                : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/espace-client/projets"
          className="group rounded-lg border bg-card p-5 hover:border-primary/50 hover:bg-accent/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderKanban className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div>
                <p className="font-medium">Mes projets</p>
                <p className="text-sm text-muted-foreground">
                  Suivez l&apos;avancement de vos projets
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link
          href="/espace-client/factures"
          className="group rounded-lg border bg-card p-5 hover:border-primary/50 hover:bg-accent/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div>
                <p className="font-medium">Factures</p>
                <p className="text-sm text-muted-foreground">
                  Consultez vos factures et montants
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link
          href="/tickets"
          className="group rounded-lg border bg-card p-5 hover:border-primary/50 hover:bg-accent/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Ticket className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div>
                <p className="font-medium">Tickets</p>
                <p className="text-sm text-muted-foreground">
                  Signalez un bug ou une demande
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
