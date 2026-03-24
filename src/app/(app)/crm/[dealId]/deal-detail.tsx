"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  FileText,
  Link2,
} from "lucide-react";
import { DeleteDialog } from "../delete-dialog";
import { deleteBudget, duplicateBudget, updateClientQontoId } from "./actions";
import type { QontoClient } from "@/lib/qonto";

interface DealData {
  id: number;
  titre: string;
  clientId: number;
  clientName: string;
  clientEmail: string;
  qontoClientId: string | null;
  qontoQuoteId: string | null;
  montantEstime: number;
  montantFinal: number | null;
  etape: string;
  dateSignature: string | null;
  createdAt: string | null;
}

interface BudgetData {
  id: number;
  nom: string | null;
  montantTotal: number;
  remiseGlobale: number;
  tauxTva: number;
  createdAt: string | null;
  updatedAt: string | null;
}

const ETAPE_COLORS: Record<string, string> = {
  Prospect: "bg-blue-100 text-blue-700",
  Qualification: "bg-amber-100 text-amber-700",
  Proposition: "bg-violet-100 text-violet-700",
  Gagné: "bg-emerald-100 text-emerald-700",
  Perdu: "bg-red-100 text-red-700",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DealDetail({
  deal,
  budgets,
  qontoClients,
}: {
  deal: DealData;
  budgets: BudgetData[];
  qontoClients: QontoClient[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<number | null>(null);
  const [deletingBudgetName, setDeletingBudgetName] = useState("");

  function handleQontoLinkChange(value: string) {
    startTransition(async () => {
      await updateClientQontoId(deal.clientId, value === "none" ? null : value);
      router.refresh();
    });
  }

  function openDeleteBudget(budget: BudgetData) {
    setDeletingBudgetId(budget.id);
    setDeletingBudgetName(budget.nom || "Sans nom");
    setDeleteOpen(true);
  }

  async function handleDuplicate(budgetId: number) {
    const newBudgetId = await duplicateBudget(budgetId, deal.id);
    router.push(`/crm/${deal.id}/budget/${newBudgetId}`);
  }

  return (
    <div className="space-y-6">
      {/* Deal header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {deal.titre}
            </h1>
            <Badge
              className={ETAPE_COLORS[deal.etape] ?? "bg-gray-100 text-gray-700"}
            >
              {deal.etape}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            {deal.clientName} · {deal.clientEmail}
          </p>
          {/* Qonto client linking */}
          <div className="mt-2 flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Qonto :</span>
            {qontoClients.length > 0 ? (
              <Select
                value={deal.qontoClientId ?? "none"}
                onValueChange={(v) => handleQontoLinkChange(v ?? "none")}
              >
                <SelectTrigger
                  className={`h-7 w-[220px] text-xs ${deal.qontoClientId ? "border-emerald-300 text-emerald-700" : ""}`}
                  disabled={isPending}
                >
                  {deal.qontoClientId
                    ? qontoClients.find((c) => c.id === deal.qontoClientId)?.name ?? "Client inconnu"
                    : "Non lié"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non lié</SelectItem>
                  {qontoClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs text-muted-foreground">Qonto non configuré</span>
            )}
          </div>
        </div>
      </div>

      {/* Deal info cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Montant estimé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(deal.montantEstime)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Montant final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {deal.montantFinal != null
                ? formatCurrency(deal.montantFinal)
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Date de signature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatDate(deal.dateSignature)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Créé le
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatDate(deal.createdAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budgets / Propositions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Propositions commerciales
            {budgets.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({budgets.length})
              </span>
            )}
          </h2>
          <Button render={<Link href={`/crm/${deal.id}/budget/new`} />}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau budget
          </Button>
        </div>

        {budgets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Aucune proposition commerciale pour ce deal.
              </p>
              <Button render={<Link href={`/crm/${deal.id}/budget/new`} />} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Créer un budget
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Nom</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Montant HT
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Remise
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">TVA</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Dernière modif.
                  </th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => (
                  <tr
                    key={budget.id}
                    className="group border-b last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/crm/${deal.id}/budget/${budget.id}`}
                        className="hover:underline"
                      >
                        {budget.nom || "Sans nom"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(budget.montantTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {budget.remiseGlobale > 0
                        ? `${budget.remiseGlobale}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{budget.tauxTva}%</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatDate(budget.updatedAt || budget.createdAt)}
                    </td>
                    <td className="px-2 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          }
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            render={
                              <Link
                                href={`/crm/${deal.id}/budget/${budget.id}`}
                              />
                            }
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(budget.id)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteBudget(budget)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete budget dialog */}
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer la proposition"
        description={`Êtes-vous sûr de vouloir supprimer « ${deletingBudgetName} » ? Toutes les sections et sous-sections associées seront supprimées. Cette action est irréversible.`}
        onConfirm={async () => {
          if (deletingBudgetId) {
            await deleteBudget(deletingBudgetId, deal.id);
          }
        }}
      />
    </div>
  );
}
