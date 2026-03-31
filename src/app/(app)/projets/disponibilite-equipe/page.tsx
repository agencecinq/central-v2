import { prisma } from "@/lib/prisma";
import { getMonday, toWeekKey } from "@/lib/planning-utils";
import { AvailabilityGrid } from "./availability-grid";

// ─── Helpers ─────────────────────────────────────────────

function getNext12WeeksWithDays() {
  const today = new Date();
  let monday = getMonday(today);
  const weeks: {
    key: string;
    label: string;
    monthLabel: string;
    days: { date: string; dayLabel: string }[];
  }[] = [];

  for (let i = 0; i < 12; i++) {
    const key = toWeekKey(monday);
    const label = monday.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
    const monthLabel = monday.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });

    const days: { date: string; dayLabel: string }[] = [];
    const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
    for (let d = 0; d < 5; d++) {
      const dayDate = new Date(monday);
      dayDate.setDate(dayDate.getDate() + d);
      days.push({
        date: toWeekKey(dayDate),
        dayLabel: dayNames[d],
      });
    }

    weeks.push({ key, label, monthLabel, days });
    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
  }

  return weeks;
}

// ─── Data ────────────────────────────────────────────────

async function getData() {
  const weeks = getNext12WeeksWithDays();

  const firstDate = new Date(weeks[0].days[0].date);
  const lastWeek = weeks[weeks.length - 1];
  const lastDate = new Date(lastWeek.days[lastWeek.days.length - 1].date);

  // Team members
  const teamUsers = await prisma.user.findMany({
    where: { role: { in: ["admin", "equipe"] } },
    select: {
      id: true,
      name: true,
      userMetiers: {
        select: { metier: { select: { nom: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  // Active projects (for assignment dropdown)
  const projects = await prisma.project.findMany({
    where: { statut: { in: ["en_cours", "en_attente"] } },
    select: { id: true, titre: true, joursVendus: true },
    orderBy: { titre: "asc" },
  });

  // ─── Jours vendus par projet (champ dédié sur le projet) ───
  const joursVendusMap: Record<number, number> = {};
  for (const p of projects) {
    const jv = Number(p.joursVendus ?? 0);
    if (jv > 0) joursVendusMap[p.id] = jv;
  }

  // ─── Jours planifiés par projet (ALL half-day slots, pas juste 12 semaines) ───
  const plannedCounts = await prisma.halfDaySlot.groupBy({
    by: ["projectId"],
    _count: { id: true },
    where: {
      projectId: { in: projects.map((p) => p.id) },
    },
  });

  const joursPlanifiesMap: Record<number, number> = {};
  for (const pc of plannedCounts) {
    joursPlanifiesMap[pc.projectId] = pc._count.id * 0.5; // each slot = 0.5 jour
  }

  // Build project stats
  const projectStats: Record<
    number,
    { vendus: number; planifies: number; restants: number }
  > = {};
  for (const p of projects) {
    const vendus = joursVendusMap[p.id] ?? 0;
    const planifies = joursPlanifiesMap[p.id] ?? 0;
    projectStats[p.id] = {
      vendus: Math.round(vendus * 10) / 10,
      planifies: Math.round(planifies * 10) / 10,
      restants: Math.round((vendus - planifies) * 10) / 10,
    };
  }

  // Existing half-day slots (12 weeks window for the grid)
  const slots = await prisma.halfDaySlot.findMany({
    where: {
      date: { gte: firstDate, lte: lastDate },
      userId: { in: teamUsers.map((u) => u.id) },
    },
    select: {
      userId: true,
      projectId: true,
      date: true,
      period: true,
      project: { select: { id: true, titre: true } },
    },
  });

  // Build slot map
  const slotMap: Record<
    number,
    Record<string, { projectId: number; projectTitre: string }>
  > = {};
  for (const s of slots) {
    if (!slotMap[s.userId]) slotMap[s.userId] = {};
    const dateKey = toWeekKey(s.date);
    slotMap[s.userId][`${dateKey}_${s.period}`] = {
      projectId: s.project.id,
      projectTitre: s.project.titre,
    };
  }

  const people = teamUsers.map((u) => ({
    id: u.id,
    name: u.name,
    metiers: u.userMetiers.map((um) => um.metier.nom),
    slots: slotMap[u.id] ?? {},
  }));

  // KPIs
  const totalSlots = weeks.length * 10 * people.length;
  const usedSlots = slots.length;
  const tauxOccupation =
    totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

  return {
    weeks,
    people,
    projects,
    projectStats,
    kpis: {
      totalPersonnes: people.length,
      totalSlots,
      usedSlots,
      tauxOccupation,
      dispoHalfDays: totalSlots - usedSlots,
    },
  };
}

// ─── Page ────────────────────────────────────────────────

export default async function DisponibiliteEquipePage() {
  const data = await getData();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Disponibilité équipe
        </h2>
        <p className="mt-1 text-muted-foreground">
          Planification par demi-journée — cliquez ou glissez pour assigner un
          projet
        </p>
      </div>

      <AvailabilityGrid
        weeks={data.weeks}
        people={data.people}
        projects={data.projects}
        projectStats={data.projectStats}
        kpis={data.kpis}
      />
    </div>
  );
}
