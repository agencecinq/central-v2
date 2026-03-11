"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Info, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  createForecastExpense,
  deleteForecastExpense,
  deleteInvoicePlanification,
  deleteSingletonExpense,
  upsertDealRevenu,
  upsertInvoicePlanification,
  deleteDealRevenu,
  upsertSingletonExpense,
} from "./actions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PendingInvoice {
  montantHT: number;
  dateEcheance: string;
  clientNom: string;
  numero: string;
}

interface UnpaidExpense {
  montant: number;
  montantPaye: number;
  dateTransaction: string;
  label: string;
}

interface ForecastExpenseItem {
  id: number;
  categorie: string;
  mois: string;
  moisFin: string | null;
  libelle: string;
  montant: number;
}

interface DealRevenuItem {
  id: number;
  dealId: number;
  mois: string;
  montantHT: number;
}

interface DealWithReste {
  id: number;
  titre: string;
  clientName: string;
  montantFinal: number;
  totalFacture: number;
  totalPlanifie: number;
  resteNonPlanifie: number;
}

interface MonthData {
  key: string;
  label: string;
  facturesAEncaisser: number;
  factuPlanifiee: number;
  entrees: number;
  depensesProjets: number;
  taxe: number;
  remuneration: number;
  emprunt: number;
  abonnements: number;
  prestataires: number;
  depensesPlanifiees: number;
  sorties: number;
  soldeDebut: number;
  soldeFin: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  const label = date.toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function generateMonthKeys(): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

function clampKey(key: string, monthKeys: string[]): string {
  if (key < monthKeys[0]) return monthKeys[0];
  if (key > monthKeys[monthKeys.length - 1])
    return monthKeys[monthKeys.length - 1];
  return key;
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ForecastTable({
  balance,
  pendingInvoices,
  unpaidExpenses,
  forecastExpenses,
  dealRevenus,
  dealsWithReste,
  totalResteAFacturer,
  invoicePlanifications,
}: {
  balance: number | null;
  pendingInvoices: PendingInvoice[];
  unpaidExpenses: UnpaidExpense[];
  forecastExpenses: ForecastExpenseItem[];
  dealRevenus: DealRevenuItem[];
  dealsWithReste: DealWithReste[];
  totalResteAFacturer: number;
  invoicePlanifications: Record<string, string>; // numero → mois planifié
}) {
  const monthKeys = useMemo(() => generateMonthKeys(), []);

  // ─── Split expenses by category
  const remunerationRecord = forecastExpenses.find(
    (e) => e.categorie === "remuneration",
  );
  const empruntRecord = forecastExpenses.find(
    (e) => e.categorie === "emprunt",
  );
  const abonnementsList = forecastExpenses.filter(
    (e) => e.categorie === "abonnements",
  );
  const prestatairesList = forecastExpenses.filter(
    (e) => e.categorie === "prestataires",
  );

  const months = useMemo(() => {
    // Group pending invoices by month (use planification override if available)
    const facturesByMonth: Record<string, number> = {};
    for (const inv of pendingInvoices) {
      const planned = invoicePlanifications[inv.numero];
      const key = planned
        ? clampKey(planned, monthKeys)
        : clampKey(getMonthKey(inv.dateEcheance), monthKeys);
      facturesByMonth[key] = (facturesByMonth[key] ?? 0) + inv.montantHT;
    }

    // Group planned deal revenues by month
    const dealRevByMonth: Record<string, number> = {};
    for (const dr of dealRevenus) {
      if (monthKeys.includes(dr.mois)) {
        dealRevByMonth[dr.mois] =
          (dealRevByMonth[dr.mois] ?? 0) + dr.montantHT;
      }
    }

    // Group unpaid project expenses by month
    const depProjByMonth: Record<string, number> = {};
    for (const exp of unpaidExpenses) {
      const remaining = exp.montant - exp.montantPaye;
      if (remaining <= 0) continue;
      const key = clampKey(getMonthKey(exp.dateTransaction), monthKeys);
      depProjByMonth[key] = (depProjByMonth[key] ?? 0) + remaining;
    }

    // Compute recurring amounts
    const remuMensuel = remunerationRecord
      ? remunerationRecord.montant
      : 0;
    const empruntMensuel = empruntRecord ? empruntRecord.montant : 0;
    const empruntFin = empruntRecord?.moisFin ?? "9999-12";
    const aboMensuel = abonnementsList.reduce((s, a) => s + a.montant, 0);

    // Group prestataires by month
    const prestaByMonth: Record<string, number> = {};
    for (const p of prestatairesList) {
      if (monthKeys.includes(p.mois)) {
        prestaByMonth[p.mois] = (prestaByMonth[p.mois] ?? 0) + p.montant;
      }
    }

    // Build month data with running balance
    const result: MonthData[] = [];
    let running = balance ?? 0;

    for (let i = 0; i < monthKeys.length; i++) {
      const key = monthKeys[i];
      const facturesAEncaisser = facturesByMonth[key] ?? 0;
      const factuPlanifiee = dealRevByMonth[key] ?? 0;
      const entrees = facturesAEncaisser + factuPlanifiee;

      const depensesProjets = depProjByMonth[key] ?? 0;
      // Taxe = 20% des entrées du mois précédent
      const taxe =
        i > 0 ? Math.round(result[i - 1].entrees * 0.2) : 0;
      const remuneration = remuMensuel;
      const emprunt = key <= empruntFin ? empruntMensuel : 0;
      const abonnements = aboMensuel;
      const prestataires = prestaByMonth[key] ?? 0;

      const depensesPlanifiees =
        taxe + remuneration + emprunt + abonnements + prestataires;
      const sorties = depensesProjets + depensesPlanifiees;

      const soldeDebut = running;
      const soldeFin = soldeDebut + entrees - sorties;

      result.push({
        key,
        label: getMonthLabel(key),
        facturesAEncaisser,
        factuPlanifiee,
        entrees,
        depensesProjets,
        taxe,
        remuneration,
        emprunt,
        abonnements,
        prestataires,
        depensesPlanifiees,
        sorties,
        soldeDebut,
        soldeFin,
      });

      running = soldeFin;
    }

    return result;
  }, [
    balance,
    pendingInvoices,
    unpaidExpenses,
    dealRevenus,
    monthKeys,
    invoicePlanifications,
    remunerationRecord,
    empruntRecord,
    abonnementsList,
    prestatairesList,
  ]);

  const totalEntrees = months.reduce((s, m) => s + m.entrees, 0);
  const totalFactures = months.reduce((s, m) => s + m.facturesAEncaisser, 0);
  const totalFactuPlan = months.reduce((s, m) => s + m.factuPlanifiee, 0);
  const totalSorties = months.reduce((s, m) => s + m.sorties, 0);
  const totalDepProj = months.reduce((s, m) => s + m.depensesProjets, 0);
  const totalTaxe = months.reduce((s, m) => s + m.taxe, 0);
  const totalRemu = months.reduce((s, m) => s + m.remuneration, 0);
  const totalEmprunt = months.reduce((s, m) => s + m.emprunt, 0);
  const totalAbo = months.reduce((s, m) => s + m.abonnements, 0);
  const totalPresta = months.reduce((s, m) => s + m.prestataires, 0);

  return (
    <div className="space-y-6">
      {/* ─── Forecast Table ────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium min-w-[180px]" />
                  {months.map((m) => (
                    <th
                      key={m.key}
                      className="px-4 py-3 font-medium text-right min-w-[110px]"
                    >
                      {m.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium text-right min-w-[110px] border-l">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Solde début */}
                <tr className="border-b bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">Solde début</td>
                  {months.map((m) => (
                    <td
                      key={m.key}
                      className="px-4 py-2.5 text-right tabular-nums font-medium"
                    >
                      {formatEuro(m.soldeDebut)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right border-l" />
                </tr>

                {/* Entrées */}
                <tr className="border-b">
                  <td className="px-4 py-2.5 font-semibold text-emerald-700">
                    Entrées
                  </td>
                  {months.map((m) => (
                    <td
                      key={m.key}
                      className="px-4 py-2.5 text-right tabular-nums text-emerald-700 font-medium"
                    >
                      {m.entrees > 0 ? `+${formatEuro(m.entrees)}` : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 font-medium border-l">
                    {totalEntrees > 0 ? `+${formatEuro(totalEntrees)}` : "—"}
                  </td>
                </tr>

                {/* Sub: Factures à encaisser */}
                <SubRow
                  label="Factures à encaisser"
                  months={months}
                  getValue={(m) => m.facturesAEncaisser}
                  total={totalFactures}
                  className="text-muted-foreground"
                />

                {/* Sub: Facturation planifiée */}
                <SubRow
                  label="Facturation planifiée"
                  months={months}
                  getValue={(m) => m.factuPlanifiee}
                  total={totalFactuPlan}
                  className="text-blue-600"
                />

                {/* Sorties */}
                <tr className="border-b">
                  <td className="px-4 py-2.5 font-semibold text-red-600">
                    Sorties
                  </td>
                  {months.map((m) => (
                    <td
                      key={m.key}
                      className="px-4 py-2.5 text-right tabular-nums text-red-600 font-medium"
                    >
                      {m.sorties > 0 ? `-${formatEuro(m.sorties)}` : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-600 font-medium border-l">
                    {totalSorties > 0 ? `-${formatEuro(totalSorties)}` : "—"}
                  </td>
                </tr>

                {/* Sub-rows per category */}
                <SubRow
                  label="Dépenses projets"
                  months={months}
                  getValue={(m) => m.depensesProjets}
                  total={totalDepProj}
                  className="text-muted-foreground"
                />
                <SubRow
                  label="Taxes (20% M-1)"
                  months={months}
                  getValue={(m) => m.taxe}
                  total={totalTaxe}
                  className="text-orange-600"
                />
                <SubRow
                  label="Rémunération"
                  months={months}
                  getValue={(m) => m.remuneration}
                  total={totalRemu}
                  className="text-orange-600"
                />
                <SubRow
                  label="Emprunt"
                  months={months}
                  getValue={(m) => m.emprunt}
                  total={totalEmprunt}
                  className="text-orange-600"
                />
                <SubRow
                  label="Abonnements"
                  months={months}
                  getValue={(m) => m.abonnements}
                  total={totalAbo}
                  className="text-orange-600"
                />
                <SubRow
                  label="Prestataires"
                  months={months}
                  getValue={(m) => m.prestataires}
                  total={totalPresta}
                  className="text-orange-600"
                />

                {/* Solde fin */}
                <tr className="bg-muted/30">
                  <td className="px-4 py-3 font-bold">Solde fin</td>
                  {months.map((m) => (
                    <td
                      key={m.key}
                      className={`px-4 py-3 text-right tabular-nums font-bold ${m.soldeFin < 0 ? "text-red-600" : ""}`}
                    >
                      {formatEuro(m.soldeFin)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right border-l" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Reste non planifié */}
      {totalResteAFacturer > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Reste à facturer non planifié :{" "}
              <span className="tabular-nums">
                {formatEuro(totalResteAFacturer)}
              </span>
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Utilisez la section ci-dessous pour répartir ces revenus sur des
              mois spécifiques.
            </p>
          </div>
        </div>
      )}

      {/* ─── Factures à encaisser (planification) ───────────────────── */}
      {pendingInvoices.length > 0 && (
        <InvoicePlanificationSection
          pendingInvoices={pendingInvoices}
          invoicePlanifications={invoicePlanifications}
          monthKeys={monthKeys}
        />
      )}

      {/* ─── Facturation planifiée (deal revenue planning) ─────────────── */}
      <DealRevenueSection
        dealRevenus={dealRevenus}
        dealsWithReste={dealsWithReste}
        monthKeys={monthKeys}
      />

      {/* ─── Dépenses planifiées — édition par catégorie ───────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Dépenses planifiées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Taxe */}
          <div className="rounded-lg border p-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Taxes</span>
              <span className="text-xs text-muted-foreground">
                — Automatique : 20 % des entrées du mois précédent
              </span>
            </div>
          </div>

          {/* Rémunération */}
          <RemunerationRow value={remunerationRecord ?? null} />

          {/* Emprunt */}
          <EmpruntRow
            value={empruntRecord ?? null}
            monthKeys={monthKeys}
          />

          {/* Abonnements */}
          <AbonnementsSection items={abonnementsList} />

          {/* Prestataires */}
          <PrestatairesSection
            items={prestatairesList}
            monthKeys={monthKeys}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-row helper ─────────────────────────────────────────────────────────

function SubRow({
  label,
  months,
  getValue,
  total,
  className,
}: {
  label: string;
  months: MonthData[];
  getValue: (m: MonthData) => number;
  total: number;
  className: string;
}) {
  // Hide row entirely if total is 0
  if (total === 0 && months.every((m) => getValue(m) === 0)) return null;

  return (
    <tr className="border-b">
      <td className={`px-4 py-2 pl-8 text-xs ${className}`}>{label}</td>
      {months.map((m) => {
        const v = getValue(m);
        return (
          <td
            key={m.key}
            className={`px-4 py-2 text-right tabular-nums text-xs ${className}`}
          >
            {v > 0 ? formatEuro(v) : "—"}
          </td>
        );
      })}
      <td
        className={`px-4 py-2 text-right tabular-nums text-xs border-l ${className}`}
      >
        {total > 0 ? formatEuro(total) : "—"}
      </td>
    </tr>
  );
}

// ─── Invoice Planification Section ──────────────────────────────────────────

function InvoicePlanificationSection({
  pendingInvoices,
  invoicePlanifications,
  monthKeys,
}: {
  pendingInvoices: PendingInvoice[];
  invoicePlanifications: Record<string, string>;
  monthKeys: string[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(numero: string, newMois: string, defaultMois: string) {
    startTransition(async () => {
      if (newMois === defaultMois) {
        // Revenir à l'échéance par défaut → supprimer la planification
        await deleteInvoicePlanification(numero);
      } else {
        await upsertInvoicePlanification({ numero, mois: newMois });
      }
    });
  }

  function handleReset(numero: string) {
    startTransition(async () => {
      await deleteInvoicePlanification(numero);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Factures à encaisser
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">N°</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  Montant HT
                </th>
                <th className="px-4 py-2.5 font-medium">Échéance</th>
                <th className="px-4 py-2.5 font-medium">Encaissement prévu</th>
                <th className="px-4 py-2.5 font-medium w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {pendingInvoices.map((inv) => {
                const defaultMois = getMonthKey(inv.dateEcheance);
                const planned = invoicePlanifications[inv.numero];
                const currentMois = planned ?? defaultMois;
                const isOverridden = !!planned && planned !== defaultMois;

                return (
                  <tr key={inv.numero} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5">{inv.clientNom}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {inv.numero}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-emerald-600">
                      {formatEuro(inv.montantHT)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {getMonthLabel(defaultMois)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Select
                        value={currentMois}
                        onValueChange={(v) =>
                          handleChange(
                            inv.numero,
                            v ?? defaultMois,
                            defaultMois,
                          )
                        }
                      >
                        <SelectTrigger
                          className={`h-8 w-[140px] text-xs ${isOverridden ? "border-emerald-300 text-emerald-700" : ""}`}
                        >
                          {getMonthLabel(currentMois)}
                        </SelectTrigger>
                        <SelectContent>
                          {monthKeys.map((k) => (
                            <SelectItem key={k} value={k}>
                              {getMonthLabel(k)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5">
                      {isOverridden && (
                        <button
                          onClick={() => handleReset(inv.numero)}
                          disabled={isPending}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Revenir à l'échéance"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Rémunération dirigeants ────────────────────────────────────────────────

function RemunerationRow({
  value,
}: {
  value: ForecastExpenseItem | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [montant, setMontant] = useState(
    value ? String(value.montant) : "",
  );

  function handleSave() {
    const m = parseFloat(montant);
    if (!m || m <= 0) return;
    startTransition(async () => {
      await upsertSingletonExpense({ categorie: "remuneration", montant: m });
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSingletonExpense("remuneration");
      setMontant("");
      setEditing(false);
    });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Rémunération dirigeants</span>
          <span className="text-xs text-muted-foreground ml-2">
            — Identique chaque mois
          </span>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            {value && (
              <span className="text-sm font-medium tabular-nums text-orange-600">
                {formatEuro(value.montant)} /mois
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMontant(value ? String(value.montant) : "");
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-3 flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label htmlFor="remu-montant" className="text-xs">
              Montant mensuel (€)
            </Label>
            <Input
              id="remu-montant"
              type="number"
              min={0}
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0"
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "…" : "Enregistrer"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Annuler
          </Button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Emprunt ────────────────────────────────────────────────────────────────

function EmpruntRow({
  value,
  monthKeys,
}: {
  value: ForecastExpenseItem | null;
  monthKeys: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [montant, setMontant] = useState(
    value ? String(value.montant) : "",
  );
  const [moisFin, setMoisFin] = useState(value?.moisFin ?? "");

  function handleSave() {
    const m = parseFloat(montant);
    if (!m || m <= 0) return;
    startTransition(async () => {
      await upsertSingletonExpense({
        categorie: "emprunt",
        montant: m,
        moisFin: moisFin || undefined,
      });
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSingletonExpense("emprunt");
      setMontant("");
      setMoisFin("");
      setEditing(false);
    });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Emprunt</span>
          <span className="text-xs text-muted-foreground ml-2">
            — Fixe jusqu&apos;à une date donnée
          </span>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            {value && (
              <span className="text-sm font-medium tabular-nums text-orange-600">
                {formatEuro(value.montant)} /mois
                {value.moisFin && (
                  <span className="text-muted-foreground font-normal ml-1">
                    jusqu&apos;à {getMonthLabel(value.moisFin)}
                  </span>
                )}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMontant(value ? String(value.montant) : "");
                setMoisFin(value?.moisFin ?? "");
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-3 flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label htmlFor="emprunt-montant" className="text-xs">
              Montant mensuel (€)
            </Label>
            <Input
              id="emprunt-montant"
              type="number"
              min={0}
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label htmlFor="emprunt-fin" className="text-xs">
              Fin (mois)
            </Label>
            <Input
              id="emprunt-fin"
              type="month"
              value={moisFin}
              onChange={(e) => setMoisFin(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "…" : "Enregistrer"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Annuler
          </Button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Abonnements ────────────────────────────────────────────────────────────

function AbonnementsSection({
  items,
}: {
  items: ForecastExpenseItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");

  const total = items.reduce((s, a) => s + a.montant, 0);

  function handleSubmit() {
    if (!libelle.trim() || !montant) return;
    startTransition(async () => {
      await createForecastExpense({
        categorie: "abonnements",
        libelle: libelle.trim(),
        montant: parseFloat(montant),
      });
      setDialogOpen(false);
      setLibelle("");
      setMontant("");
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteForecastExpense(id);
    });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium">Abonnements</span>
          <span className="text-xs text-muted-foreground ml-2">
            — Fixe chaque mois
          </span>
          {total > 0 && (
            <span className="text-sm font-medium tabular-nums text-orange-600 ml-3">
              {formatEuro(total)} /mois
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50"
            >
              <span className="text-muted-foreground">{item.libelle}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-orange-600 font-medium">
                  {formatEuro(item.montant)}
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un abonnement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="abo-lib">Libellé</Label>
              <Input
                id="abo-lib"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Figma, Slack, Notion…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abo-montant">Montant mensuel (€)</Label>
              <Input
                id="abo-montant"
                type="number"
                min={0}
                step="0.01"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isPending ||
                !libelle.trim() ||
                !montant ||
                parseFloat(montant) <= 0
              }
            >
              {isPending ? "…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Prestataires ───────────────────────────────────────────────────────────

function PrestatairesSection({
  items,
  monthKeys,
}: {
  items: ForecastExpenseItem[];
  monthKeys: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [mois, setMois] = useState(monthKeys[0]);
  const [montant, setMontant] = useState("");

  const moisLabel = getMonthLabel(mois);

  function handleSubmit() {
    if (!libelle.trim() || !mois || !montant) return;
    startTransition(async () => {
      await createForecastExpense({
        categorie: "prestataires",
        libelle: libelle.trim(),
        montant: parseFloat(montant),
        mois,
      });
      setDialogOpen(false);
      setLibelle("");
      setMontant("");
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteForecastExpense(id);
    });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium">Prestataires</span>
          <span className="text-xs text-muted-foreground ml-2">
            — Variable, par mois
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{item.libelle}</span>
                <span className="text-xs text-muted-foreground/70">
                  {getMonthLabel(item.mois)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-orange-600 font-medium">
                  {formatEuro(item.montant)}
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un prestataire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="presta-lib">Libellé</Label>
              <Input
                id="presta-lib"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Nom du prestataire"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mois</Label>
                <Select
                  value={mois}
                  onValueChange={(v) => setMois(v ?? monthKeys[0])}
                >
                  <SelectTrigger>{moisLabel}</SelectTrigger>
                  <SelectContent>
                    {monthKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        {getMonthLabel(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="presta-montant">Montant (€)</Label>
                <Input
                  id="presta-montant"
                  type="number"
                  min={0}
                  step="0.01"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isPending ||
                !libelle.trim() ||
                !montant ||
                parseFloat(montant) <= 0
              }
            >
              {isPending ? "…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Deal Revenue Section ───────────────────────────────────────────────────

function DealRevenueSection({
  dealRevenus,
  dealsWithReste,
  monthKeys,
}: {
  dealRevenus: DealRevenuItem[];
  dealsWithReste: DealWithReste[];
  monthKeys: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dealId, setDealId] = useState("");
  const [mois, setMois] = useState(monthKeys[0]);
  const [montant, setMontant] = useState("");

  const selectedDeal = dealsWithReste.find((d) => String(d.id) === dealId);
  const dealLabel = selectedDeal ? selectedDeal.titre : "Sélectionner un deal";
  const moisLabel = getMonthLabel(mois);

  function handleSubmit() {
    if (!dealId || !mois || !montant) return;
    startTransition(async () => {
      await upsertDealRevenu({
        dealId: parseInt(dealId),
        mois,
        montantHT: parseFloat(montant),
      });
      setDialogOpen(false);
      setDealId("");
      setMontant("");
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteDealRevenu(id);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Facturation planifiée
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={dealsWithReste.length === 0}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Planifier
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {dealRevenus.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            Aucune facturation planifiée. Répartissez le reste à facturer sur
            des mois spécifiques.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Deal</th>
                  <th className="px-4 py-2.5 font-medium">Mois</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Montant HT
                  </th>
                  <th className="px-4 py-2.5 font-medium w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {dealRevenus.map((dr) => {
                  const deal = dealsWithReste.find(
                    (d) => d.id === dr.dealId,
                  );
                  return (
                    <tr key={dr.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        {deal?.titre ?? `Deal #${dr.dealId}`}
                        {deal && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({deal.clientName})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {getMonthLabel(dr.mois)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-blue-600">
                        {formatEuro(dr.montantHT)}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleDelete(dr.id)}
                          disabled={isPending}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Planifier une facturation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Deal</Label>
              <Select
                value={dealId}
                onValueChange={(v) => setDealId(v ?? "")}
              >
                <SelectTrigger>{dealLabel}</SelectTrigger>
                <SelectContent>
                  {dealsWithReste.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.titre} — reste {formatEuro(d.resteNonPlanifie)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mois</Label>
              <Select
                value={mois}
                onValueChange={(v) => setMois(v ?? monthKeys[0])}
              >
                <SelectTrigger>{moisLabel}</SelectTrigger>
                <SelectContent>
                  {monthKeys.map((k) => (
                    <SelectItem key={k} value={k}>
                      {getMonthLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dr-montant">Montant HT (€)</Label>
              <Input
                id="dr-montant"
                type="number"
                min={0}
                step="0.01"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0"
              />
              {selectedDeal && (
                <p className="text-xs text-muted-foreground">
                  Reste non planifié :{" "}
                  {formatEuro(selectedDeal.resteNonPlanifie)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isPending ||
                !dealId ||
                !montant ||
                parseFloat(montant) <= 0
              }
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
