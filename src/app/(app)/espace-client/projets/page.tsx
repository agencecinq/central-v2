import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/require-client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
};

const statutVariants: Record<string, "default" | "secondary" | "outline"> = {
  en_cours: "default",
  en_attente: "secondary",
  termine: "outline",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ClientProjetsPage() {
  const { projectIds } = await requireClient();

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: {
      tasks: { select: { id: true, statutKanban: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = projects.map((p) => ({
    id: p.id,
    titre: p.titre,
    statut: p.statut,
    dateDebut: p.dateDebut?.toISOString() ?? null,
    deadline: p.deadline?.toISOString() ?? null,
    tasksDone: p.tasks.filter((t) => t.statutKanban === "done").length,
    tasksTotal: p.tasks.length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/espace-client"
          className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Mes projets</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {serialized.length} projet{serialized.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {serialized.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          Aucun projet pour le moment.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Avancement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serialized.map((p) => {
                const pct =
                  p.tasksTotal > 0
                    ? Math.round((p.tasksDone / p.tasksTotal) * 100)
                    : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/espace-client/projets/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.titre}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statutVariants[p.statut] ?? "secondary"}>
                        {statutLabels[p.statut] ?? p.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(p.dateDebut)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(p.deadline)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {p.tasksDone}/{p.tasksTotal}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
