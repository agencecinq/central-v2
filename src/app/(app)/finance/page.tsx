import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Landmark,
  FileWarning,
  AlertCircle,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatEuro } from "@/lib/budget-calc";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import {
  getTotalBalance,
  getPendingInvoices,
  getAllInvoices,
  type PendingInvoice,
  type QontoInvoiceSummary,
} from "@/lib/qonto";
import { SignedDealsSection } from "./signed-deals-section";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SignedDeal {
  id: number;
  titre: string;
  clientName: string;
  montantFinal: number;
  resteAFacturer: number;
  totalFacture: number;
  dateSignature: string | null;
  linkedInvoices: {
    id: number;
    qontoInvoiceId: string;
    numero: string;
    clientNom: string;
    montantHT: number;
    dateFacture: string | null;
  }[];
}

// ─── Data fetching ─────────────────────────────────────────────────────────

interface FinanceData {
  balance: number | null;
  pendingInvoices: PendingInvoice[];
  totalPending: number;
  signedDeals: SignedDeal[];
  totalResteAFacturer: number;
  allInvoices: QontoInvoiceSummary[];
  unlinkedInvoices: QontoInvoiceSummary[];
  qontoError: string | null;
}

async function getFinanceData(): Promise<FinanceData> {
  // Fetch Qonto data (may fail if credentials are missing)
  let balance: number | null = null;
  let pendingInvoices: PendingInvoice[] = [];
  let totalPending = 0;
  let allInvoices: QontoInvoiceSummary[] = [];
  let qontoError: string | null = null;

  try {
    [balance, pendingInvoices, allInvoices] = await Promise.all([
      getTotalBalance(),
      getPendingInvoices(),
      getAllInvoices(),
    ]);
    totalPending = pendingInvoices.reduce(
      (sum, inv) => sum + inv.montantHT,
      0,
    );
  } catch (e) {
    qontoError = e instanceof Error ? e.message : "Erreur Qonto inconnue";
  }

  // Fetch signed deals from local DB with linked invoices
  const deals = await prisma.deal.findMany({
    where: {
      etape: "Gagné",
      montantFinal: { not: null },
    },
    include: { client: true, dealFactures: true },
    orderBy: { dateSignature: "desc" },
  });

  const signedDeals: SignedDeal[] = deals.map((deal) => {
    const montantFinal = Number(deal.montantFinal);

    // Sum linked invoices HT amounts
    const totalFacture = deal.dealFactures.reduce(
      (sum, df) => sum + Number(df.montantHT),
      0,
    );
    const resteAFacturer = Math.max(0, montantFinal - totalFacture);

    const linkedInvoices = deal.dealFactures.map((df) => ({
      id: df.id,
      qontoInvoiceId: df.qontoInvoiceId,
      numero: df.numero,
      clientNom: df.clientNom,
      montantHT: Number(df.montantHT),
      dateFacture: df.dateFacture
        ? df.dateFacture.toISOString().split("T")[0]
        : null,
    }));

    return {
      id: deal.id,
      titre: deal.titre,
      clientName: deal.client.entreprise || deal.client.nom,
      montantFinal,
      resteAFacturer,
      totalFacture,
      dateSignature: deal.dateSignature
        ? deal.dateSignature.toISOString().split("T")[0]
        : null,
      linkedInvoices,
    };
  });

  // Only keep deals with remaining amount > 0
  const dealsWithReste = signedDeals.filter((d) => d.resteAFacturer > 0);
  const totalResteAFacturer = dealsWithReste.reduce(
    (sum, d) => sum + d.resteAFacturer,
    0,
  );

  // Find invoices not linked to any deal
  const linkedQontoIds = new Set(
    deals.flatMap((d) => d.dealFactures.map((df) => df.qontoInvoiceId)),
  );
  const unlinkedInvoices = allInvoices.filter(
    (inv) => !linkedQontoIds.has(inv.qontoId),
  );

  return {
    balance,
    pendingInvoices,
    totalPending,
    signedDeals: dealsWithReste,
    totalResteAFacturer,
    allInvoices,
    unlinkedInvoices,
    qontoError,
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function FinancePage() {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) redirect("/dashboard");

  const {
    balance,
    pendingInvoices,
    totalPending,
    signedDeals,
    totalResteAFacturer,
    allInvoices,
    unlinkedInvoices,
    qontoError,
  } = await getFinanceData();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Finance</h2>
          <p className="mt-1 text-muted-foreground">
            Suivez la trésorerie et la facturation de l&apos;agence.
          </p>
        </div>
        <Link
          href="/finance/previsionnel"
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <TrendingUp className="h-4 w-4" />
          Prévisionnel
        </Link>
      </div>

      {/* Qonto error banner */}
      {qontoError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{qontoError}</p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Solde du compte */}
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Landmark className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Solde du compte</p>
              <p className="text-2xl font-bold tracking-tight">
                {balance !== null ? formatEuro(balance) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Reste à facturer */}
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                Signé non facturé
              </p>
              <p className="text-2xl font-bold tracking-tight">
                {formatEuro(totalResteAFacturer)}
              </p>
              {signedDeals.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {signedDeals.length} deal
                  {signedDeals.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Factures en attente */}
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <FileWarning className="h-6 w-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                Factures en attente
              </p>
              <p className="text-2xl font-bold tracking-tight">
                {qontoError ? "—" : formatEuro(totalPending)}
              </p>
              {!qontoError && pendingInvoices.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pendingInvoices.length} facture
                  {pendingInvoices.length > 1 ? "s" : ""} impayée
                  {pendingInvoices.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signed but not invoiced deals */}
      {signedDeals.length > 0 && (
        <SignedDealsSection
          signedDeals={signedDeals}
          allInvoices={allInvoices}
        />
      )}

      {/* Pending Qonto invoices table */}
      {!qontoError && pendingInvoices.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Factures en attente</h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">N°</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Montant HT
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Montant TTC
                      </th>
                      <th className="px-4 py-3 font-medium">Échéance</th>
                      <th className="px-4 py-3 font-medium">Retard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingInvoices.map((inv) => (
                      <tr key={inv.qontoId} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-mono text-xs">
                          {inv.numero}
                        </td>
                        <td className="px-4 py-3">{inv.clientNom}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatEuro(inv.montantHT)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatEuro(inv.montantTTC)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(inv.dateEcheance).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {inv.joursRetard > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              {inv.joursRetard} j
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              À jour
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
      {/* Unlinked invoices */}
      {!qontoError && unlinkedInvoices.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">
            Factures non affectées à un deal
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({unlinkedInvoices.length})
            </span>
          </h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">N°</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Montant HT
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Montant TTC
                      </th>
                      <th className="px-4 py-3 font-medium">Émission</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {unlinkedInvoices.map((inv) => (
                      <tr key={inv.qontoId} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-mono text-xs">
                          {inv.numero}
                        </td>
                        <td className="px-4 py-3">{inv.clientNom}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatEuro(inv.montantHT)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                          {formatEuro(inv.montantTTC)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {inv.dateEmission
                            ? new Date(inv.dateEmission).toLocaleDateString(
                                "fr-FR",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {inv.status === "paid" ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Payée
                            </span>
                          ) : inv.status === "pending" ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                              En attente
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {inv.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
