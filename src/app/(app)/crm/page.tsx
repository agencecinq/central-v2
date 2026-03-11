import { prisma } from "@/lib/prisma";
import { SalesPipeline } from "./sales-pipeline";

export default async function CrmPage() {
  const [deals, clients] = await Promise.all([
    prisma.deal.findMany({
      include: { client: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      orderBy: { nom: "asc" },
    }),
  ]);

  const serializedDeals = deals.map((d) => ({
    id: d.id,
    titre: d.titre,
    clientId: d.clientId,
    clientName: d.client.entreprise || d.client.nom,
    montantEstime: Number(d.montantEstime),
    etape: d.etape,
    montantFinal: d.montantFinal ? Number(d.montantFinal) : null,
    dateSignature: d.dateSignature?.toISOString() ?? null,
    createdAt: d.createdAt?.toISOString() ?? null,
  }));

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.entreprise || c.nom,
  }));

  return <SalesPipeline deals={serializedDeals} clients={clientOptions} />;
}
