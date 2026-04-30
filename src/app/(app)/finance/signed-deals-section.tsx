"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Link2, FileText } from "lucide-react";
import { formatEuro } from "@/lib/budget-calc";
import {
  LinkInvoiceDialog,
  UnlinkButton,
  type InvoiceSummary,
  type LinkedInvoice,
} from "./link-invoice-dialog";

interface SignedDeal {
  id: number;
  titre: string;
  clientName: string;
  montantFinal: number;
  resteAFacturer: number;
  totalFacture: number;
  dateSignature: string | null;
  linkedInvoices: LinkedInvoice[];
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SignedDealsSection({
  signedDeals,
  allInvoices,
  allLinkedQontoIds,
}: {
  signedDeals: SignedDeal[];
  allInvoices: InvoiceSummary[];
  allLinkedQontoIds: string[];
}) {
  const [dialogDeal, setDialogDeal] = useState<SignedDeal | null>(null);

  const globalLinkedSet = new Set(allLinkedQontoIds);
  const availableInvoices = allInvoices.filter(
    (inv) => !globalLinkedSet.has(inv.qontoId),
  );

  const totalReste = signedDeals.reduce((s, d) => s + d.resteAFacturer, 0);
  const totalSigne = signedDeals.reduce((s, d) => s + d.montantFinal, 0);
  const totalFact = signedDeals.reduce((s, d) => s + d.totalFacture, 0);
  const cols = "1.6fr 1fr 130px 130px 130px 130px 32px";

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
        <FileText className="h-3.5 w-3.5" style={{ color: "var(--rail-info)" }} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">Signé non facturé</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: "var(--rail-muted)" }}>
            {signedDeals.length} deal{signedDeals.length > 1 ? "s" : ""} ·{" "}
            {formatEuro(totalReste)} restant à facturer
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-[13px] font-semibold"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {formatEuro(totalReste)}
          </div>
          <div
            className="text-[11px] mt-0.5"
            style={{ fontFamily: "var(--font-mono)", color: "var(--rail-muted)" }}
          >
            {formatEuro(totalFact)} / {formatEuro(totalSigne)}
          </div>
        </div>
      </header>

      <div>
        {/* Header row */}
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
          <span>Deal</span>
          <span>Client</span>
          <span className="text-right">Montant signé</span>
          <span className="text-right">Facturé</span>
          <span className="text-right">Reste</span>
          <span>Signé le</span>
          <span />
        </div>

        {signedDeals.map((deal, i) => (
          <DealBlock
            key={deal.id}
            deal={deal}
            cols={cols}
            isFirst={i === 0}
            onOpenDialog={() => setDialogDeal(deal)}
          />
        ))}
      </div>

      {dialogDeal && (
        <LinkInvoiceDialog
          deal={dialogDeal}
          allInvoices={availableInvoices}
          open={true}
          onOpenChange={(open) => {
            if (!open) setDialogDeal(null);
          }}
        />
      )}
    </section>
  );
}

function DealBlock({
  deal,
  cols,
  isFirst,
  onOpenDialog,
}: {
  deal: SignedDeal;
  cols: string;
  isFirst: boolean;
  onOpenDialog: () => void;
}) {
  return (
    <>
      <div
        className="group grid gap-3 items-center text-[13px]"
        style={{
          gridTemplateColumns: cols,
          padding: "12px 18px",
          borderTop: isFirst ? "none" : "1px solid var(--rail-hair2)",
        }}
      >
        <Link
          href={`/crm/${deal.id}`}
          className="font-medium hover:underline whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {deal.titre}
        </Link>
        <span
          className="whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ color: "var(--rail-ink2)" }}
        >
          {deal.clientName}
        </span>
        <span
          className="text-right text-[12px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--rail-muted)",
          }}
        >
          {formatEuro(deal.montantFinal)}
        </span>
        <span
          className="text-right text-[12px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--rail-muted)",
          }}
        >
          {deal.totalFacture > 0 ? formatEuro(deal.totalFacture) : "—"}
        </span>
        <span
          className="text-right font-medium"
          style={{
            fontFamily: "var(--font-mono)",
            color: deal.resteAFacturer > 0 ? "var(--rail-warn)" : "var(--rail-success)",
          }}
        >
          {formatEuro(deal.resteAFacturer)}
        </span>
        <span className="text-[12px]" style={{ color: "var(--rail-muted)" }}>
          {fmtShortDate(deal.dateSignature)}
        </span>
        <button
          onClick={onOpenDialog}
          className="h-7 w-7 grid place-items-center rounded transition-colors hover:bg-[var(--rail-hair2)]"
          title="Lier une facture"
        >
          <Plus className="h-3.5 w-3.5" style={{ color: "var(--rail-muted)" }} />
        </button>
      </div>

      {/* Linked invoices sub-rows */}
      {deal.linkedInvoices.map((li) => (
        <div
          key={li.id}
          className="grid gap-3 items-center text-[12px]"
          style={{
            gridTemplateColumns: cols,
            padding: "8px 18px 8px 36px",
            borderTop: "1px solid var(--rail-hair2)",
            background: "var(--rail-hair3)",
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Link2
              className="h-3 w-3 shrink-0"
              style={{ color: "var(--rail-muted2)" }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--rail-ink2)",
              }}
            >
              {li.numero}
            </span>
          </span>
          <span style={{ color: "var(--rail-muted)" }}>{li.clientNom}</span>
          <span />
          <span
            className="text-right font-medium"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {formatEuro(li.montantHT)}
          </span>
          <span />
          <span style={{ color: "var(--rail-muted)" }}>
            {fmtShortDate(li.dateFacture)}
          </span>
          <UnlinkButton dealFactureId={li.id} />
        </div>
      ))}
    </>
  );
}
