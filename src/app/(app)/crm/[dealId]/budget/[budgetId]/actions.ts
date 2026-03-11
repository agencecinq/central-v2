"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { computeBudgetTotals } from "@/lib/budget-calc";

interface SousSectionInput {
  titre: string;
  description: string | null;
  nombreJours: number;
  tjm: number;
  remise: number;
}

interface SectionInput {
  titre: string;
  description: string | null;
  estOption: boolean;
  sousSections: SousSectionInput[];
}

interface PlanningEtapeInput {
  titre: string;
  description: string | null;
  nombreSemaines: number | null;
}

interface BudgetInput {
  nom: string | null;
  introduction: string | null;
  conclusion: string | null;
  remiseGlobale: number;
  tauxTva: number;
  tauxGestionProjet: number;
  tjmGestionProjet: number;
  langue: string;
  devise: string;
  dateDebutProjet: string | null;
  logoEntreprise: string | null;
  logoClient: string | null;
  beneficesCles: string | null;
  informationsComplementaires: string | null;
  callToAction: string | null;
  references: string | null;
  sections: SectionInput[];
  planningEtapes: PlanningEtapeInput[];
}

export async function saveBudget(
  dealId: number,
  budgetId: number | null,
  data: BudgetInput,
) {
  // Compute montantTotal from the data
  const totals = computeBudgetTotals({
    sections: data.sections.map((s) => ({
      estOption: s.estOption,
      sousSections: s.sousSections.map((ss) => ({
        nombreJours: ss.nombreJours,
        tjm: ss.tjm,
        remise: ss.remise,
      })),
    })),
    remiseGlobale: data.remiseGlobale,
    tauxTva: data.tauxTva,
    tauxGestionProjet: data.tauxGestionProjet,
    tjmGestionProjet: data.tjmGestionProjet,
  });

  if (budgetId) {
    // UPDATE: delete-and-recreate children in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing children
      const sections = await tx.propositionCommercialeSection.findMany({
        where: { propositionCommercialeId: budgetId },
        select: { id: true },
      });

      if (sections.length > 0) {
        await tx.propositionCommercialeSousSection.deleteMany({
          where: { sectionId: { in: sections.map((s) => s.id) } },
        });
      }

      await tx.propositionCommercialeSection.deleteMany({
        where: { propositionCommercialeId: budgetId },
      });

      await tx.propositionCommercialePlanningEtape.deleteMany({
        where: { propositionCommercialeId: budgetId },
      });

      // Update the proposition itself
      await tx.propositionCommerciale.update({
        where: { id: budgetId },
        data: {
          nom: data.nom,
          montantTotal: totals.totalApresRemise,
          introduction: data.introduction,
          conclusion: data.conclusion,
          remiseGlobale: data.remiseGlobale,
          tauxTva: data.tauxTva,
          tauxGestionProjet: data.tauxGestionProjet,
          tjmGestionProjet: data.tjmGestionProjet,
          langue: data.langue,
          devise: data.devise,
          dateDebutProjet: data.dateDebutProjet
            ? new Date(data.dateDebutProjet)
            : null,
          logoEntreprise: data.logoEntreprise,
          logoClient: data.logoClient,
          beneficesCles: data.beneficesCles,
          informationsComplementaires: data.informationsComplementaires,
          callToAction: data.callToAction,
          references: data.references,
        },
      });

      // Recreate sections and sous-sections
      for (let si = 0; si < data.sections.length; si++) {
        const section = data.sections[si];
        const newSection = await tx.propositionCommercialeSection.create({
          data: {
            propositionCommercialeId: budgetId,
            titre: section.titre,
            description: section.description,
            ordre: si,
            estOption: section.estOption,
          },
        });

        for (let ssi = 0; ssi < section.sousSections.length; ssi++) {
          const ss = section.sousSections[ssi];
          await tx.propositionCommercialeSousSection.create({
            data: {
              sectionId: newSection.id,
              titre: ss.titre,
              description: ss.description,
              nombreJours: ss.nombreJours,
              tjm: ss.tjm,
              ordre: ssi,
              remise: ss.remise,
            },
          });
        }
      }

      // Recreate planning étapes
      for (let pi = 0; pi < data.planningEtapes.length; pi++) {
        const etape = data.planningEtapes[pi];
        await tx.propositionCommercialePlanningEtape.create({
          data: {
            propositionCommercialeId: budgetId,
            titre: etape.titre,
            description: etape.description,
            ordre: pi,
            nombreSemaines: etape.nombreSemaines,
          },
        });
      }
    });

    revalidatePath(`/crm/${dealId}`);
    revalidatePath(`/crm/${dealId}/budget/${budgetId}`);
  } else {
    // CREATE new proposition
    const newToken = randomBytes(32).toString("hex");

    const newBudget = await prisma.propositionCommerciale.create({
      data: {
        dealId,
        nom: data.nom,
        publicToken: newToken,
        montantTotal: totals.totalApresRemise,
        introduction: data.introduction,
        conclusion: data.conclusion,
        remiseGlobale: data.remiseGlobale,
        tauxTva: data.tauxTva,
        tauxGestionProjet: data.tauxGestionProjet,
        tjmGestionProjet: data.tjmGestionProjet,
        langue: data.langue,
        devise: data.devise,
        dateDebutProjet: data.dateDebutProjet
          ? new Date(data.dateDebutProjet)
          : null,
        logoEntreprise: data.logoEntreprise,
        logoClient: data.logoClient,
        beneficesCles: data.beneficesCles,
        informationsComplementaires: data.informationsComplementaires,
        callToAction: data.callToAction,
        references: data.references,
      },
    });

    // Create sections and sous-sections
    for (let si = 0; si < data.sections.length; si++) {
      const section = data.sections[si];
      const newSection = await prisma.propositionCommercialeSection.create({
        data: {
          propositionCommercialeId: newBudget.id,
          titre: section.titre,
          description: section.description,
          ordre: si,
          estOption: section.estOption,
        },
      });

      for (let ssi = 0; ssi < section.sousSections.length; ssi++) {
        const ss = section.sousSections[ssi];
        await prisma.propositionCommercialeSousSection.create({
          data: {
            sectionId: newSection.id,
            titre: ss.titre,
            description: ss.description,
            nombreJours: ss.nombreJours,
            tjm: ss.tjm,
            ordre: ssi,
            remise: ss.remise,
          },
        });
      }
    }

    // Create planning étapes
    for (let pi = 0; pi < data.planningEtapes.length; pi++) {
      const etape = data.planningEtapes[pi];
      await prisma.propositionCommercialePlanningEtape.create({
        data: {
          propositionCommercialeId: newBudget.id,
          titre: etape.titre,
          description: etape.description,
          ordre: pi,
          nombreSemaines: etape.nombreSemaines,
        },
      });
    }

    revalidatePath(`/crm/${dealId}`);
    redirect(`/crm/${dealId}/budget/${newBudget.id}`);
  }
}
