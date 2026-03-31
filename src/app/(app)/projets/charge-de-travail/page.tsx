import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getNext12Weeks,
  distributeWeekly,
  type WeekData,
} from "@/lib/planning-utils";
import { PlanningView } from "./planning-view";

// ─── Types ────────────────────────────────────────────────

interface ProjectCharge {
  projectId: number;
  projectTitre: string;
  jours: number;
}

interface MetierRow {
  metierId: number;
  metierNom: string;
  nbPersonnes: number;
  capaciteHebdo: number;
  weeks: Record<
    string,
    { charge: number; dispo: number; projects: ProjectCharge[] }
  >;
}

interface SummaryRow {
  capaciteHebdo: number;
  weeks: Record<string, { charge: number; dispo: number }>;
}

// ─── Data fetching ────────────────────────────────────────

async function getWorkloadData() {
  const weeks = getNext12Weeks();

  // Compter les users (admin/équipe) par métier via la table de jointure
  const userMetiers = await prisma.userMetier.findMany({
    where: {
      user: { role: { in: ["admin", "equipe"] } },
    },
    select: { metierId: true },
  });

  const usersCountByMetier = new Map<number, number>();
  for (const um of userMetiers) {
    usersCountByMetier.set(um.metierId, (usersCountByMetier.get(um.metierId) ?? 0) + 1);
  }

  // Tous les métiers qui ont au moins un user
  const metiers = await prisma.metier.findMany({
    where: { id: { in: [...usersCountByMetier.keys()] } },
    orderBy: { nom: "asc" },
  });

  // Toutes les phases (allocations) de projets actifs
  const phases = await prisma.projectAllocation.findMany({
    where: {
      project: { statut: "en_cours" },
    },
    include: {
      project: { select: { id: true, titre: true, dateDebut: true, dateFin: true, deadline: true } },
      metier: { select: { id: true, nom: true } },
    },
  });

  // Construire les données par métier
  const metierRows: MetierRow[] = [];

  for (const metier of metiers) {
    const nbPersonnes = usersCountByMetier.get(metier.id) ?? 0;
    if (nbPersonnes === 0) continue;

    const capaciteHebdo = nbPersonnes * 5;

    const row: MetierRow = {
      metierId: metier.id,
      metierNom: metier.nom,
      nbPersonnes,
      capaciteHebdo,
      weeks: {},
    };

    // Initialiser les semaines
    for (const w of weeks) {
      row.weeks[w.key] = { charge: 0, dispo: capaciteHebdo, projects: [] };
    }

    // Pour chaque phase de ce métier
    const metierPhases = phases.filter((p) => p.metier.id === metier.id);
    for (const phase of metierPhases) {
      // Les dates de la phase priment ; fallback sur les dates du projet
      const dateDebut = phase.dateDebut ?? phase.project.dateDebut;
      const dateFin = phase.dateFin ?? phase.project.dateFin ?? phase.project.deadline;

      const distribution = distributeWeekly(
        Number(phase.joursPrevus),
        dateDebut,
        dateFin,
        weeks,
      );

      for (const [weekKey, jours] of Object.entries(distribution)) {
        if (row.weeks[weekKey]) {
          row.weeks[weekKey].charge += jours;
          row.weeks[weekKey].dispo = capaciteHebdo - row.weeks[weekKey].charge;
          // Grouper par projet dans la même cellule
          const existing = row.weeks[weekKey].projects.find(
            (p) => p.projectId === phase.project.id,
          );
          if (existing) {
            existing.jours += jours;
          } else {
            row.weeks[weekKey].projects.push({
              projectId: phase.project.id,
              projectTitre: phase.project.titre,
              jours,
            });
          }
        }
      }
    }

    metierRows.push(row);
  }

  // Ligne résumé global (toutes métiers confondues)
  const totalCapaciteHebdo = metierRows.reduce((s, r) => s + r.capaciteHebdo, 0);
  const summaryRow: SummaryRow = {
    capaciteHebdo: totalCapaciteHebdo,
    weeks: {},
  };
  for (const w of weeks) {
    let totalCharge = 0;
    for (const r of metierRows) {
      totalCharge += r.weeks[w.key]?.charge ?? 0;
    }
    summaryRow.weeks[w.key] = {
      charge: totalCharge,
      dispo: totalCapaciteHebdo - totalCharge,
    };
  }

  // KPIs
  const totalPersonnes = metierRows.reduce((s, r) => s + r.nbPersonnes, 0);
  const weekValues = Object.values(summaryRow.weeks);
  const tauxOccupationMoyen =
    totalCapaciteHebdo > 0 && weekValues.length > 0
      ? weekValues.reduce((s, w) => s + w.charge, 0) /
        (totalCapaciteHebdo * weekValues.length)
      : 0;
  const totalDispoSur12Sem = weekValues.reduce((s, w) => s + Math.max(0, w.dispo), 0);
  const semainesEnSurcharge = weekValues.filter((w) => w.dispo < 0).length;

  // Semaines sérialisables (sans Date)
  const weeksForClient = weeks.map((w) => ({
    key: w.key,
    label: w.label,
    monthLabel: w.monthLabel,
  }));

  return {
    weeks: weeksForClient,
    metierRows,
    summaryRow,
    kpis: {
      totalPersonnes,
      capaciteHebdo: totalCapaciteHebdo,
      tauxOccupation: Math.round(tauxOccupationMoyen * 100),
      totalDispoSur12Sem,
      semainesEnSurcharge,
    },
  };
}

// ─── Page ─────────────────────────────────────────────────

export default async function ChargeDeTravailPage() {
  const { weeks, metierRows, summaryRow, kpis } = await getWorkloadData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/projets"
            className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Disponibilité
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Vue hebdomadaire de la disponibilité par métier sur 12 semaines.
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          <span className="px-3 py-1.5 text-sm rounded-md bg-accent text-accent-foreground font-medium">
            Par métier
          </span>
          <Link
            href="/projets/disponibilite-equipe"
            className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            Par personne
          </Link>
        </div>
      </div>

      <PlanningView
        weeks={weeks}
        metierRows={metierRows}
        summaryRow={summaryRow}
        kpis={kpis}
      />
    </div>
  );
}
