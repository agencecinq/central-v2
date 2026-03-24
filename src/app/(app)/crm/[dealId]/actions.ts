"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

export async function deleteBudget(budgetId: number, dealId: number) {
  // Delete children first (sous-sections → sections → planning → proposition)
  const sections = await prisma.propositionCommercialeSection.findMany({
    where: { propositionCommercialeId: budgetId },
    select: { id: true },
  });

  if (sections.length > 0) {
    await prisma.propositionCommercialeSousSection.deleteMany({
      where: { sectionId: { in: sections.map((s) => s.id) } },
    });
  }

  await prisma.propositionCommercialeSection.deleteMany({
    where: { propositionCommercialeId: budgetId },
  });

  await prisma.propositionCommercialePlanningEtape.deleteMany({
    where: { propositionCommercialeId: budgetId },
  });

  await prisma.propositionCommerciale.delete({
    where: { id: budgetId },
  });

  revalidatePath(`/crm/${dealId}`);
}

export async function duplicateBudget(
  budgetId: number,
  dealId: number,
): Promise<number> {
  const original = await prisma.propositionCommerciale.findUniqueOrThrow({
    where: { id: budgetId },
    include: {
      sections: {
        include: { sousSections: true },
        orderBy: { ordre: "asc" },
      },
      planningEtapes: {
        orderBy: { ordre: "asc" },
      },
    },
  });

  const newToken = randomBytes(32).toString("hex");

  const newBudget = await prisma.propositionCommerciale.create({
    data: {
      dealId,
      nom: original.nom ? `${original.nom} (copie)` : "Copie",
      publicToken: newToken,
      montantTotal: original.montantTotal,
      introduction: original.introduction,
      conclusion: original.conclusion,
      remiseGlobale: original.remiseGlobale,
      langue: original.langue,
      devise: original.devise,
      tauxTva: original.tauxTva,
      tauxGestionProjet: original.tauxGestionProjet,
      tjmGestionProjet: original.tjmGestionProjet,
      beneficesCles: original.beneficesCles,
      informationsComplementaires: original.informationsComplementaires,
      callToAction: original.callToAction,
      references: original.references,
      dateDebutProjet: original.dateDebutProjet,
    },
  });

  // Duplicate sections and sous-sections
  for (const section of original.sections) {
    const newSection = await prisma.propositionCommercialeSection.create({
      data: {
        propositionCommercialeId: newBudget.id,
        titre: section.titre,
        description: section.description,
        ordre: section.ordre,
        estOption: section.estOption,
      },
    });

    for (const ss of section.sousSections) {
      await prisma.propositionCommercialeSousSection.create({
        data: {
          sectionId: newSection.id,
          titre: ss.titre,
          description: ss.description,
          nombreJours: ss.nombreJours,
          tjm: ss.tjm,
          ordre: ss.ordre,
          remise: ss.remise,
        },
      });
    }
  }

  // Duplicate planning étapes
  for (const etape of original.planningEtapes) {
    await prisma.propositionCommercialePlanningEtape.create({
      data: {
        propositionCommercialeId: newBudget.id,
        titre: etape.titre,
        description: etape.description,
        ordre: etape.ordre,
        nombreSemaines: etape.nombreSemaines,
      },
    });
  }

  revalidatePath(`/crm/${dealId}`);
  return newBudget.id;
}

export async function updateClientQontoId(
  clientId: number,
  qontoClientId: string | null,
) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { qontoClientId },
  });

  revalidatePath("/crm");
}
