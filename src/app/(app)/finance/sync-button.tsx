"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncDealFacturesFromQonto } from "./actions";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    startTransition(async () => {
      try {
        const result = await syncDealFacturesFromQonto();
        if (result.updated > 0) {
          toast.success(
            `${result.updated} facture${result.updated > 1 ? "s" : ""} mise${result.updated > 1 ? "s" : ""} à jour sur ${result.total}`,
          );
        } else {
          toast.info("Toutes les factures sont déjà à jour.");
        }
      } catch {
        toast.error("Erreur lors de la synchronisation");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isPending}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Synchronisation…" : "Forcer la mise à jour"}
    </Button>
  );
}
