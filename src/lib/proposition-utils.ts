import {
  Zap,
  Shield,
  Users,
  Calendar,
  ClipboardList,
  LifeBuoy,
  Euro,
  CheckCircle,
  Rocket,
  Star,
  Target,
  TrendingUp,
  Clock,
  Briefcase,
  Heart,
  Award,
  Code,
  type LucideIcon,
} from "lucide-react";

// ─── Translations ─────────────────────────────────────────────────────────

const translations: Record<string, Record<string, string>> = {
  fr: {
    jour: "jour",
    jours: "jours",
    semaine: "semaine",
    semaines: "semaines",
    ht: "HT",
    ttc: "TTC",
    tva: "TVA",
    remise: "Remise",
    total_ht: "Total HT",
    total_ttc: "Total TTC",
    total_ht_avant_remise: "Total HT (avant remise globale)",
    remise_globale: "Remise globale",
    montant_remise: "Montant de la remise",
    planning_projet: "Planning du Projet",
    valeur_ajoutee: "Valeur Ajoutée — Bénéfices Clés",
    recapitulatif_financier: "Récapitulatif Financier",
    informations_complementaires: "Informations Complémentaires",
    pret_demarrer: "Prêt à démarrer ?",
    date_debut: "Date de début",
    duree_totale: "Durée totale",
    jusqu_au: "jusqu'au",
    detail_prestations: "Détail des Prestations",
    confidentielle: "Cette proposition commerciale est confidentielle",
    document_genere: "Document généré le",
    reproduction_interdite:
      "Toute reproduction ou diffusion non autorisée est interdite.",
    definir_date_debut:
      "Définissez une date de début pour voir le planning",
    valable_jusqu_au: "Jusqu'au",
    date_proposition: "Date de la proposition",
    reference: "Référence",
    validite_proposition: "Validité de la proposition",
    titre_proposition: "Proposition Commerciale",
    option: "Option",
    total_options: "Total des options",
    gestion_projet: "Gestion de projet",
    gestion_projet_pct: "% des jours de la section",
    nos_references: "Nos Références",
    temoignage: "Témoignage",
  },
  en: {
    jour: "day",
    jours: "days",
    semaine: "week",
    semaines: "weeks",
    ht: "excl. tax",
    ttc: "incl. tax",
    tva: "VAT",
    remise: "Discount",
    total_ht: "Total excl. tax",
    total_ttc: "Total incl. tax",
    total_ht_avant_remise: "Total excl. tax (before global discount)",
    remise_globale: "Global discount",
    montant_remise: "Discount amount",
    planning_projet: "Project Planning",
    valeur_ajoutee: "Value Added — Key Benefits",
    recapitulatif_financier: "Financial Summary",
    informations_complementaires: "Additional Information",
    pret_demarrer: "Ready to start?",
    date_debut: "Start date",
    duree_totale: "Total duration",
    jusqu_au: "until",
    detail_prestations: "Service Details",
    confidentielle: "This commercial proposal is confidential",
    document_genere: "Document generated on",
    reproduction_interdite:
      "Any unauthorized reproduction or distribution is prohibited.",
    definir_date_debut: "Set a start date to view the planning",
    valable_jusqu_au: "Valid until",
    date_proposition: "Proposal date",
    reference: "Reference",
    validite_proposition: "Proposal validity",
    titre_proposition: "Commercial Proposal",
    option: "Option",
    total_options: "Total options",
    gestion_projet: "Project management",
    gestion_projet_pct: "% of section days",
    nos_references: "Our References",
    temoignage: "Testimonial",
  },
};

export type Langue = "fr" | "en";

export function t(langue: Langue, key: string): string {
  return translations[langue]?.[key] ?? translations.fr[key] ?? key;
}

// ─── Currency formatting ──────────────────────────────────────────────────

export function formatMontant(amount: number, devise: string): string {
  const currency = devise === "USD" ? "USD" : "EUR";
  const locale = devise === "USD" ? "en-US" : "fr-FR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Icon mapping ─────────────────────────────────────────────────────────

export const ICON_MAP: Record<string, LucideIcon> = {
  lightning: Zap,
  zap: Zap,
  shield: Shield,
  users: Users,
  calendar: Calendar,
  clipboard: ClipboardList,
  support: LifeBuoy,
  euro: Euro,
  "check-circle": CheckCircle,
  rocket: Rocket,
  star: Star,
  target: Target,
  "trending-up": TrendingUp,
  clock: Clock,
  briefcase: Briefcase,
  heart: Heart,
  award: Award,
  code: Code,
};

export const ICON_OPTIONS = [
  { value: "lightning", label: "Éclair" },
  { value: "shield", label: "Bouclier" },
  { value: "users", label: "Utilisateurs" },
  { value: "calendar", label: "Calendrier" },
  { value: "clipboard", label: "Presse-papier" },
  { value: "support", label: "Support" },
  { value: "euro", label: "Euro" },
  { value: "check-circle", label: "Validé" },
  { value: "rocket", label: "Fusée" },
  { value: "star", label: "Étoile" },
  { value: "target", label: "Cible" },
  { value: "trending-up", label: "Croissance" },
  { value: "clock", label: "Horloge" },
  { value: "briefcase", label: "Mallette" },
  { value: "heart", label: "Cœur" },
  { value: "award", label: "Récompense" },
  { value: "code", label: "Code" },
];

// ─── JSON parse helpers ───────────────────────────────────────────────────

export function parseJsonArray(json: string | null): any[] {
  if (!json) return [];
  try {
    const result = JSON.parse(json);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export function parseJsonObject(json: string | null): Record<string, any> | null {
  if (!json) return null;
  try {
    const result = JSON.parse(json);
    return typeof result === "object" && !Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}
