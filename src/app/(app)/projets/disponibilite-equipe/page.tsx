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
        date: toWeekKey(dayDate), // reuse YYYY-MM-DD format
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

  // Date range for slot query
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
    select: { id: true, titre: true },
    orderBy: { titre: "asc" },
  });

  // Existing half-day slots
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

  // Build slot map: userId → "YYYY-MM-DD_AM" → { projectId, projectTitre }
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

  // Team with data
  const people = teamUsers.map((u) => ({
    id: u.id,
    name: u.name,
    metiers: u.userMetiers.map((um) => um.metier.nom),
    slots: slotMap[u.id] ?? {},
  }));

  // KPIs
  const totalSlots = weeks.length * 10 * people.length; // 10 half-days per week
  const usedSlots = slots.length;
  const tauxOccupation =
    totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

  return {
    weeks,
    people,
    projects,
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
          Planification par demi-journée — cliquez sur une cellule pour
          assigner un projet
        </p>
      </div>

      <AvailabilityGrid
        weeks={data.weeks}
        people={data.people}
        projects={data.projects}
        kpis={data.kpis}
      />
    </div>
  );
}
