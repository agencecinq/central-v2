"use client";

import { GanttChart } from "@/app/(app)/projets/[id]/gantt-chart";

interface PhaseItem {
  id: number;
  metierId: number;
  metierNom: string;
  joursPrevus: number;
  dateDebut: string | null;
  dateFin: string | null;
}

interface Task {
  id: number;
  titre: string;
  description: string | null;
  statutKanban: string;
  categorie: string | null;
  priorityLevel: number;
  estimationHeures: number | null;
  dateEcheance: string | null;
  dateDebut: string | null;
  allocationId: number | null;
  assignee: string | null;
  userId: number | null;
  isOutOfScope: boolean;
}

export function ClientGantt({
  phases,
  tasks,
}: {
  phases: PhaseItem[];
  tasks: Task[];
}) {
  return <GanttChart phases={phases} tasks={tasks} onTaskClick={() => {}} />;
}
