import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeBudgetConsomme } from "@/lib/compute-budget";
import { ProjectList } from "./project-list";
import { RailPageHeader, RailPageBody } from "@/components/rail/page-header";

export default async function ProjetsPage() {
  const [projects, allClients, users] = await Promise.all([
    prisma.project.findMany({
      include: {
        client: true,
        chefProjet: true,
        deal: { include: { dealFactures: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      orderBy: { entreprise: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "equipe"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
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

  // Clients qui ont des projets (pour le filtre)
  const clientsWithProjects = allClients.filter((c) =>
    projects.some((p) => p.clientId === c.id),
  );

  const clientOptions = clientsWithProjects.map((c) => ({
    id: c.id,
    label: c.entreprise ?? c.nom,
  }));

  // Tous les clients (pour le dialog de création)
  const allClientOptions = allClients.map((c) => ({
    id: c.id,
    label: c.entreprise ?? c.nom,
  }));

  const userOptions = users.map((u) => ({
    id: u.id,
    name: u.name ?? "",
  }));

  const enCours = serialized.filter((p) => p.statut === "en_cours").length;
  const enAttente = serialized.filter((p) => p.statut === "en_attente").length;

  return (
    <>
      <RailPageHeader
        eyebrow="Portefeuille"
        title="Projets"
        description={`${enCours} en cours · ${enAttente} en attente · ${serialized.length} au total`}
        actions={
          <Link
            href="/projets/disponibilite-equipe"
            className="inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-medium bg-white"
            style={{
              padding: "7px 12px",
              border: "1px solid var(--rail-hair)",
            }}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Disponibilité
          </Link>
        }
      />
      <RailPageBody>
        <ProjectList
          projects={serialized}
          clients={clientOptions}
          allClients={allClientOptions}
          users={userOptions}
        />
      </RailPageBody>
    </>
  );
}
