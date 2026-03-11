"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { ProjectDialog } from "./project-dialog";

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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        <Pencil className="mr-1.5 h-4 w-4" />
        Modifier
      </Button>
      <ProjectDialog
        project={project}
        clients={clients}
        users={users}
        deals={deals}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
