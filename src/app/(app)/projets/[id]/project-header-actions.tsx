"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { ProjectDialog } from "./project-dialog";
import { DeleteDialog } from "./delete-dialog";
import { deleteProject } from "./actions";

interface ProjectData {
  id: number;
  titre: string;
  description: string | null;
  statut: string;
  clientId: number | null;
  chefProjetId: number | null;
  dealId: number | null;
  budgetTotal: number;
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

export function ProjectHeaderActions({
  project,
  clients,
  users,
  deals,
}: {
  project: ProjectData;
  clients: ClientOption[];
  users: UserOption[];
  deals: DealOption[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" />
          Modifier
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Supprimer
        </Button>
      </div>
      <ProjectDialog
        project={project}
        clients={clients}
        users={users}
        deals={deals}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer le projet"
        description={`Êtes-vous sûr de vouloir supprimer "${project.titre}" ? Toutes les tâches, tickets, transactions et entrées de temps associées seront définitivement supprimées.`}
        onConfirm={() => deleteProject(project.id)}
      />
    </>
  );
}
