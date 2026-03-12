"use client";

import { useState, useTransition } from "react";
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
import { markDealWon } from "./actions";

interface DealData {
  id: number;
  titre: string;
  montantEstime: number;
}

interface Props {
  deal: DealData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function WonDealDialog({ deal, open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [montant, setMontant] = useState("");
  const [dateSignature, setDateSignature] = useState(todayISO());

  // Reset form when deal changes
  if (deal && montant === "") {
    setMontant(String(deal.montantEstime));
    setDateSignature(todayISO());
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setMontant("");
      setDateSignature(todayISO());
    }
    onOpenChange(isOpen);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deal) return;

    const finalMontant = parseFloat(montant);
    if (isNaN(finalMontant) || finalMontant <= 0) return;

    startTransition(async () => {
      await markDealWon(deal.id, finalMontant, dateSignature);
      handleOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Marquer comme gagné</DialogTitle>
        </DialogHeader>
        {deal && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {deal.titre}
            </p>

            <div className="space-y-2">
              <Label htmlFor="montantFinal">Montant final signé (€) *</Label>
              <Input
                id="montantFinal"
                type="number"
                step="0.01"
                min="0"
                required
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateSignature">Date de signature *</Label>
              <Input
                id="dateSignature"
                type="date"
                required
                value={dateSignature}
                onChange={(e) => setDateSignature(e.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Un projet sera automatiquement créé avec ce montant comme budget.
            </p>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Validation..." : "Valider"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
