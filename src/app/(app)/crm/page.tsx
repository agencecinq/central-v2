import { prisma } from "@/lib/prisma";
import { SalesPipeline } from "./sales-pipeline";
import { SignedRevenueTable } from "./signed-revenue-table";
import { RailPageHeader, RailPageBody } from "@/components/rail/page-header";

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

  const wonDeals = serializedDeals.filter((d) => d.etape === "Gagné").length;
  const activeDeals = serializedDeals.filter((d) => d.etape !== "Gagné" && d.etape !== "Perdu").length;

  return (
    <>
      <RailPageHeader
        eyebrow="Pipeline commercial"
        title="CRM"
        description={`${activeDeals} deal${activeDeals > 1 ? "s" : ""} actif${activeDeals > 1 ? "s" : ""} · ${wonDeals} signé${wonDeals > 1 ? "s" : ""}`}
      />
      <RailPageBody className="space-y-6">
        <SignedRevenueTable deals={serializedDeals} />
        <SalesPipeline deals={serializedDeals} clients={clientOptions} />
      </RailPageBody>
    </>
  );
}
