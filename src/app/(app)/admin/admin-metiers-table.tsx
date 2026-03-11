"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createMetier, updateMetier, deleteMetier } from "./actions";

interface MetierItem {
  id: number;
  nom: string;
}

export function AdminMetiersTable({ metiers }: { metiers: MetierItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [newNom, setNewNom] = useState("");

  function handleAdd() {
    if (!newNom.trim()) return;
    startTransition(async () => {
      await createMetier(newNom.trim());
      setNewNom("");
    });
  }

  function handleRename(id: number, nom: string) {
    if (!nom.trim()) return;
    startTransition(async () => {
      await updateMetier(id, nom);
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteMetier(id);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Métiers ({metiers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Nom</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {metiers.map((m) => (
                <MetierRow
                  key={m.id}
                  metier={m}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  disabled={isPending}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Input
            value={newNom}
            onChange={(e) => setNewNom(e.target.value)}
            placeholder="Nouveau métier..."
            className="h-8 max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            disabled={isPending}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={isPending || !newNom.trim()}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MetierRow({
  metier,
  onRename,
  onDelete,
  disabled,
}: {
  metier: MetierItem;
  onRename: (id: number, nom: string) => void;
  onDelete: (id: number) => void;
  disabled: boolean;
}) {
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.target.value.trim();
    if (val && val !== metier.nom) {
      onRename(metier.id, val);
    }
  }

  return (
    <tr className={`border-b last:border-0 ${disabled ? "opacity-50" : ""}`}>
      <td className="py-2 pr-4">
        <Input
          defaultValue={metier.nom}
          onBlur={handleBlur}
          className="h-7 max-w-xs"
          disabled={disabled}
        />
      </td>
      <td className="py-2">
        <button
          onClick={() => onDelete(metier.id)}
          disabled={disabled}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
