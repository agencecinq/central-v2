import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Landmark, Receipt, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatEuro } from "@/lib/budget-calc";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getTotalBalance, getPendingInvoices } from "@/lib/qonto";
import { ForecastTable } from "./forecast-table";

// ─── Data fetching ──────────────────────────────────────────────────────────

async function getForecastData() {
  let balance: number | null = null;
  let qontoError: string | null = null;

  // Qonto data
  let pendingRaw: Awaited<ReturnType<typeof getPendingInvoices>> = [];
  try {
    [balance, pendingRaw] = await Promise.all([
      getTotalBalance(),
      getPendingInvoices(),
    ]);
  } catch (e) {
    qontoError = e instanceof Error ? e.message : "Erreur Qonto inconnue";
  }

  const pendingInvoices = pendingRaw.map((inv) => ({
    montantHT: inv.montantHT,
    dateEcheance: inv.dateEcheance,
    clientNom: inv.clientNom,
    numero: inv.numero,
  }));

  // Unpaid expenses from all projects
  const transactions = await prisma.transaction.findMany({
    where: {
      type: "depense",
      NOT: { statut: "soldé" },
    },
    select: {
      montant: true,
      montantPaye: true,
      dateTransaction: true,
      label: true,
    },
    orderBy: { dateTransaction: "asc" },
  });

  const unpaidExpenses = transactions.map((tx) => ({
    montant: Number(tx.montant),
    montantPaye: Number(tx.montantPaye),
    dateTransaction: tx.dateTransaction.toISOString(),
    label: tx.label,
  }));

  // Forecast expenses (planned monthly expenses)
  const forecastExpensesRaw = await prisma.forecastExpense.findMany({
    orderBy: [{ categorie: "asc" }, { mois: "asc" }],
  });

  const forecastExpenses = forecastExpensesRaw.map((fe) => ({
    id: fe.id,
    categorie: fe.categorie,
    mois: fe.mois,
    moisFin: fe.moisFin,
    libelle: fe.libelle,
    montant: Number(fe.montant),
  }));

  // Invoice planifications (override encaissement month) + holds
  const invoicePlanificationsRaw =
    await prisma.invoicePlanification.findMany();
  const invoicePlanifications = Object.fromEntries(
    invoicePlanificationsRaw
      .filter((ip) => ip.mois) // only those with a planned month
      .map((ip) => [ip.numero, ip.mois]),
  );
  const invoiceHolds = new Set(
    invoicePlanificationsRaw
      .filter((ip) => ip.enAttente)
      .map((ip) => ip.numero),
  );

  // Signed deals with reste à facturer + planned revenues
  const deals = await prisma.deal.findMany({
    where: {
      etape: "Gagné",
      montantFinal: { not: null },
    },
    include: {
      client: true,
      dealFactures: true,
      dealRevenuPlanifies: true,
    },
  });

  let totalResteAFacturer = 0;
  const dealRevenus: {
    id: number;
    dealId: number;
    mois: string;
    montantHT: number;
  }[] = [];

  const dealsWithReste: {
    id: number;
    titre: string;
    clientName: string;
    montantFinal: number;
    totalFacture: number;
    totalPlanifie: number;
    resteNonPlanifie: number;
  }[] = [];

  for (const deal of deals) {
    const montantFinal = Number(deal.montantFinal);
    const totalFacture = deal.dealFactures.reduce(
      (sum, df) => sum + Number(df.montantHT),
      0,
    );
    const totalPlanifie = deal.dealRevenuPlanifies.reduce(
      (sum, drp) => sum + Number(drp.montantHT),
      0,
    );
    const resteNonPlanifie = Math.max(0, montantFinal - totalFacture - totalPlanifie);
    totalResteAFacturer += resteNonPlanifie;

    // Collect planned revenues by month
    for (const drp of deal.dealRevenuPlanifies) {
      dealRevenus.push({
        id: drp.id,
        dealId: drp.dealId,
        mois: drp.mois,
        montantHT: Number(drp.montantHT),
      });
    }

    // Deals that still have something to invoice (for the dialog)
    const totalReste = Math.max(0, montantFinal - totalFacture);
    if (totalReste > 0) {
      dealsWithReste.push({
        id: deal.id,
        titre: deal.titre,
        clientName: deal.client.entreprise || deal.client.nom,
        montantFinal,
        totalFacture,
        totalPlanifie,
        resteNonPlanifie,
      });
    }
  }

  return {
    balance,
    pendingInvoices,
    unpaidExpenses,
    forecastExpenses,
    dealRevenus,
    dealsWithReste,
    totalResteAFacturer,
    invoicePlanifications,
    invoiceHolds: Array.from(invoiceHolds),
    qontoError,
  };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function PrevisionnelPage() {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) redirect("/dashboard");

  const {
    balance,
    pendingInvoices,
    unpaidExpenses,
    forecastExpenses,
    dealRevenus,
    dealsWithReste,
    totalResteAFacturer,
    invoicePlanifications,
    invoiceHolds,
    qontoError,
  } = await getForecastData();

  const totalAEncaisser = pendingInvoices.reduce(
    (sum, inv) => sum + inv.montantHT,
    0,
  );

  return (
    <div className="space-y-6 px-7 pt-6 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/finance"
          className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Prévisionnel
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Projection de trésorerie sur les 12 prochains mois.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Landmark className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Solde actuel</p>
              <p className="text-2xl font-bold tracking-tight">
                {balance !== null ? formatEuro(balance) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <Receipt className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                Factures à encaisser
              </p>
              <p className="text-2xl font-bold tracking-tight">
                {qontoError ? "—" : formatEuro(totalAEncaisser)}
              </p>
              {!qontoError && pendingInvoices.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pendingInvoices.length} facture
                  {pendingInvoices.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                Reste à facturer
              </p>
              <p className="text-2xl font-bold tracking-tight">
                {formatEuro(totalResteAFacturer)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Non planifié
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Table + Edition sections */}
      <ForecastTable
        balance={balance}
        pendingInvoices={pendingInvoices}
        unpaidExpenses={unpaidExpenses}
        forecastExpenses={forecastExpenses}
        dealRevenus={dealRevenus}
        dealsWithReste={dealsWithReste}
        totalResteAFacturer={totalResteAFacturer}
        invoicePlanifications={invoicePlanifications}
        invoiceHolds={invoiceHolds}
      />
    </div>
  );
}
