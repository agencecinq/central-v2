import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileWarning,
  AlertCircle,
  FileText,
  TrendingUp,
  Link2,
} from "lucide-react";
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
import { SyncButton } from "./sync-button";
import { RailPageHeader, RailPageBody } from "@/components/rail/page-header";

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
  allLinkedQontoIds: string[];
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
  const allLinkedQontoIdsList = deals.flatMap((d) =>
    d.dealFactures.map((df) => df.qontoInvoiceId),
  );
  const linkedQontoIds = new Set(allLinkedQontoIdsList);
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
    allLinkedQontoIds: allLinkedQontoIdsList,
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
    allLinkedQontoIds,
    unlinkedInvoices,
    qontoError,
  } = await getFinanceData();

  return (
    <>
      <RailPageHeader
        eyebrow="Trésorerie · Facturation"
        title="Finance"
        description={
          balance !== null
            ? `Solde ${formatEuro(balance)} · ${signedDeals.length} deals signés`
            : "Synthèse financière de l'agence"
        }
        actions={
          <>
            <SyncButton />
            <Link
              href="/finance/previsionnel"
              className="inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-medium bg-white"
              style={{
                padding: "7px 12px",
                border: "1px solid var(--rail-hair)",
              }}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Prévisionnel
            </Link>
          </>
        }
      />
      <RailPageBody className="space-y-8">

      {/* Qonto error banner — Rail v2 */}
      {qontoError && (
        <div
          className="flex items-center gap-3"
          style={{
            padding: "12px 16px",
            background: "var(--rail-danger-bg)",
            border: "1px solid var(--rail-danger)",
            borderRadius: 8,
          }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--rail-danger)" }} />
          <p className="text-[13px]" style={{ color: "var(--rail-danger)" }}>
            {qontoError}
          </p>
        </div>
      )}

      {/* KPI strip — Rail v2 (4 cards with sparklines) */}
      <FinanceKpiStrip
        balance={balance}
        totalPending={totalPending}
        pendingCount={pendingInvoices.length}
        totalResteAFacturer={totalResteAFacturer}
        signedDealsCount={signedDeals.length}
        signedDeals={signedDeals}
        allInvoices={allInvoices}
        qontoError={qontoError !== null}
      />

      {/* Signed but not invoiced deals */}
      {signedDeals.length > 0 && (
        <SignedDealsSection
          signedDeals={signedDeals}
          allInvoices={allInvoices}
          allLinkedQontoIds={allLinkedQontoIds}
        />
      )}

      {/* Pending Qonto invoices — Rail v2 panel */}
      {!qontoError && pendingInvoices.length > 0 && (
        <RailFinancePanel
          title="Factures en attente"
          sub={`${pendingInvoices.length} facture${pendingInvoices.length > 1 ? "s" : ""} · ${formatEuro(totalPending)} TTC`}
          icon={<FileWarning className="h-3.5 w-3.5" style={{ color: "var(--rail-warn)" }} />}
        >
          <FinanceTable
            cols="120px 1fr 130px 130px 130px 80px"
            headers={["N°", "Client", "Montant HT", "Montant TTC", "Échéance", "Retard"]}
            rightAligned={[2, 3]}
            rows={pendingInvoices.map((inv) => ({
              key: inv.qontoId,
              cells: [
                <span
                  key="numero"
                  className="text-[11.5px] inline-flex items-center gap-1.5"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--rail-ink2)" }}
                >
                  <Link2 className="h-3 w-3" style={{ color: "var(--rail-muted2)" }} />
                  {inv.numero}
                </span>,
                <span key="client" style={{ color: "var(--rail-ink2)" }}>
                  {inv.clientNom}
                </span>,
                <span key="ht" className="text-right font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {formatEuro(inv.montantHT)}
                </span>,
                <span
                  key="ttc"
                  className="text-right text-[12px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--rail-muted)" }}
                >
                  {formatEuro(inv.montantTTC)}
                </span>,
                <span
                  key="ech"
                  className="text-[12px]"
                  style={{ color: "var(--rail-muted)" }}
                >
                  {new Date(inv.dateEcheance).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>,
                inv.joursRetard > 0 ? (
                  <span
                    key="retard"
                    className="text-[10.5px] font-medium uppercase"
                    style={{
                      padding: "2px 7px",
                      background: "var(--rail-danger-bg)",
                      color: "var(--rail-danger)",
                      borderRadius: 3,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {inv.joursRetard} j
                  </span>
                ) : (
                  <span key="retard" className="text-[11px]" style={{ color: "var(--rail-muted)" }}>
                    À jour
                  </span>
                ),
              ],
            }))}
          />
        </RailFinancePanel>
      )}

      {/* Unlinked invoices — Rail v2 panel */}
      {!qontoError && unlinkedInvoices.length > 0 && (
        <RailFinancePanel
          title="Factures non affectées à un deal"
          sub={`${unlinkedInvoices.length} facture${unlinkedInvoices.length > 1 ? "s" : ""}`}
          icon={<FileText className="h-3.5 w-3.5" style={{ color: "var(--rail-muted)" }} />}
        >
          <FinanceTable
            cols="120px 1fr 130px 130px 130px 100px"
            headers={["N°", "Client", "Montant HT", "Montant TTC", "Émission", "Statut"]}
            rightAligned={[2, 3]}
            rows={unlinkedInvoices.map((inv) => ({
              key: inv.qontoId,
              cells: [
                <span
                  key="numero"
                  className="text-[11.5px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--rail-ink2)" }}
                >
                  {inv.numero}
                </span>,
                <span key="client" style={{ color: "var(--rail-ink2)" }}>
                  {inv.clientNom}
                </span>,
                <span key="ht" className="text-right font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {formatEuro(inv.montantHT)}
                </span>,
                <span
                  key="ttc"
                  className="text-right text-[12px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--rail-muted)" }}
                >
                  {formatEuro(inv.montantTTC)}
                </span>,
                <span
                  key="emission"
                  className="text-[12px]"
                  style={{ color: "var(--rail-muted)" }}
                >
                  {inv.dateEmission
                    ? new Date(inv.dateEmission).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </span>,
                <InvoiceStatusBadge key="status" status={inv.status} />,
              ],
            }))}
          />
        </RailFinancePanel>
      )}
      </RailPageBody>
    </>
  );
}

// ─── Rail v2 Finance components ──────────────────────────

function RailFinancePanel({
  title,
  sub,
  icon,
  children,
}: {
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden"
      style={{
        background: "var(--rail-panel)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 8,
      }}
    >
      <header
        className="flex items-center gap-2"
        style={{
          padding: "12px 18px",
          borderBottom: "1px solid var(--rail-hair)",
        }}
      >
        {icon}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          {sub && (
            <div
              className="text-[11.5px] mt-0.5"
              style={{ color: "var(--rail-muted)" }}
            >
              {sub}
            </div>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

function FinanceTable({
  cols,
  headers,
  rows,
  rightAligned = [],
}: {
  cols: string;
  headers: string[];
  rows: { key: string; cells: React.ReactNode[] }[];
  rightAligned?: number[];
}) {
  return (
    <div>
      <div
        className="grid gap-3 text-[10.5px] uppercase"
        style={{
          gridTemplateColumns: cols,
          padding: "8px 18px",
          letterSpacing: "0.08em",
          color: "var(--rail-muted)",
          background: "var(--rail-hair3)",
          borderBottom: "1px solid var(--rail-hair2)",
        }}
      >
        {headers.map((h, i) => (
          <span key={i} className={rightAligned.includes(i) ? "text-right" : ""}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={row.key}
          className="grid gap-3 items-center text-[13px]"
          style={{
            gridTemplateColumns: cols,
            padding: "10px 18px",
            borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
          }}
        >
          {row.cells}
        </div>
      ))}
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span
        className="text-[10.5px] font-medium uppercase"
        style={{
          padding: "2px 7px",
          background: "var(--rail-success-bg)",
          color: "var(--rail-success)",
          borderRadius: 3,
          letterSpacing: "0.02em",
        }}
      >
        Payée
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span
        className="text-[10.5px] font-medium uppercase"
        style={{
          padding: "2px 7px",
          background: "var(--rail-warn-bg)",
          color: "var(--rail-warn)",
          borderRadius: 3,
          letterSpacing: "0.02em",
        }}
      >
        En attente
      </span>
    );
  }
  return (
    <span
      className="text-[10.5px] font-medium"
      style={{
        padding: "2px 7px",
        background: "var(--rail-hair2)",
        color: "var(--rail-muted)",
        borderRadius: 3,
      }}
    >
      {status}
    </span>
  );
}

// ─── KPI Strip with sparklines ───────────────────────────

interface KpiStripProps {
  balance: number | null;
  totalPending: number;
  pendingCount: number;
  totalResteAFacturer: number;
  signedDealsCount: number;
  signedDeals: SignedDeal[];
  allInvoices: QontoInvoiceSummary[];
  qontoError: boolean;
}

function FinanceKpiStrip({
  balance,
  totalPending,
  pendingCount,
  totalResteAFacturer,
  signedDealsCount,
  signedDeals,
  allInvoices,
  qontoError,
}: KpiStripProps) {
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // CA année — sum of signedDeals montantFinal in current year
  const caAnnee = signedDeals
    .filter(
      (d) =>
        d.dateSignature &&
        new Date(d.dateSignature).getFullYear() === year,
    )
    .reduce((s, d) => s + d.montantFinal, 0);

  // Encaissé mois — sum of paid invoices this month
  const encaisseMois = allInvoices
    .filter((inv) => {
      if (!inv.dateEmission) return false;
      const d = new Date(inv.dateEmission);
      return (
        d.getFullYear() === year &&
        d.getMonth() === currentMonth &&
        inv.status === "paid"
      );
    })
    .reduce((s, inv) => s + inv.montantHT, 0);

  // Synthetic sparklines based on totals
  const caSpark = generateSparkline(caAnnee, 7);
  const encSpark = generateSparkline(encaisseMois, 7);
  const balSpark = generateSparkline(balance ?? 100000, 7, 0.05);
  const pendSpark = generateSparkline(totalPending, 7, 0.4);

  return (
    <div className="grid grid-cols-4 gap-4">
      <FinanceKpi
        label="CA année"
        value={fmtCompact(caAnnee)}
        sub={`${signedDealsCount} deals signés en ${year}`}
        spark={caSpark}
      />
      <FinanceKpi
        label="Encaissé ce mois"
        value={qontoError ? "—" : fmtCompact(encaisseMois)}
        sub={qontoError ? "Qonto indisponible" : `${formatEuro(encaisseMois)}`}
        spark={encSpark}
      />
      <FinanceKpi
        label="Trésorerie"
        value={balance !== null ? fmtCompact(balance) : "—"}
        sub={qontoError ? "Qonto indisponible" : "Synchronisé via Qonto"}
        spark={balSpark}
      />
      <FinanceKpi
        label="Impayés"
        value={qontoError ? "—" : fmtCompact(totalPending)}
        sub={
          qontoError
            ? "—"
            : pendingCount > 0
              ? `${pendingCount} facture${pendingCount > 1 ? "s" : ""}`
              : "Aucune"
        }
        tone={totalPending > 0 ? "warn" : "default"}
        spark={pendSpark}
      />
      <FinanceKpi
        label="Reste à facturer"
        value={fmtCompact(totalResteAFacturer)}
        sub={`${signedDealsCount} deals concernés`}
        spark={generateSparkline(totalResteAFacturer, 7, 0.2)}
        full
      />
    </div>
  );
}

function FinanceKpi({
  label,
  value,
  sub,
  spark,
  tone,
  full,
}: {
  label: string;
  value: string;
  sub?: string;
  spark: number[];
  tone?: "warn" | "default";
  full?: boolean;
}) {
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const range = max - min || 1;
  const pts = spark
    .map((v, i) => `${(i / (spark.length - 1)) * 100},${100 - ((v - min) / range) * 100}`)
    .join(" ");
  const sparkColor = tone === "warn" ? "var(--rail-warn)" : "var(--b-accent)";
  return (
    <div
      className={full ? "col-span-4 sm:col-span-1" : ""}
      style={{
        background: "var(--rail-panel)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 8,
        padding: "16px 18px 14px",
      }}
    >
      <div
        className="text-[11px] tracking-[0.06em] uppercase mb-2"
        style={{ color: "var(--rail-muted)" }}
      >
        {label}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div
          className="text-[24px] font-semibold tabular leading-tight"
          style={{ letterSpacing: "-0.4px" }}
        >
          {value}
        </div>
        <svg
          width="60"
          height="22"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="opacity-80"
        >
          <polyline
            points={pts}
            fill="none"
            stroke={sparkColor}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--rail-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function fmtCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M€`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k€`;
  return `${n.toFixed(0)}€`;
}

function generateSparkline(target: number, points: number, variance = 0.15): number[] {
  // Generate a synthetic sparkline that tends toward the target
  const result: number[] = [];
  let val = target * 0.6;
  for (let i = 0; i < points - 1; i++) {
    val += (target - val) * 0.2 + (Math.random() - 0.5) * target * variance;
    result.push(Math.max(0, val));
  }
  result.push(target);
  return result;
}
