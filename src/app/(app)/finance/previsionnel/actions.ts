"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";

const PATH = "/finance/previsionnel";

async function requireAdmin() {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }
}

// ─── Catégories singleton (rémunération, emprunt) ────────────────────────────
// Un seul enregistrement par catégorie : on supprime + recrée.

export async function upsertSingletonExpense(data: {
  categorie: "remuneration" | "emprunt";
  montant: number;
  moisFin?: string; // seulement pour emprunt
}) {
  await requireAdmin();
  if (!data.montant || data.montant <= 0)
    throw new Error("Le montant doit être positif");

  // Supprimer l'ancien
  await prisma.forecastExpense.deleteMany({
    where: { categorie: data.categorie },
  });

  // Créer le nouveau
  await prisma.forecastExpense.create({
    data: {
      categorie: data.categorie,
      mois: "",
      moisFin: data.categorie === "emprunt" ? (data.moisFin ?? null) : null,
      libelle:
        data.categorie === "remuneration"
          ? "Rémunération dirigeants"
          : "Emprunt",
      montant: data.montant,
    },
  });

  revalidatePath(PATH);
}

export async function deleteSingletonExpense(
  categorie: "remuneration" | "emprunt",
) {
  await requireAdmin();
  await prisma.forecastExpense.deleteMany({ where: { categorie } });
  revalidatePath(PATH);
}

// ─── Catégories liste (abonnements, prestataires) ────────────────────────────

export async function createForecastExpense(data: {
  categorie: "abonnements" | "prestataires";
  libelle: string;
  montant: number;
  mois?: string; // requis pour prestataires
}) {
  await requireAdmin();
  if (!data.libelle?.trim()) throw new Error("Le libellé est requis");
  if (!data.montant || data.montant <= 0)
    throw new Error("Le montant doit être positif");
  if (data.categorie === "prestataires" && !data.mois)
    throw new Error("Le mois est requis pour un prestataire");

  await prisma.forecastExpense.create({
    data: {
      categorie: data.categorie,
      mois: data.categorie === "prestataires" ? data.mois! : "",
      libelle: data.libelle.trim(),
      montant: data.montant,
    },
  });

  revalidatePath(PATH);
}

export async function deleteForecastExpense(id: number) {
  await requireAdmin();
  await prisma.forecastExpense.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Deal Revenue Planning (répartition du reste à facturer) ────────────────

export async function upsertDealRevenu(data: {
  dealId: number;
  mois: string;
  montantHT: number;
}) {
  await requireAdmin();
  if (!data.dealId) throw new Error("Le deal est requis");
  if (!data.mois) throw new Error("Le mois est requis");
  if (!data.montantHT || data.montantHT <= 0)
    throw new Error("Le montant doit être positif");

  await prisma.dealRevenuPlanifie.upsert({
    where: {
      dealId_mois: { dealId: data.dealId, mois: data.mois },
    },
    create: {
      dealId: data.dealId,
      mois: data.mois,
      montantHT: data.montantHT,
    },
    update: {
      montantHT: data.montantHT,
    },
  });

  revalidatePath(PATH);
}

export async function deleteDealRevenu(id: number) {
  await requireAdmin();
  await prisma.dealRevenuPlanifie.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Invoice Planification (planifier les factures à encaisser) ──────────────

export async function upsertInvoicePlanification(data: {
  numero: string;
  mois: string;
}) {
  await requireAdmin();
  if (!data.numero) throw new Error("Le numéro de facture est requis");
  if (!data.mois) throw new Error("Le mois est requis");

  await prisma.invoicePlanification.upsert({
    where: { numero: data.numero },
    create: { numero: data.numero, mois: data.mois },
    update: { mois: data.mois },
  });

  revalidatePath(PATH);
}

export async function deleteInvoicePlanification(numero: string) {
  await requireAdmin();
  await prisma.invoicePlanification.deleteMany({ where: { numero } });
  revalidatePath(PATH);
}

// ─── Invoice Hold (mettre en attente / réactiver une facture) ────────────────

export async function toggleInvoiceHold(numero: string) {
  await requireAdmin();
  if (!numero) throw new Error("Le numéro de facture est requis");

  const existing = await prisma.invoicePlanification.findUnique({
    where: { numero },
  });

  if (existing) {
    await prisma.invoicePlanification.update({
      where: { numero },
      data: { enAttente: !existing.enAttente },
    });
  } else {
    // Create a planification entry just to hold the invoice
    await prisma.invoicePlanification.create({
      data: { numero, mois: "", enAttente: true },
    });
  }

  revalidatePath(PATH);
}
