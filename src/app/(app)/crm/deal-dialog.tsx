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
import { Plus, ArrowLeft } from "lucide-react";
import { createDeal, updateDeal, createClient } from "./actions";

interface DealData {
  id: number;
  titre: string;
  clientId: number;
  montantEstime: number;
  etape: string;
  montantFinal: number | null;
  dateSignature: string | null;
}

interface ClientOption {
  id: number;
  name: string;
}

const ETAPES = ["Prospect", "Qualification", "Proposition", "Gagné", "Perdu"];

export function DealDialog({
  deal,
  clients: initialClients,
  open,
  onOpenChange,
}: {
  deal?: DealData | null;
  clients: ClientOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [etape, setEtape] = useState("Prospect");
  const [clientId, setClientId] = useState<string>("");
  const [clients, setClients] = useState(initialClients);
  const [showNewClient, setShowNewClient] = useState(false);

  // Sync clients when parent re-renders with new data
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  useEffect(() => {
    if (open) {
      setEtape(deal?.etape ?? "Prospect");
      setClientId(deal?.clientId?.toString() ?? "");
      setShowNewClient(false);
    }
  }, [open, deal]);

  const isEditing = !!deal;

  const clientLabel = clientId
    ? clients.find((c) => String(c.id) === clientId)?.name ?? "Choisir un client"
    : "Choisir un client";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("etape", etape);
    if (clientId) formData.set("clientId", clientId);

    startTransition(async () => {
      if (deal) {
        await updateDeal(deal.id, formData);
      } else {
        await createDeal(formData);
      }
      onOpenChange(false);
    });
  }

  function handleCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const newClient = await createClient(formData);
      setClients((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(String(newClient.id));
      setShowNewClient(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {showNewClient ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewClient(false)}
                  className="rounded-md p-1 hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                Nouveau client
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nc-nom">Nom *</Label>
                <Input
                  id="nc-nom"
                  name="nom"
                  required
                  placeholder="Nom du contact"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nc-email">Email *</Label>
                <Input
                  id="nc-email"
                  name="email"
                  type="email"
                  required
                  placeholder="email@exemple.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nc-entreprise">Entreprise</Label>
                  <Input
                    id="nc-entreprise"
                    name="entreprise"
                    placeholder="Nom de l'entreprise"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nc-telephone">Téléphone</Label>
                  <Input
                    id="nc-telephone"
                    name="telephone"
                    placeholder="+33..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewClient(false)}
                >
                  Retour
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Création..." : "Créer le client"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Modifier le deal" : "Nouveau deal"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titre">Titre *</Label>
                <Input
                  id="titre"
                  name="titre"
                  required
                  defaultValue={deal?.titre ?? ""}
                  placeholder="Nom du deal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <div className="flex gap-1.5">
                    <Select value={clientId} onValueChange={(v) => setClientId(v ?? "")}>
                      <SelectTrigger className="w-full">
                        {clientLabel}
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setShowNewClient(true)}
                      title="Nouveau client"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="montantEstime">Montant estimé (€) *</Label>
                  <Input
                    id="montantEstime"
                    name="montantEstime"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={deal?.montantEstime ?? ""}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Étape</Label>
                  <Select value={etape} onValueChange={(v) => setEtape(v ?? "Prospect")}>
                    <SelectTrigger className="w-full">
                      {etape}
                    </SelectTrigger>
                    <SelectContent>
                      {ETAPES.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="montantFinal">Montant final (€)</Label>
                  <Input
                    id="montantFinal"
                    name="montantFinal"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={deal?.montantFinal ?? ""}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateSignature">Date de signature</Label>
                <Input
                  id="dateSignature"
                  name="dateSignature"
                  type="date"
                  defaultValue={
                    deal?.dateSignature
                      ? deal.dateSignature.substring(0, 10)
                      : ""
                  }
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending
                    ? "Enregistrement..."
                    : isEditing
                      ? "Enregistrer"
                      : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
