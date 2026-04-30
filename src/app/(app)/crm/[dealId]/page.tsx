import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getQontoClients, type QontoClient } from "@/lib/qonto";
import { DealDetail } from "./deal-detail";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId: rawId } = await params;
  const dealId = parseInt(rawId);
  if (isNaN(dealId)) notFound();

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      client: true,
      propositions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!deal) notFound();

  // Fetch Qonto clients (best effort — don't block on failure)
  let qontoClients: QontoClient[] = [];
  try {
    qontoClients = await getQontoClients();
  } catch {
    // Qonto not configured or unreachable — that's fine
  }

  const serializedDeal = {
    id: deal.id,
    titre: deal.titre,
    clientId: deal.client.id,
    clientName: deal.client.entreprise || deal.client.nom,
    clientEmail: deal.client.email,
    qontoClientId: deal.client.qontoClientId ?? null,
    qontoQuoteId: deal.qontoQuoteId ?? null,
    montantEstime: Number(deal.montantEstime),
    montantFinal: deal.montantFinal ? Number(deal.montantFinal) : null,
    etape: deal.etape,
    dateSignature: deal.dateSignature?.toISOString() ?? null,
    createdAt: deal.createdAt?.toISOString() ?? null,
  };

  const serializedBudgets = deal.propositions.map((p) => ({
    id: p.id,
    nom: p.nom,
    montantTotal: Number(p.montantTotal),
    remiseGlobale: Number(p.remiseGlobale),
    tauxTva: Number(p.tauxTva),
    createdAt: p.createdAt?.toISOString() ?? null,
    updatedAt: p.updatedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6 px-7 pt-6 pb-12">
      {/* Back link */}
      <Link
        href="/crm"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au CRM
      </Link>

      <DealDetail deal={serializedDeal} budgets={serializedBudgets} qontoClients={qontoClients} />
    </div>
  );
}
