"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

const ETAPE_TONES: Record<string, { bg: string; c: string }> = {
  Prospect: { bg: "var(--rail-info-bg)", c: "var(--rail-info)" },
  Qualification: { bg: "var(--rail-warn-bg)", c: "var(--rail-warn)" },
  Proposition: { bg: "var(--rail-info-bg)", c: "var(--rail-info)" },
  Gagné: { bg: "var(--rail-success-bg)", c: "var(--rail-success)" },
  Perdu: { bg: "var(--rail-danger-bg)", c: "var(--rail-danger)" },
};

const ETAPES_ORDER = ["Prospect", "Qualification", "Proposition", "Gagné"];

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

  const etapeTone = ETAPE_TONES[deal.etape] ?? {
    bg: "var(--rail-hair2)",
    c: "var(--rail-ink2)",
  };
  const stageIdx = ETAPES_ORDER.indexOf(deal.etape);

  return (
    <div className="space-y-6">
      {/* Deal header */}
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1
              className="m-0 text-[24px] font-semibold"
              style={{ letterSpacing: "-0.5px" }}
            >
              {deal.titre}
            </h1>
            <span
              className="text-[10.5px] uppercase font-medium"
              style={{
                padding: "3px 7px",
                background: etapeTone.bg,
                color: etapeTone.c,
                borderRadius: 3,
                letterSpacing: "0.04em",
              }}
            >
              {deal.etape}
            </span>
          </div>
          <p className="mt-1 text-[13px]" style={{ color: "var(--rail-muted)" }}>
            {deal.clientName} · {deal.clientEmail}
          </p>
          {/* Qonto client linking */}
          <div className="mt-2.5 flex items-center gap-2">
            <Link2 className="h-3 w-3" style={{ color: "var(--rail-muted2)" }} />
            <span className="text-[11.5px]" style={{ color: "var(--rail-muted)" }}>
              Qonto :
            </span>
            {qontoClients.length > 0 ? (
              <Select
                value={deal.qontoClientId ?? "none"}
                onValueChange={(v) => handleQontoLinkChange(v ?? "none")}
              >
                <SelectTrigger
                  className="h-7 w-[220px] text-[11.5px]"
                  style={{
                    borderColor: deal.qontoClientId ? "var(--rail-success)" : "var(--rail-hair)",
                    color: deal.qontoClientId ? "var(--rail-success)" : "var(--rail-ink)",
                  }}
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
              <span className="text-[11.5px]" style={{ color: "var(--rail-muted)" }}>
                Qonto non configuré
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stage progression bar */}
      {deal.etape !== "Perdu" && (
        <div className="flex gap-1">
          {ETAPES_ORDER.map((s, i) => {
            const done = i <= stageIdx;
            return (
              <div
                key={s}
                className="flex-1 text-center text-[11px] font-medium"
                style={{
                  padding: "6px 8px",
                  background: done ? "var(--b-accent)" : "var(--rail-hair)",
                  color: done ? "#fff" : "var(--rail-muted)",
                  borderRadius: 3,
                }}
              >
                {s}
              </div>
            );
          })}
        </div>
      )}

      {/* Deal info cards — Rail v2 KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <CrmKpi label="Montant estimé" value={formatCurrency(deal.montantEstime)} />
        <CrmKpi
          label="Montant final"
          value={deal.montantFinal != null ? formatCurrency(deal.montantFinal) : "—"}
          tone={deal.montantFinal != null ? "good" : "default"}
        />
        <CrmKpi label="Date de signature" value={formatDate(deal.dateSignature)} />
        <CrmKpi label="Créé le" value={formatDate(deal.createdAt)} />
      </div>

      {/* Budgets / Propositions */}
      <section
        className="overflow-hidden"
        style={{
          background: "var(--rail-panel)",
          border: "1px solid var(--rail-hair)",
          borderRadius: 8,
        }}
      >
        <header
          className="flex items-center justify-between"
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--rail-hair)",
          }}
        >
          <div>
            <div className="text-[13px] font-semibold">Propositions commerciales</div>
            {budgets.length > 0 && (
              <div className="text-[11.5px] mt-0.5" style={{ color: "var(--rail-muted)" }}>
                {budgets.length} proposition{budgets.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
          <Link
            href={`/crm/${deal.id}/budget/new`}
            className="inline-flex items-center gap-1.5 text-white rounded-md text-[12.5px] font-medium"
            style={{
              padding: "7px 12px",
              background: "var(--b-accent)",
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Nouveau budget
          </Link>
        </header>

        {budgets.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ padding: "48px 20px" }}
          >
            <FileText
              className="h-8 w-8"
              style={{ color: "var(--rail-muted2)" }}
            />
            <p
              className="mt-3 text-[13px]"
              style={{ color: "var(--rail-muted)" }}
            >
              Aucune proposition commerciale pour ce deal.
            </p>
            <Link
              href={`/crm/${deal.id}/budget/new`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-medium bg-white"
              style={{
                padding: "7px 12px",
                border: "1px solid var(--rail-hair)",
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Créer un budget
            </Link>
          </div>
        ) : (
          <div>
            <div
              className="grid gap-3 text-[10.5px] uppercase"
              style={{
                gridTemplateColumns: "1.4fr 130px 80px 80px 130px 32px",
                padding: "8px 18px",
                letterSpacing: "0.08em",
                color: "var(--rail-muted)",
                background: "var(--rail-hair3)",
                borderBottom: "1px solid var(--rail-hair2)",
              }}
            >
              <span>Nom</span>
              <span className="text-right">Montant HT</span>
              <span className="text-right">Remise</span>
              <span className="text-right">TVA</span>
              <span className="text-right">Dernière modif.</span>
              <span />
            </div>
            {budgets.map((budget, i) => (
              <div
                key={budget.id}
                className="group grid items-center text-[13px]"
                style={{
                  gridTemplateColumns: "1.4fr 130px 80px 80px 130px 32px",
                  gap: 12,
                  padding: "12px 18px",
                  borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                }}
              >
                <Link
                  href={`/crm/${deal.id}/budget/${budget.id}`}
                  className="font-medium hover:underline whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  {budget.nom || "Sans nom"}
                </Link>
                <span
                  className="text-right"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {formatCurrency(budget.montantTotal)}
                </span>
                <span
                  className="text-right text-[12px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color:
                      budget.remiseGlobale > 0 ? "var(--rail-warn)" : "var(--rail-muted2)",
                  }}
                >
                  {budget.remiseGlobale > 0 ? `${budget.remiseGlobale}%` : "—"}
                </span>
                <span
                  className="text-right text-[12px]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {budget.tauxTva}%
                </span>
                <span
                  className="text-right text-[12px]"
                  style={{ color: "var(--rail-muted)" }}
                >
                  {formatDate(budget.updatedAt || budget.createdAt)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button className="h-7 w-7 grid place-items-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--rail-hair2)]" />
                    }
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" style={{ color: "var(--rail-muted)" }} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      render={<Link href={`/crm/${deal.id}/budget/${budget.id}`} />}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(budget.id)}>
                      <Copy className="mr-2 h-4 w-4" /> Dupliquer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openDeleteBudget(budget)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </section>

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

// ─── CRM KPI Card (no sparkline, simple) ─────────────────
function CrmKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "good";
}) {
  return (
    <div
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
      <div
        className="text-[22px] font-semibold tabular leading-tight"
        style={{
          letterSpacing: "-0.4px",
          color: tone === "good" ? "var(--rail-success)" : "var(--rail-ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
