/**
 * Pure calculation functions for budget / proposition commerciale.
 * Importable from both client and server code.
 */

export interface SousSectionData {
  nombreJours: number;
  tjm: number;
  remise: number; // percentage, e.g. 10 means 10%
}

export interface SectionData {
  estOption: boolean;
  sousSections: SousSectionData[];
}

export interface BudgetData {
  sections: SectionData[];
  remiseGlobale: number; // percentage
  tauxTva: number; // percentage
  tauxGestionProjet: number; // percentage
  tjmGestionProjet: number;
}

export interface SectionTotals {
  totalSousSections: number;
  joursTotal: number;
  joursGestionProjet: number;
  montantGestionProjet: number;
  total: number;
  estOption: boolean;
}

export interface BudgetTotals {
  sections: SectionTotals[];
  totalHT: number;
  totalOptions: number;
  remiseAmount: number;
  totalApresRemise: number;
  tvaAmount: number;
  totalTTC: number;
}

/** Compute total for a single sous-section: jours × TJM × (1 - remise/100) */
export function computeSousSectionTotal(ss: SousSectionData): number {
  return ss.nombreJours * ss.tjm * (1 - ss.remise / 100);
}

/** Compute all budget totals from raw data */
export function computeBudgetTotals(budget: BudgetData): BudgetTotals {
  const sectionTotals: SectionTotals[] = budget.sections.map((section) => {
    const joursTotal = section.sousSections.reduce(
      (sum, ss) => sum + ss.nombreJours,
      0,
    );

    const totalSousSections = section.sousSections.reduce(
      (sum, ss) => sum + computeSousSectionTotal(ss),
      0,
    );

    // Gestion de projet: round(totalJours × taux/100, 2) × TJM gestion
    const joursGestionProjet =
      Math.round(joursTotal * (budget.tauxGestionProjet / 100) * 100) / 100;
    const montantGestionProjet = joursGestionProjet * budget.tjmGestionProjet;

    const total = totalSousSections + montantGestionProjet;

    return {
      totalSousSections,
      joursTotal,
      joursGestionProjet,
      montantGestionProjet,
      total,
      estOption: section.estOption,
    };
  });

  // Total HT = sum of non-option sections
  const totalHT = sectionTotals
    .filter((s) => !s.estOption)
    .reduce((sum, s) => sum + s.total, 0);

  // Options = sum of est_option sections
  const totalOptions = sectionTotals
    .filter((s) => s.estOption)
    .reduce((sum, s) => sum + s.total, 0);

  // Global discount
  const remiseAmount = totalHT * (budget.remiseGlobale / 100);
  const totalApresRemise = totalHT - remiseAmount;

  // TVA
  const tvaAmount = totalApresRemise * (budget.tauxTva / 100);
  const totalTTC = totalApresRemise + tvaAmount;

  return {
    sections: sectionTotals,
    totalHT,
    totalOptions,
    remiseAmount,
    totalApresRemise,
    tvaAmount,
    totalTTC,
  };
}

/** Format a number as EUR currency (fr-FR) */
export function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}
