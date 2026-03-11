"use client";

import { useTransition, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createTransaction, updateTransaction } from "./actions";

interface TransactionData {
  id: number;
  label: string;
  categorie: string | null;
  montant: number;
  type: string;
  statut: string | null;
  montantPaye: number;
  dateTransaction: string;
}

export function TransactionDialog({
  projectId,
  transaction,
  open,
  onOpenChange,
}: {
  projectId: number;
  transaction?: TransactionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState("depense");
  const [statut, setStatut] = useState<string>("none");

  useEffect(() => {
    if (open) {
      setType(transaction?.type ?? "depense");
      setStatut(transaction?.statut ?? "none");
    }
  }, [open, transaction]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("type", type);
    formData.set("statut", statut === "none" ? "" : statut);

    startTransition(async () => {
      if (transaction) {
        await updateTransaction(transaction.id, projectId, formData);
      } else {
        await createTransaction(projectId, formData);
      }
      onOpenChange(false);
    });
  }

  const isEditing = !!transaction;

  const typeLabels: Record<string, string> = { depense: "Dépense", revenu: "Revenu" };
  const statutLabels: Record<string, string> = { none: "—", a_payer: "À payer", paye_partiel: "Partiel", "soldé": "Soldé" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier la transaction" : "Nouvelle transaction"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              name="label"
              required
              defaultValue={transaction?.label ?? ""}
              placeholder="Description de la transaction"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="montant">Montant (€) *</Label>
              <Input
                id="montant"
                name="montant"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={transaction?.montant ?? ""}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "depense")}>
                <SelectTrigger className="w-full">
                  {typeLabels[type] ?? type}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="depense">Dépense</SelectItem>
                  <SelectItem value="revenu">Revenu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categorie">Catégorie</Label>
              <Input
                id="categorie"
                name="categorie"
                defaultValue={transaction?.categorie ?? ""}
                placeholder="Ex: Hébergement..."
              />
            </div>

            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={statut} onValueChange={(v) => setStatut(v ?? "none")}>
                <SelectTrigger className="w-full">
                  {statutLabels[statut] ?? statut}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="a_payer">À payer</SelectItem>
                  <SelectItem value="paye_partiel">Partiel</SelectItem>
                  <SelectItem value="soldé">Soldé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateTransaction">Date *</Label>
            <Input
              id="dateTransaction"
              name="dateTransaction"
              type="date"
              required
              defaultValue={
                transaction?.dateTransaction
                  ? transaction.dateTransaction.substring(0, 10)
                  : new Date().toISOString().substring(0, 10)
              }
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Enregistrement..."
                : isEditing
                  ? "Enregistrer"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
