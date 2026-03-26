/**
 * Qonto API service.
 * Port of the V1 Laravel QontoService.php to TypeScript.
 *
 * API docs: https://api-doc.qonto.com
 * Base URL: https://thirdparty.qonto.com/v2
 * Auth: Authorization header with format "login:secret-key"
 */

const BASE_URL = "https://thirdparty.qonto.com/v2";

function getCredentials() {
  const login = process.env.QONTO_LOGIN;
  const secretKey = process.env.QONTO_SECRET_KEY;
  if (!login || !secretKey) {
    throw new Error(
      "Qonto credentials missing. Set QONTO_LOGIN and QONTO_SECRET_KEY in .env.local",
    );
  }
  return { login, secretKey };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QontoBankAccount {
  id: string;
  iban: string;
  bic: string;
  balance: number;
  balance_cents: number;
  authorized_balance: number;
  authorized_balance_cents: number;
  currency: string;
  name: string;
  status: string;
  slug: string;
}

export interface QontoOrganization {
  slug: string;
  legal_name: string;
  bank_accounts: QontoBankAccount[];
}

export interface QontoClientInvoice {
  id: string;
  number: string;
  status: string; // "unpaid" | "paid" | "cancelled" | "draft" | ...
  total_amount_cents: number;
  vat_amount_cents: number;
  due_date: string | null;
  issue_date: string | null;
  payment_date: string | null; // date de paiement effectif
  currency: string;
  client: { name: string } | null;
  invoice_url: string | null;
}

export interface PendingInvoice {
  qontoId: string;
  numero: string;
  clientNom: string;
  montantHT: number;
  montantTTC: number;
  dateEcheance: string;
  dateEmission: string | null;
  joursRetard: number;
  invoiceUrl: string | null;
}

// ─── VAT helper ──────────────────────────────────────────────────────────────
// On balance invoices (factures de solde), Qonto returns total_amount_cents as
// the amount due (after deposit deduction) but vat_amount_cents as the FULL
// invoice VAT. This makes HT = total - vat incorrect.
// Fix: cap VAT to the maximum plausible amount for the given total (20% rate).
function computeHT(totalAmountCents: number, vatAmountCents: number): number {
  // Max VAT that could apply to totalAmountCents at 20%
  const maxVatCents = Math.round((totalAmountCents * 0.2) / 1.2);
  const adjustedVatCents = Math.min(vatAmountCents, maxVatCents);
  return (totalAmountCents - adjustedVatCents) / 100;
}

// ─── Low-level fetch ─────────────────────────────────────────────────────────

async function qontoFetch<T>(
  endpoint: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const { login, secretKey } = getCredentials();

  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `${login}:${secretKey}`,
    },
    signal: AbortSignal.timeout(10_000),
    // No caching — fresh data each request
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Qonto API ${response.status} on ${endpoint}: ${body.slice(0, 200)}`,
    );
  }

  return response.json() as Promise<T>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get the organization info including bank accounts. */
export async function getOrganization(): Promise<QontoOrganization> {
  const data = await qontoFetch<{ organization: QontoOrganization }>(
    "/organization",
  );
  return data.organization;
}

/** Get all bank accounts. */
export async function getBankAccounts(): Promise<QontoBankAccount[]> {
  const org = await getOrganization();
  return org.bank_accounts ?? [];
}

/**
 * Get total balance across all accounts.
 * Note: Qonto returns balance in euros (not cents) for bank accounts.
 */
export async function getTotalBalance(): Promise<number> {
  const accounts = await getBankAccounts();
  return accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);
}

// ─── Transactions ────────────────────────────────────────────────────────────

interface QontoTransaction {
  id: string;
  amount: number; // en euros
  side: "credit" | "debit";
  settled_at: string | null;
  emitted_at: string | null;
  status: string;
}

export interface YearlyTransactionTotals {
  encaisse: number; // total crédits (entrées)
  depense: number;  // total débits (sorties)
}

/**
 * Get yearly credit/debit totals from bank transactions.
 * Uses settled_at (or emitted_at as fallback) for date filtering.
 */
export async function getYearlyTransactionTotals(
  year: number,
): Promise<YearlyTransactionTotals> {
  const accounts = await getBankAccounts();
  if (accounts.length === 0) return { encaisse: 0, depense: 0 };

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  let encaisse = 0;
  let depense = 0;

  for (const account of accounts) {
    let currentPage = 1;
    let totalPages = 1;

    do {
      const data = await qontoFetch<{
        transactions: QontoTransaction[];
        meta: { total_pages: number; current_page: number };
      }>("/transactions", {
        bank_account_id: account.id,
        started_at: startDate,
        ended_at: endDate,
        current_page: currentPage,
        per_page: 100,
      });

      for (const tx of data.transactions) {
        if (tx.side === "credit") {
          encaisse += tx.amount;
        } else if (tx.side === "debit") {
          depense += tx.amount;
        }
      }

      totalPages = data.meta?.total_pages ?? 1;
      currentPage++;
    } while (currentPage <= totalPages);
  }

  return { encaisse, depense };
}

/**
 * Get all unpaid client invoices from Qonto (paginated).
 * Amounts are in cents in the API, converted to euros here.
 */
export async function getPendingInvoices(): Promise<PendingInvoice[]> {
  const allInvoices: QontoClientInvoice[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const data = await qontoFetch<{
      client_invoices: QontoClientInvoice[];
      meta: { total_pages: number; current_page: number; total_count: number };
    }>("/client_invoices", {
      current_page: currentPage,
      per_page: 100,
    });

    allInvoices.push(...data.client_invoices);
    totalPages = data.meta?.total_pages ?? 1;
    currentPage++;
  } while (currentPage <= totalPages);

  // Filter unpaid and format
  const today = new Date();

  return allInvoices
    .filter((inv) => inv.status === "unpaid")
    .filter((inv) => inv.due_date) // must have a due date
    .map((inv) => {
      const totalAmountCents = inv.total_amount_cents ?? 0;
      const vatAmountCents = inv.vat_amount_cents ?? 0;
      const montantHT = computeHT(totalAmountCents, vatAmountCents);
      const montantTTC = totalAmountCents / 100;

      const dueDate = new Date(inv.due_date!);
      const diffMs = today.getTime() - dueDate.getTime();
      const joursRetard = Math.max(
        0,
        Math.floor(diffMs / (1000 * 60 * 60 * 24)),
      );

      return {
        qontoId: inv.id,
        numero: inv.number || "N/A",
        clientNom: inv.client?.name || "N/A",
        montantHT,
        montantTTC,
        dateEcheance: inv.due_date!,
        dateEmission: inv.issue_date,
        datePaiement: inv.payment_date ?? null,
        joursRetard,
        invoiceUrl: inv.invoice_url,
      };
    })
    .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance));
}

/** Get total HT amount of all pending invoices. */
export async function getTotalPendingAmount(): Promise<number> {
  const invoices = await getPendingInvoices();
  return invoices.reduce((sum, inv) => sum + inv.montantHT, 0);
}

// ─── All invoices (for linking to deals) ────────────────────────────────────

export interface QontoInvoiceSummary {
  qontoId: string;
  numero: string;
  clientNom: string;
  montantHT: number;
  montantTTC: number;
  status: string;
  dateEmission: string | null;
  datePaiement: string | null;
}

/**
 * Get ALL client invoices from Qonto (paid + unpaid), paginated.
 * Used to link invoices to deals.
 */
export async function getAllInvoices(): Promise<QontoInvoiceSummary[]> {
  const allInvoices: QontoClientInvoice[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const data = await qontoFetch<{
      client_invoices: QontoClientInvoice[];
      meta: { total_pages: number; current_page: number; total_count: number };
    }>("/client_invoices", {
      current_page: currentPage,
      per_page: 100,
    });

    allInvoices.push(...data.client_invoices);
    totalPages = data.meta?.total_pages ?? 1;
    currentPage++;
  } while (currentPage <= totalPages);

  return allInvoices
    .filter((inv) => inv.status !== "draft" && inv.status !== "cancelled")
    .map((inv) => {
      const totalAmountCents = inv.total_amount_cents ?? 0;
      const vatAmountCents = inv.vat_amount_cents ?? 0;

      return {
        qontoId: inv.id,
        numero: inv.number || "N/A",
        clientNom: inv.client?.name || "N/A",
        montantHT: computeHT(totalAmountCents, vatAmountCents),
        montantTTC: totalAmountCents / 100,
        status: inv.status,
        dateEmission: inv.issue_date,
        datePaiement: inv.payment_date ?? null,
      };
    })
    .sort((a, b) => (b.dateEmission ?? "").localeCompare(a.dateEmission ?? ""));
}

// ─── Qonto write helpers ─────────────────────────────────────────────────────

async function qontoWrite<T>(
  method: "POST" | "PUT",
  endpoint: string,
  body: unknown,
): Promise<T> {
  const { login, secretKey } = getCredentials();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `${login}:${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Qonto API ${response.status} ${method} ${endpoint}: ${text.slice(0, 300)}`,
    );
  }

  return response.json() as Promise<T>;
}

// ─── Qonto Clients ──────────────────────────────────────────────────────────

export interface QontoClient {
  id: string;
  name: string;
  email: string | null;
}

export async function getQontoClients(): Promise<QontoClient[]> {
  const allClients: { id: string; name: string; email?: string }[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const data = await qontoFetch<{
      clients: { id: string; name: string; email?: string }[];
      meta: { total_pages: number; current_page: number };
    }>("/clients", { current_page: currentPage, per_page: 100 });

    allClients.push(...data.clients);
    totalPages = data.meta?.total_pages ?? 1;
    currentPage++;
  } while (currentPage <= totalPages);

  return allClients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email ?? null,
  }));
}

// ─── Qonto Quotes ───────────────────────────────────────────────────────────

export interface QontoQuoteItem {
  title: string;
  description?: string;
  quantity: string;
  unit_price: { value: string; currency: string };
  vat_rate: string;
  discount?: { type: "percentage"; value: string };
}

export interface QontoQuotePayload {
  client_id: string;
  issue_date: string;
  expiry_date: string;
  terms_and_conditions?: string;
  currency: string;
  items: QontoQuoteItem[];
  discount?: { type: "percentage"; value: string };
}

export async function createQuote(
  data: QontoQuotePayload,
): Promise<{ id: string; number: string }> {
  const result = await qontoWrite<{ quote: { id: string; number: string } }>(
    "POST",
    "/quotes",
    data,
  );
  return result.quote;
}

export async function updateQuote(
  quoteId: string,
  data: QontoQuotePayload,
): Promise<{ id: string; number: string }> {
  const result = await qontoWrite<{ quote: { id: string; number: string } }>(
    "PUT",
    `/quotes/${quoteId}`,
    data,
  );
  return result.quote;
}
