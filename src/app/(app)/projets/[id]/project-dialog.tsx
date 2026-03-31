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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { updateProject } from "./actions";

interface ProjectData {
  id: number;
  titre: string;
  description: string | null;
  statut: string;
  clientId: number | null;
  chefProjetId: number | null;
  dealId: number | null;
  budgetTotal: number;
  joursVendus: number | null;
  dateDebut: string | null;
  deadline: string | null;
  githubUrl: string | null;
  figmaUrl: string | null;
}

interface ClientOption {
  id: number;
  name: string;
}

interface UserOption {
  id: number;
  name: string;
}

interface DealOption {
  id: number;
  titre: string;
  montantFinal: number | null;
}

export function ProjectDialog({
  project,
  clients,
  users,
  deals,
  open,
  onOpenChange,
}: {
  project: ProjectData;
  clients: ClientOption[];
  users: UserOption[];
  deals: DealOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const [statut, setStatut] = useState(project.statut);
  const [clientId, setClientId] = useState<string>(
    project.clientId?.toString() ?? "",
  );
  const [chefProjetId, setChefProjetId] = useState<string>(
    project.chefProjetId?.toString() ?? "",
  );
  const [dealId, setDealId] = useState<string>(
    project.dealId?.toString() ?? "",
  );

  useEffect(() => {
    if (open) {
      setStatut(project.statut);
      setClientId(project.clientId?.toString() ?? "");
      setChefProjetId(project.chefProjetId?.toString() ?? "");
      setDealId(project.dealId?.toString() ?? "");
    }
  }, [open, project]);

  const statutLabels: Record<string, string> = { en_attente: "En attente", en_cours: "En cours", termine: "Terminé" };
  const clientLabel = clientId ? clients.find((c) => String(c.id) === clientId)?.name ?? "Aucun" : "Aucun";
  const chefLabel = chefProjetId ? users.find((u) => String(u.id) === chefProjetId)?.name ?? "Aucun" : "Aucun";
  const dealLabel = dealId ? deals.find((d) => String(d.id) === dealId)?.titre ?? "Aucun" : "Aucun";

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("statut", statut);
    if (clientId) formData.set("clientId", clientId);
    if (chefProjetId) formData.set("chefProjetId", chefProjetId);
    if (dealId) formData.set("dealId", dealId);

    startTransition(async () => {
      await updateProject(project.id, formData);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le projet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              name="titre"
              defaultValue={project.titre}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={project.description ?? ""}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={statut}
                onValueChange={(v) => setStatut(v ?? "en_attente")}
              >
                <SelectTrigger>
                  {statutLabels[statut] ?? statut}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="termine">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={clientId}
                onValueChange={(v) => setClientId(v ?? "")}
              >
                <SelectTrigger>
                  {clientLabel}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Chef de projet</Label>
              <Select
                value={chefProjetId}
                onValueChange={(v) => setChefProjetId(v ?? "")}
              >
                <SelectTrigger>
                  {chefLabel}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Deal associé</Label>
              <Select
                value={dealId}
                onValueChange={(v) => setDealId(v ?? "")}
              >
                <SelectTrigger>
                  {dealLabel}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.titre}
                      {d.montantFinal !== null && (
                        <span className="text-muted-foreground ml-1">
                          ({formatCurrency(d.montantFinal)})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budgetTotal">Budget total (€)</Label>
              <Input
                id="budgetTotal"
                name="budgetTotal"
                type="number"
                min={0}
                step="0.01"
                defaultValue={project.budgetTotal}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joursVendus">Jours vendus</Label>
              <Input
                id="joursVendus"
                name="joursVendus"
                type="number"
                min={0}
                step="0.5"
                defaultValue={project.joursVendus ?? ""}
                placeholder="Ex: 25"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date de début</Label>
              <Input
                id="dateDebut"
                name="dateDebut"
                type="date"
                defaultValue={project.dateDebut?.split("T")[0] ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                defaultValue={project.deadline?.split("T")[0] ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="githubUrl">GitHub URL</Label>
              <Input
                id="githubUrl"
                name="githubUrl"
                type="url"
                placeholder="https://github.com/..."
                defaultValue={project.githubUrl ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="figmaUrl">Figma URL</Label>
              <Input
                id="figmaUrl"
                name="figmaUrl"
                type="url"
                placeholder="https://figma.com/..."
                defaultValue={project.figmaUrl ?? ""}
              />
            </div>
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
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
