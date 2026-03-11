"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";

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
