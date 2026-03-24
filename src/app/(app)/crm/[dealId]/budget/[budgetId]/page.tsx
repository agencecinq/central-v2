import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BudgetEditor } from "./budget-editor";

export default async function BudgetEditorPage({
  params,
}: {
  params: Promise<{ dealId: string; budgetId: string }>;
}) {
  const { dealId: rawDealId, budgetId: rawBudgetId } = await params;
  const dealId = parseInt(rawDealId);
  if (isNaN(dealId)) notFound();

  // Verify deal exists
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { client: true },
  });
  if (!deal) notFound();

  const isNew = rawBudgetId === "new";

  let serializedBudget = null;

  if (!isNew) {
    const budgetId = parseInt(rawBudgetId);
    if (isNaN(budgetId)) notFound();

    const budget = await prisma.propositionCommerciale.findUnique({
      where: { id: budgetId },
      include: {
        sections: {
          include: { sousSections: { orderBy: { ordre: "asc" } } },
          orderBy: { ordre: "asc" },
        },
        planningEtapes: {
          orderBy: { ordre: "asc" },
        },
      },
    });

    if (!budget || budget.dealId !== dealId) notFound();

    serializedBudget = {
      id: budget.id,
      publicToken: budget.publicToken,
      nom: budget.nom,
      introduction: budget.introduction,
      conclusion: budget.conclusion,
      remiseGlobale: Number(budget.remiseGlobale),
      tauxTva: Number(budget.tauxTva),
      tauxGestionProjet: Number(budget.tauxGestionProjet),
      tjmGestionProjet: Number(budget.tjmGestionProjet),
      langue: budget.langue,
      devise: budget.devise,
      dateDebutProjet: budget.dateDebutProjet
        ? budget.dateDebutProjet.toISOString().split("T")[0]
        : null,
      logoEntreprise: budget.logoEntreprise,
      logoClient: budget.logoClient,
      beneficesCles: budget.beneficesCles,
      informationsComplementaires: budget.informationsComplementaires,
      callToAction: budget.callToAction,
      references: budget.references,
      sections: budget.sections.map((s) => ({
        id: s.id,
        titre: s.titre,
        description: s.description,
        ordre: s.ordre,
        estOption: s.estOption,
        sousSections: s.sousSections.map((ss) => ({
          id: ss.id,
          titre: ss.titre,
          description: ss.description,
          nombreJours: Number(ss.nombreJours),
          tjm: Number(ss.tjm),
          ordre: ss.ordre,
          remise: Number(ss.remise),
        })),
      })),
      planningEtapes: budget.planningEtapes.map((e) => ({
        id: e.id,
        titre: e.titre,
        description: e.description,
        ordre: e.ordre,
        nombreSemaines: e.nombreSemaines ? Number(e.nombreSemaines) : null,
      })),
    };
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/crm/${dealId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au deal
      </Link>

      <BudgetEditor
        dealId={dealId}
        dealTitre={deal.titre}
        clientName={deal.client.entreprise || deal.client.nom}
        budget={serializedBudget}
        qontoClientId={deal.client.qontoClientId ?? null}
        qontoQuoteId={deal.qontoQuoteId ?? null}
      />
    </div>
  );
}
