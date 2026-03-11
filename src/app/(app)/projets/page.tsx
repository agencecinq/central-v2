import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeBudgetConsomme } from "@/lib/compute-budget";
import { ProjectList } from "./project-list";

export default async function ProjetsPage() {
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      include: {
        client: true,
        chefProjet: true,
        deal: { include: { dealFactures: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { projects: { some: {} } },
      orderBy: { entreprise: "asc" },
    }),
  ]);

  // Calcul dynamique du budget consommé (dépenses + temps × TJM)
  const projectIds = projects.map((p) => p.id);
  const budgetMap = await computeBudgetConsomme(projectIds);

  const serialized = projects.map((p) => {
    const deal = p.deal;
    const montantSigne = deal?.montantFinal ? Number(deal.montantFinal) : null;
    const totalFacture = deal
      ? deal.dealFactures.reduce((sum, df) => sum + Number(df.montantHT), 0)
      : 0;
    const resteAFacturer =
      montantSigne !== null ? Math.max(0, montantSigne - totalFacture) : null;

    return {
      id: p.id,
      titre: p.titre,
      statut: p.statut,
      budgetTotal: Number(p.budgetTotal),
      budgetConsomme: budgetMap.get(p.id)?.total ?? 0,
      deadline: p.deadline?.toISOString() ?? null,
      dateDebut: p.dateDebut?.toISOString() ?? null,
      clientNom: p.client?.entreprise ?? p.client?.nom ?? null,
      clientId: p.clientId,
      chefProjet: p.chefProjet?.name ?? null,
      resteAFacturer,
    };
  });

  const clientOptions = clients.map((c) => ({
    id: c.id,
    label: c.entreprise ?? c.nom,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Projets</h2>
          <p className="mt-1 text-muted-foreground">
            Gérez vos projets et suivez leur avancement.
          </p>
        </div>
        <Link
          href="/projets/charge-de-travail"
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
          Disponibilité
        </Link>
      </div>

      <ProjectList projects={serialized} clients={clientOptions} />
    </div>
  );
}
