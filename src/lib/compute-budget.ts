import { prisma } from "@/lib/prisma";

interface BudgetBreakdown {
  total: number;
  depenses: number;
  temps: number;
}

/**
 * Calcule dynamiquement le budget consommé pour un ensemble de projets.
 *
 * Budget consommé = dépenses (transactions type "depense") + temps passé (time entries × TJM).
 *
 * Formule temps :
 *   - unite "jours" → duree × tjm
 *   - unite "heures" → (duree / 8) × tjm
 *
 * Les utilisateurs sans TJM comptent 0 €.
 */
export async function computeBudgetConsomme(
  projectIds: number[],
): Promise<Map<number, BudgetBreakdown>> {
  if (projectIds.length === 0) return new Map();

  // 1. Somme des dépenses par projet
  const expenseGroups = await prisma.transaction.groupBy({
    by: ["projectId"],
    where: {
      type: "depense",
      projectId: { in: projectIds },
    },
    _sum: { montant: true },
  });

  // 2. Time entries avec TJM utilisateur
  const timeEntries = await prisma.timeEntry.findMany({
    where: { projectId: { in: projectIds } },
    select: {
      projectId: true,
      duree: true,
      unite: true,
      user: { select: { tjm: true } },
    },
  });

  // 3. Construire le résultat
  const result = new Map<number, BudgetBreakdown>();

  // Initialiser tous les projets demandés
  for (const id of projectIds) {
    result.set(id, { total: 0, depenses: 0, temps: 0 });
  }

  // Ajouter les dépenses
  for (const group of expenseGroups) {
    if (group.projectId == null) continue;
    const entry = result.get(group.projectId)!;
    entry.depenses = Number(group._sum.montant ?? 0);
  }

  // Ajouter les coûts temps
  for (const te of timeEntries) {
    if (te.projectId == null) continue;
    const tjm = te.user.tjm ? Number(te.user.tjm) : 0;
    if (tjm === 0) continue;

    const duree = Number(te.duree);
    const cost = te.unite === "jours" ? duree * tjm : (duree / 8) * tjm;

    const entry = result.get(te.projectId)!;
    entry.temps += cost;
  }

  // Calculer les totaux
  for (const [, breakdown] of result) {
    breakdown.total = breakdown.depenses + breakdown.temps;
  }

  return result;
}
