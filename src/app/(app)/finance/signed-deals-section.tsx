"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export function SignedDealsSection({
  signedDeals,
  allInvoices,
}: {
  signedDeals: SignedDeal[];
  allInvoices: InvoiceSummary[];
}) {
  const [dialogDeal, setDialogDeal] = useState<SignedDeal | null>(null);

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Signé non facturé</h3>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Deal</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Montant signé
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Facturé
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Reste
                  </th>
                  <th className="px-4 py-3 font-medium">Signé le</th>
                  <th className="px-4 py-3 font-medium w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {signedDeals.map((deal) => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    onOpenDialog={() => setDialogDeal(deal)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Link Invoice Dialog */}
      {dialogDeal && (
        <LinkInvoiceDialog
          deal={dialogDeal}
          allInvoices={allInvoices}
          open={true}
          onOpenChange={(open) => {
            if (!open) setDialogDeal(null);
          }}
        />
      )}
    </section>
  );
}

function DealRow({
  deal,
  onOpenDialog,
}: {
  deal: SignedDeal;
  onOpenDialog: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-muted/50">
        <td className="px-4 py-3">
          <Link
            href={`/crm/${deal.id}`}
            className="text-primary hover:underline font-medium"
          >
            {deal.titre}
          </Link>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{deal.clientName}</td>
        <td className="px-4 py-3 text-right text-muted-foreground">
          {formatEuro(deal.montantFinal)}
        </td>
        <td className="px-4 py-3 text-right text-muted-foreground">
          {deal.totalFacture > 0 ? formatEuro(deal.totalFacture) : "—"}
        </td>
        <td className="px-4 py-3 text-right font-medium">
          {formatEuro(deal.resteAFacturer)}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {deal.dateSignature
            ? new Date(deal.dateSignature).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—"}
        </td>
        <td className="px-4 py-3">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onOpenDialog}
            title="Lier une facture"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </td>
      </tr>

      {/* Show linked invoices as sub-rows */}
      {deal.linkedInvoices.map((li) => (
        <tr key={li.id} className="bg-muted/30">
          <td className="px-4 py-2 pl-8" colSpan={2}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="font-mono">{li.numero}</span>
              <span>— {li.clientNom}</span>
            </div>
          </td>
          <td className="px-4 py-2" />
          <td className="px-4 py-2 text-right text-xs font-medium">
            {formatEuro(li.montantHT)}
          </td>
          <td className="px-4 py-2" />
          <td className="px-4 py-2 text-xs text-muted-foreground">
            {li.dateFacture
              ? new Date(li.dateFacture).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : ""}
          </td>
          <td className="px-4 py-2">
            <UnlinkButton dealFactureId={li.id} />
          </td>
        </tr>
      ))}
    </>
  );
}
