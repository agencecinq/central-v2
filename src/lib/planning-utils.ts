// ─── Planning utilities (shared between charge-de-travail and disponibilite-equipe) ─

export interface WeekData {
  key: string; // "2026-03-09" (lundi)
  label: string; // "10 mar"
  monthLabel: string; // "mars 2026"
  monday: Date;
}

/** Retourne le lundi de la semaine d'une date */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Format a monday Date into a weekKey string */
export function toWeekKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Génère les 12 prochaines semaines à partir de cette semaine */
export function getNext12Weeks(): WeekData[] {
  const today = new Date();
  let monday = getMonday(today);
  const weeks: WeekData[] = [];

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
    weeks.push({ key, label, monthLabel, monday: new Date(monday) });
    monday.setDate(monday.getDate() + 7);
  }

  return weeks;
}

/**
 * Distribue joursPrevus linéairement sur les semaines couvertes par le projet.
 * Retourne une map weekKey → joursDansCetteSemaine
 */
export function distributeWeekly(
  joursPrevus: number,
  dateDebut: Date | null,
  dateFin: Date | null,
  weeks: WeekData[],
): Record<string, number> {
  const result: Record<string, number> = {};
  if (joursPrevus <= 0) return result;

  const firstWeekKey = weeks[0].key;
  const lastWeekKey = weeks[weeks.length - 1].key;

  let startKey = firstWeekKey;
  let endKey = lastWeekKey;

  if (dateDebut) {
    startKey = toWeekKey(getMonday(new Date(dateDebut)));
  }
  if (dateFin) {
    endKey = toWeekKey(getMonday(new Date(dateFin)));
  }

  const coveredWeeks = weeks.filter(
    (w) => w.key >= startKey && w.key <= endKey,
  );
  if (coveredWeeks.length === 0) return result;

  let totalProjectWeeks = 1;
  if (dateDebut && dateFin) {
    const sd = getMonday(new Date(dateDebut));
    const ed = getMonday(new Date(dateFin));
    const diffMs = ed.getTime() - sd.getTime();
    totalProjectWeeks = Math.max(
      1,
      Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1,
    );
  } else {
    totalProjectWeeks = coveredWeeks.length;
  }

  const joursParSemaine = joursPrevus / totalProjectWeeks;

  for (const w of coveredWeeks) {
    result[w.key] = joursParSemaine;
  }

  return result;
}
