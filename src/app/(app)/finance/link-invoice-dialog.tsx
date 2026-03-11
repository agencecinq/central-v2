"use client";

import { useTransition, useState } from "react";
import { X, Search, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatEuro } from "@/lib/budget-calc";
import { linkInvoiceToDeal, unlinkInvoiceFromDeal } from "./actions";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface InvoiceSummary {
  qontoId: string;
  numero: string;
  clientNom: string;
  montantHT: number;
  montantTTC: number;
  status: string;
  dateEmission: string | null;
}

export interface LinkedInvoice {
  id: number;
  qontoInvoiceId: string;
  numero: string;
  clientNom: string;
  montantHT: number;
  dateFacture: string | null;
}

interface SignedDealForDialog {
  id: number;
  titre: string;
  clientName: string;
  montantFinal: number;
  resteAFacturer: number;
  linkedInvoices: LinkedInvoice[];
}

// ─── Link Invoice Dialog ───────────────────────────────────────────────────

export function LinkInvoiceDialog({
  deal,
  allInvoices,
  open,
  onOpenChange,
}: {
  deal: SignedDealForDialog;
  allInvoices: InvoiceSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  // Already linked qonto IDs for this deal
  const linkedIds = new Set(deal.linkedInvoices.map((li) => li.qontoInvoiceId));

  // Filter available invoices (not already linked to this deal)
  const available = allInvoices
    .filter((inv) => !linkedIds.has(inv.qontoId))
    .filter((inv) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        inv.numero.toLowerCase().includes(q) ||
        inv.clientNom.toLowerCase().includes(q) ||
        inv.montantHT.toFixed(2).includes(q)
      );
    });

  function handleLink(invoice: InvoiceSummary) {
    startTransition(async () => {
      await linkInvoiceToDeal(deal.id, {
        qontoInvoiceId: invoice.qontoId,
        numero: invoice.numero,
        clientNom: invoice.clientNom,
        montantHT: invoice.montantHT,
        dateEmission: invoice.dateEmission,
      });
    });
  }

  function handleUnlink(dealFactureId: number) {
    startTransition(async () => {
      await unlinkInvoiceFromDeal(dealFactureId);
    });
  }

  const statusLabels: Record<string, string> = {
    paid: "Payée",
    unpaid: "Impayée",
    pending: "En attente",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Lier des factures — {deal.titre}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {deal.clientName} · Signé {formatEuro(deal.montantFinal)} · Reste{" "}
            {formatEuro(deal.resteAFacturer)}
          </p>
        </DialogHeader>

        {/* Already linked invoices */}
        {deal.linkedInvoices.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Factures liées</p>
            <div className="space-y-1">
              {deal.linkedInvoices.map((li) => (
                <div
                  key={li.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Link2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-mono text-xs">{li.numero}</span>
                    <span className="text-muted-foreground truncate">
                      {li.clientNom}
                    </span>
                    <span className="font-medium">
                      {formatEuro(li.montantHT)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleUnlink(li.id)}
                    disabled={isPending}
                    title="Délier"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une facture (n°, client, montant)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Available invoices list */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {search ? "Aucune facture trouvée" : "Toutes les factures sont déjà liées"}
            </p>
          ) : (
            <div className="space-y-1">
              {available.map((inv) => (
                <button
                  key={inv.qontoId}
                  onClick={() => handleLink(inv)}
                  disabled={isPending}
                  className="w-full flex items-center justify-between rounded-md border px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs shrink-0">
                      {inv.numero}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {inv.clientNom}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        inv.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {statusLabels[inv.status] ?? inv.status}
                    </span>
                    <span className="font-medium">
                      {formatEuro(inv.montantHT)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Unlink Button (inline in table) ───────────────────────────────────────

export function UnlinkButton({
  dealFactureId,
}: {
  dealFactureId: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      disabled={isPending}
      title="Délier cette facture"
      onClick={() => {
        startTransition(async () => {
          await unlinkInvoiceFromDeal(dealFactureId);
        });
      }}
    >
      <Unlink className="h-3.5 w-3.5" />
    </Button>
  );
}
