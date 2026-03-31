import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getNext12Weeks, distributeWeekly } from "@/lib/planning-utils";
import { PersonPlanningView } from "./person-planning-view";

// ─── Types ────────────────────────────────────────────────

interface ProjectCharge {
  projectId: number;
  projectTitre: string;
  jours: number;
}

interface PersonRow {
  userId: number;
  userName: string;
  metiers: string[];
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

async function getPersonAvailabilityData() {
  const weeks = getNext12Weeks();

  // 1. Team members with their métiers
  const teamUsers = await prisma.user.findMany({
    where: { role: { in: ["admin", "equipe"] } },
    select: {
      id: true,
      name: true,
      userMetiers: { select: { metierId: true, metier: { select: { nom: true } } } },
    },
    orderBy: { name: "asc" },
  });

  // 2. Build map: metierId → userIds (for legacy allocation distribution)
  const metierToUsers = new Map<number, number[]>();
  for (const user of teamUsers) {
    for (const um of user.userMetiers) {
      const arr = metierToUsers.get(um.metierId) ?? [];
      arr.push(user.id);
      metierToUsers.set(um.metierId, arr);
    }
  }

  // 3. Active project allocations
  const allocations = await prisma.projectAllocation.findMany({
    where: { project: { statut: "en_cours" } },
    include: {
      project: { select: { id: true, titre: true, dateDebut: true, dateFin: true, deadline: true } },
      metier: { select: { id: true, nom: true } },
      user: { select: { id: true } },
    },
  });

  // 4. Build per-person rows
  const personRows: PersonRow[] = teamUsers.map((u) => {
    const row: PersonRow = {
      userId: u.id,
      userName: u.name,
      metiers: u.userMetiers.map((um) => um.metier.nom),
      capaciteHebdo: 5,
      weeks: {},
    };
    for (const w of weeks) {
      row.weeks[w.key] = { charge: 0, dispo: 5, projects: [] };
    }
    return row;
  });

  const personMap = new Map(personRows.map((r) => [r.userId, r]));

  // 5. Distribute allocations
  for (const alloc of allocations) {
    const joursPrevus = Number(alloc.joursPrevus);
    if (joursPrevus <= 0) continue;

    const dateDebut = alloc.dateDebut ?? alloc.project.dateDebut ?? null;
    const dateFin = alloc.dateFin ?? alloc.project.dateFin ?? alloc.project.deadline ?? null;

    if (alloc.userId) {
      // Assigned to a specific person
      const person = personMap.get(alloc.userId);
      if (!person) continue;

      const distribution = distributeWeekly(joursPrevus, dateDebut, dateFin, weeks);
      for (const [weekKey, jours] of Object.entries(distribution)) {
        const weekData = person.weeks[weekKey];
        if (weekData) {
          weekData.charge += jours;
          weekData.dispo = person.capaciteHebdo - weekData.charge;
          const existing = weekData.projects.find((p) => p.projectId === alloc.project.id);
          if (existing) {
            existing.jours += jours;
          } else {
            weekData.projects.push({
              projectId: alloc.project.id,
              projectTitre: alloc.project.titre,
              jours,
            });
          }
        }
      }
    } else {
      // Legacy: distribute evenly among users with this métier
      const usersWithMetier = metierToUsers.get(alloc.metier.id) ?? [];
      if (usersWithMetier.length === 0) continue;

      const sharePerPerson = joursPrevus / usersWithMetier.length;
      const distribution = distributeWeekly(sharePerPerson, dateDebut, dateFin, weeks);

      for (const userId of usersWithMetier) {
        const person = personMap.get(userId);
        if (!person) continue;

        for (const [weekKey, jours] of Object.entries(distribution)) {
          const weekData = person.weeks[weekKey];
          if (weekData) {
            weekData.charge += jours;
            weekData.dispo = person.capaciteHebdo - weekData.charge;
            const existing = weekData.projects.find((p) => p.projectId === alloc.project.id);
            if (existing) {
              existing.jours += jours;
            } else {
              weekData.projects.push({
                projectId: alloc.project.id,
                projectTitre: alloc.project.titre,
                jours,
              });
            }
          }
        }
      }
    }
  }

  // 6. Summary row
  const summaryRow: SummaryRow = {
    capaciteHebdo: personRows.length * 5,
    weeks: {},
  };
  for (const w of weeks) {
    let totalCharge = 0;
    for (const person of personRows) {
      totalCharge += person.weeks[w.key]?.charge ?? 0;
    }
    summaryRow.weeks[w.key] = {
      charge: totalCharge,
      dispo: summaryRow.capaciteHebdo - totalCharge,
    };
  }

  // 7. KPIs
  const totalCapacity12 = personRows.length * 5 * 12;
  let totalCharge12 = 0;
  let semainesEnSurcharge = 0;
  for (const w of weeks) {
    const weekCharge = summaryRow.weeks[w.key].charge;
    totalCharge12 += weekCharge;
    if (weekCharge > summaryRow.capaciteHebdo) semainesEnSurcharge++;
  }
  const tauxOccupation = totalCapacity12 > 0 ? Math.round((totalCharge12 / totalCapacity12) * 100) : 0;
  const totalDispo12 = Math.max(0, totalCapacity12 - totalCharge12);

  return {
    weeks: weeks.map((w) => ({ key: w.key, label: w.label, monthLabel: w.monthLabel })),
    personRows: personRows.map((r) => ({
      ...r,
      weeks: Object.fromEntries(
        Object.entries(r.weeks).map(([k, v]) => [
          k,
          { charge: Math.round(v.charge * 10) / 10, dispo: Math.round(v.dispo * 10) / 10, projects: v.projects.map((p) => ({ ...p, jours: Math.round(p.jours * 10) / 10 })) },
        ]),
      ),
    })),
    summaryRow: {
      ...summaryRow,
      weeks: Object.fromEntries(
        Object.entries(summaryRow.weeks).map(([k, v]) => [
          k,
          { charge: Math.round(v.charge * 10) / 10, dispo: Math.round(v.dispo * 10) / 10 },
        ]),
      ),
    },
    kpis: {
      totalPersonnes: personRows.length,
      capaciteHebdo: summaryRow.capaciteHebdo,
      tauxOccupation,
      totalDispoSur12Sem: Math.round(totalDispo12 * 10) / 10,
      semainesEnSurcharge,
    },
  };
}

// ─── Page ─────────────────────────────────────────────────

export default async function DisponibiliteEquipePage() {
  const data = await getPersonAvailabilityData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Disponibilité équipe
          </h2>
          <p className="mt-1 text-muted-foreground">
            Charge par personne sur 12 semaines
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          <Link
            href="/projets/charge-de-travail"
            className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            Par métier
          </Link>
          <span className="px-3 py-1.5 text-sm rounded-md bg-accent text-accent-foreground font-medium">
            Par personne
          </span>
        </div>
      </div>

      <PersonPlanningView
        weeks={data.weeks}
        personRows={data.personRows}
        summaryRow={data.summaryRow}
        kpis={data.kpis}
      />
    </div>
  );
}
