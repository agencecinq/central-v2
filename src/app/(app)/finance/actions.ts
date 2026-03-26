"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { getAllInvoices } from "@/lib/qonto";

async function requireAdmin() {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    throw new Error("Accès refusé");
  }
}

interface InvoiceData {
  qontoInvoiceId: string;
  numero: string;
  clientNom: string;
  montantHT: number;
  dateEmission: string | null;
}

export async function linkInvoiceToDeal(dealId: number, invoice: InvoiceData) {
  await requireAdmin();
  if (!dealId || !invoice.qontoInvoiceId) {
    throw new Error("Deal et facture requis");
  }

  await prisma.dealFacture.create({
    data: {
      dealId,
      qontoInvoiceId: invoice.qontoInvoiceId,
      numero: invoice.numero,
      clientNom: invoice.clientNom,
      montantHT: invoice.montantHT,
      dateFacture: invoice.dateEmission ? new Date(invoice.dateEmission) : null,
    },
  });

  revalidatePath("/finance");
}

export async function unlinkInvoiceFromDeal(dealFactureId: number) {
  await requireAdmin();
  if (!dealFactureId) throw new Error("ID requis");

  await prisma.dealFacture.delete({ where: { id: dealFactureId } });

  revalidatePath("/finance");
}

/**
 * Force-sync all DealFacture montantHT from current Qonto invoice data.
 * Returns the number of updated records.
 */
export async function syncDealFacturesFromQonto(): Promise<{
  updated: number;
  total: number;
}> {
  await requireAdmin();

  const [dealFactures, qontoInvoices] = await Promise.all([
    prisma.dealFacture.findMany(),
    getAllInvoices(),
  ]);

  // Build a lookup: qontoId → { montantHT, montantTTC }
  const qontoMap = new Map<string, { montantHT: number }>();
  for (const inv of qontoInvoices) {
    qontoMap.set(inv.qontoId, { montantHT: inv.montantHT });
  }

  let updated = 0;
  for (const df of dealFactures) {
    const qonto = qontoMap.get(df.qontoInvoiceId);
    if (!qonto) continue;

    const currentHT = Number(df.montantHT);
    if (Math.abs(currentHT - qonto.montantHT) > 0.01) {
      await prisma.dealFacture.update({
        where: { id: df.id },
        data: { montantHT: qonto.montantHT },
      });
      updated++;
    }
  }

  revalidatePath("/finance");
  return { updated, total: dealFactures.length };
}
