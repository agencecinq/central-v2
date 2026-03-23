// ─── Quest Plan d'exécution 2026 — Données statiques ─────────────────────────

// ─── Manifeste ───────────────────────────────────────────────────────────────

export const QUEST_VISION =
  "CINQ est une agence digitale où il fait bon travailler, où les clients payent le juste prix pour un travail excellent, et où chaque projet est piloté avec rigueur et transparence. L'agence croît par spécialisation, en créant des filiales autonomes plutôt qu'en grossissant. Elle investit dans ses outils, reste à la pointe, et utilise l'IA comme moteur de productivité.";

export const QUEST_PRINCIPES = [
  {
    titre: "Le bien-être des équipes est non négociable",
    description:
      "Charge soutenable, clarté des rôles, autonomie et confiance. Le bien-être n'est pas un avantage RH, c'est une condition de la qualité.",
  },
  {
    titre: "Le client paye le juste prix",
    description:
      "Forfait à scope verrouillé, devis détaillé en amont. La rentabilité est un outil de pilotage, pas une fin en soi.",
  },
  {
    titre: "Chaque projet est piloté avec rigueur",
    description:
      "CinqCentral comme outil central. Process standardisés. Le client voit l'avancement sans avoir à demander.",
  },
  {
    titre: "L'agence investit dans ses propres outils",
    description:
      "Outils développés en interne, réservés aux clients CINQ. Pas de SaaS public — des avantages compétitifs.",
  },
  {
    titre: "Croître par spécialisation, pas par taille",
    description:
      "Un pôle devient filiale quand il finance ≥1 ETP. Structure holding, chaque filiale opère indépendamment.",
  },
  {
    titre: "Rester à la pointe, toujours",
    description:
      "Veille structurée, formation continue, connaissance de l'écosystème. Une agence qui ne veille pas est une agence qui meurt.",
  },
  {
    titre: "L'IA comme moteur de productivité",
    description:
      "Intégrée dans le développement et les process. Chaque usage doit avoir un impact mesurable.",
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuestTask {
  id: string; // format "phase-axe-item" ex: "1-1-1"
  label: string;
  points: number;
}

export interface QuestAxe {
  titre: string;
  tasks: QuestTask[];
}

export interface QuestPhase {
  id: number;
  titre: string;
  sousTitre: string;
  objectif: string;
  periode: string;
  axes: QuestAxe[];
}

export interface QuestBadgeDef {
  id: string;
  label: string;
  emoji: string;
  description: string;
  condition: (completedIds: Set<string>) => boolean;
}

// ─── Phases ──────────────────────────────────────────────────────────────────

export const QUEST_PHASES: QuestPhase[] = [
  {
    id: 1,
    titre: "Les fondations",
    sousTitre: "Phase 1",
    objectif:
      "Poser les bases opérationnelles ET commerciales de l'agence.",
    periode: "Avril – Juin 2026",
    axes: [
      {
        titre: "CinqCentral V2 → Production",
        tasks: [
          { id: "1-1-1", label: "Déployer CinqCentral V2 en production pour l'équipe interne", points: 15 },
          { id: "1-1-2", label: "Suivi de projet : tâches, jalons, temps passé, alertes de dépassement", points: 15 },
          { id: "1-1-3", label: "Espace client : vue lecture seule sur l'avancement", points: 20 },
          { id: "1-1-4", label: "Suivi de rentabilité par projet : temps passé vs forfait vendu", points: 15 },
          { id: "1-1-5", label: "Migrer 100% des projets actifs dans CinqCentral", points: 10 },
        ],
      },
      {
        titre: "Process projet standardisés",
        tasks: [
          { id: "1-2-1", label: "Cartographier les 3-4 types de projets récurrents", points: 10 },
          { id: "1-2-2", label: "Templates de projet dans CinqCentral par type", points: 15 },
          { id: "1-2-3", label: "Playbook de démarrage projet (kickoff → livraison)", points: 10 },
          { id: "1-2-4", label: "Grille de chiffrage forfait documentée", points: 10 },
        ],
      },
      {
        titre: "Bases commerciales",
        tasks: [
          { id: "1-3-1", label: "Offres packagées définies (Shopify, WP, Klaviyo, maintenance)", points: 15 },
          { id: "1-3-2", label: "Supports de vente : deck, one-pagers, grille tarifaire", points: 10 },
          { id: "1-3-3", label: "Cibles prioritaires identifiées par offre", points: 10 },
          { id: "1-3-4", label: "Pipeline commercial en place (suivi prospects)", points: 15 },
          { id: "1-3-5", label: "Réseau existant réactivé (anciens clients, contacts)", points: 10 },
          { id: "1-3-6", label: "Objectif de prospection hebdo défini et tenu", points: 10 },
        ],
      },
      {
        titre: "Communication lancée",
        tasks: [
          { id: "1-4-1", label: "Site CINQ mis à jour (offres, positionnement, cas clients)", points: 15 },
          { id: "1-4-2", label: "Rythme LinkedIn : 1 post/semaine pendant 8+ semaines", points: 20 },
          { id: "1-4-3", label: "2-3 case studies clients publiés", points: 15 },
          { id: "1-4-4", label: "Ligne éditoriale définie", points: 5 },
        ],
      },
      {
        titre: "IA & Veille",
        tasks: [
          { id: "1-5-1", label: "Bibliothèque de prompts partagée (min. 10)", points: 10 },
          { id: "1-5-2", label: "Règle IA-first sur les tâches répétitives", points: 5 },
          { id: "1-5-3", label: "Rituel veille hebdo en place (4+ semaines consécutives)", points: 10 },
        ],
      },
      {
        titre: "Stack technique & composants",
        tasks: [
          { id: "1-6-1", label: "Audit de la stack actuelle Shopify : thème de base, outils, conventions de code", points: 10 },
          { id: "1-6-2", label: "Audit de la stack actuelle WordPress : starter theme, plugins maison, workflow de déploiement", points: 10 },
          { id: "1-6-3", label: "Inventaire des Web Components existants (drawer, tabs, etc.) développés par Jérémy", points: 10 },
          { id: "1-6-4", label: "Définir la stack cible Shopify : thème de base CINQ, conventions Liquid, structure de fichiers", points: 15 },
          { id: "1-6-5", label: "Définir la stack cible WordPress : starter theme CINQ, stack front (build, assets), conventions PHP", points: 15 },
          { id: "1-6-6", label: "Documenter les conventions de code partagées (nommage, structure, revue de code)", points: 10 },
        ],
      },
    ],
  },
  {
    id: 2,
    titre: "L'accélération",
    sousTitre: "Phase 2",
    objectif:
      "Convertir les fondations en croissance. Signer, développer Klaviyo, amplifier.",
    periode: "Juillet – Septembre 2026",
    axes: [
      {
        titre: "Commercial actif",
        tasks: [
          { id: "2-1-1", label: "Outbound structuré : 10-15 contacts qualifiés/semaine", points: 20 },
          { id: "2-1-2", label: "Ciblage marchands Shopify en croissance", points: 10 },
          { id: "2-1-3", label: "Ciblage PME avec sites WP vieillissants", points: 10 },
          { id: "2-1-4", label: "Audits CinqCentral utilisés en avant-vente", points: 15 },
          { id: "2-1-5", label: "Taux de conversion pipeline mesuré et ≥ 20%", points: 15 },
          { id: "2-1-6", label: "Partenariats stratégiques activés", points: 10 },
        ],
      },
      {
        titre: "Klaviyo CRM → Filiale",
        tasks: [
          { id: "2-2-1", label: "Offre Klaviyo lancée (3 tiers de pricing)", points: 15 },
          { id: "2-2-2", label: "Prospection Klaviyo dédiée (upsell + outbound)", points: 15 },
          { id: "2-2-3", label: "3-5 clients Klaviyo en retainer mensuel signés", points: 25 },
          { id: "2-2-4", label: "Certification Klaviyo Partner obtenue", points: 10 },
          { id: "2-2-5", label: "Case studies CRM documentés (ROI, taux d'ouverture)", points: 10 },
        ],
      },
      {
        titre: "Communication amplifiée",
        tasks: [
          { id: "2-3-1", label: "2 posts LinkedIn/semaine + 1 contenu long/mois", points: 15 },
          { id: "2-3-2", label: "Format récurrent testé (newsletter, mini-audit gratuit)", points: 15 },
          { id: "2-3-3", label: "Impact mesuré : quels contenus génèrent des leads ?", points: 10 },
          { id: "2-3-4", label: "Co-publications ou recommandations croisées avec partenaires", points: 10 },
        ],
      },
      {
        titre: "Outils d'analyse CinqCentral",
        tasks: [
          { id: "2-4-1", label: "Module d'audit Shopify intégré (perf, SEO, UX)", points: 20 },
          { id: "2-4-2", label: "Module d'audit WordPress (sécu, perf, accessibilité)", points: 20 },
          { id: "2-4-3", label: "Audits accessibles aux clients via leur espace", points: 10 },
        ],
      },
      {
        titre: "Charge maîtrisée",
        tasks: [
          { id: "2-5-1", label: "Monitoring charge/personne via CinqCentral", points: 10 },
          { id: "2-5-2", label: "Plafond projets parallèles défini par personne", points: 5 },
          { id: "2-5-3", label: "Point d'équipe mensuel charge & bien-être en place", points: 10 },
        ],
      },
      {
        titre: "Bibliothèque de composants",
        tasks: [
          { id: "2-6-1", label: "Bibliothèque de Web Components CINQ : drawer, tabs, modal, accordion, toast notifications", points: 20 },
          { id: "2-6-2", label: "Starter theme Shopify CINQ opérationnel et utilisé sur un projet réel", points: 20 },
          { id: "2-6-3", label: "Starter theme WordPress CINQ opérationnel et utilisé sur un projet réel", points: 20 },
          { id: "2-6-4", label: "Documentation technique des composants (usage, props, exemples)", points: 10 },
          { id: "2-6-5", label: "Repo Git structuré avec versionning et changelog", points: 10 },
        ],
      },
    ],
  },
  {
    id: 3,
    titre: "La structuration",
    sousTitre: "Phase 3",
    objectif:
      "Filialiser Klaviyo, pérenniser la machine commerciale, préparer 2027.",
    periode: "Octobre 2026 – Mars 2027",
    axes: [
      {
        titre: "Filiale Klaviyo CRM Agency",
        tasks: [
          { id: "3-1-1", label: "Statut juridique et montage décidés", points: 15 },
          { id: "3-1-2", label: "Structure juridique créée", points: 20 },
          { id: "3-1-3", label: "P&L autonome défini (rentabilité seule)", points: 15 },
          { id: "3-1-4", label: "Personne dédiée ou recrutée", points: 20 },
          { id: "3-1-5", label: "Identité propre lancée (nom, site, positionnement)", points: 15 },
        ],
      },
      {
        titre: "Commercial pérenne",
        tasks: [
          { id: "3-2-1", label: "Rituel commercial hebdo installé (revue pipeline, relances)", points: 10 },
          { id: "3-2-2", label: "Automatisations : séquences relance, alertes CinqCentral", points: 15 },
          { id: "3-2-3", label: "Inbound fonctionnel : contenus et audits génèrent des leads", points: 20 },
          { id: "3-2-4", label: "Réseau apporteurs d'affaires formalisé", points: 10 },
          { id: "3-2-5", label: "Coût d'acquisition client mesuré par canal", points: 15 },
        ],
      },
      {
        titre: "Communication à maturité",
        tasks: [
          { id: "3-3-1", label: "Rythme maintenu (2 posts/sem + 1 contenu long/mois)", points: 10 },
          { id: "3-3-2", label: "Contenus optimisés (stop ce qui ne marche pas)", points: 10 },
          { id: "3-3-3", label: "Communication filiale Klaviyo lancée", points: 15 },
        ],
      },
      {
        titre: "Consolidation opérationnelle",
        tasks: [
          { id: "3-4-1", label: "Bilan rentabilité par projet sur 6 mois", points: 15 },
          { id: "3-4-2", label: "Grilles de chiffrage ajustées avec données réelles", points: 10 },
          { id: "3-4-3", label: "Types de projets les plus rentables identifiés", points: 10 },
          { id: "3-4-4", label: "Audit interne des process réalisé", points: 10 },
        ],
      },
      {
        titre: "Préparer 2027",
        tasks: [
          { id: "3-5-1", label: "Objectifs financiers 2027 par entité", points: 15 },
          { id: "3-5-2", label: "Prochaine filiale candidate évaluée", points: 10 },
          { id: "3-5-3", label: "Décision recrutement CINQ prise", points: 10 },
          { id: "3-5-4", label: "CinqCentral V2.5 + automatisation IA", points: 15 },
          { id: "3-5-5", label: "Dashboard pilotage agence opérationnel", points: 15 },
        ],
      },
      {
        titre: "Stack industrialisée",
        tasks: [
          { id: "3-6-1", label: "Bilan d'usage des starters themes sur les projets des 6 derniers mois", points: 10 },
          { id: "3-6-2", label: "V2 des starters themes intégrant les retours terrain", points: 15 },
          { id: "3-6-3", label: "Bibliothèque de composants étendue : 10+ Web Components documentés et testés", points: 15 },
          { id: "3-6-4", label: "Temps de setup d'un nouveau projet réduit de 50% grâce à la stack CINQ", points: 15 },
          { id: "3-6-5", label: "Contribution open-source envisagée ou lancée", points: 10 },
        ],
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get all task IDs for a given phase */
function phaseTaskIds(phaseId: number): string[] {
  const phase = QUEST_PHASES.find((p) => p.id === phaseId);
  if (!phase) return [];
  return phase.axes.flatMap((a) => a.tasks.map((t) => t.id));
}

/** Get all task IDs for a given axe (phase-axe 1-indexed) */
function axeTaskIds(phaseId: number, axeIndex: number): string[] {
  const phase = QUEST_PHASES.find((p) => p.id === phaseId);
  if (!phase || !phase.axes[axeIndex - 1]) return [];
  return phase.axes[axeIndex - 1].tasks.map((t) => t.id);
}

/** Check if all given IDs are in the set */
function allComplete(ids: string[], set: Set<string>): boolean {
  return ids.every((id) => set.has(id));
}

/** Count completed in set from a list */
function countComplete(ids: string[], set: Set<string>): number {
  return ids.filter((id) => set.has(id)).length;
}

// ─── All task IDs (flat) ─────────────────────────────────────────────────────

export const ALL_TASK_IDS = QUEST_PHASES.flatMap((p) =>
  p.axes.flatMap((a) => a.tasks.map((t) => t.id)),
);

export const TOTAL_POINTS = QUEST_PHASES.reduce(
  (sum, p) => sum + p.axes.reduce((s, a) => s + a.tasks.reduce((ss, t) => ss + t.points, 0), 0),
  0,
);

// ─── Badges ──────────────────────────────────────────────────────────────────

export const QUEST_BADGES: QuestBadgeDef[] = [
  {
    id: "first-blood",
    label: "First Blood",
    emoji: "\u26A1",
    description: "Compléter une première tâche",
    condition: (s) => s.size >= 1,
  },
  {
    id: "decollage",
    label: "Décollage",
    emoji: "\uD83D\uDEEB",
    description: "10+ tâches Phase 1 complétées",
    condition: (s) => countComplete(phaseTaskIds(1), s) >= 10,
  },
  {
    id: "cinqcentral-live",
    label: "CinqCentral Live",
    emoji: "\uD83D\uDDA5\uFE0F",
    description: "Toutes les tâches CinqCentral V2 complétées",
    condition: (s) => allComplete(axeTaskIds(1, 1), s),
  },
  {
    id: "prets-a-vendre",
    label: "Prêts à vendre",
    emoji: "\uD83D\uDCBC",
    description: "Toutes les bases commerciales posées",
    condition: (s) => allComplete(axeTaskIds(1, 3), s),
  },
  {
    id: "on-existe",
    label: "On existe",
    emoji: "\uD83D\uDCE3",
    description: "Site + case studies + LinkedIn",
    condition: (s) => ["1-4-1", "1-4-2", "1-4-3"].every((id) => s.has(id)),
  },
  {
    id: "architecte",
    label: "Architecte",
    emoji: "\uD83E\uDDF1",
    description: "Stack cible Shopify + WP définies",
    condition: (s) => ["1-6-4", "1-6-5"].every((id) => s.has(id)),
  },
  {
    id: "fondations-solides",
    label: "Fondations solides",
    emoji: "\uD83C\uDFD7\uFE0F",
    description: "Phase 1 complète à 100%",
    condition: (s) => allComplete(phaseTaskIds(1), s),
  },
  {
    id: "klaviyo-machine",
    label: "Klaviyo Machine",
    emoji: "\uD83D\uDCE7",
    description: "Clients Klaviyo signés",
    condition: (s) => s.has("2-2-3"),
  },
  {
    id: "armes-de-vente",
    label: "Armes de vente",
    emoji: "\uD83D\uDD0D",
    description: "Modules audit Shopify + WP opérationnels",
    condition: (s) => ["2-4-1", "2-4-2"].every((id) => s.has(id)),
  },
  {
    id: "component-master",
    label: "Component Master",
    emoji: "\u2699\uFE0F",
    description: "Bibliothèque Web Components + doc",
    condition: (s) => ["2-6-1", "2-6-4"].every((id) => s.has(id)),
  },
  {
    id: "starters-en-prod",
    label: "Starters en prod",
    emoji: "\uD83C\uDFA8",
    description: "Starters themes Shopify + WP en production",
    condition: (s) => ["2-6-2", "2-6-3"].every((id) => s.has(id)),
  },
  {
    id: "acceleration-terminee",
    label: "Accélération terminée",
    emoji: "\uD83D\uDE80",
    description: "Phase 2 complète à 100%",
    condition: (s) => allComplete(phaseTaskIds(2), s),
  },
  {
    id: "premiere-filiale",
    label: "Première filiale",
    emoji: "\uD83C\uDFDB\uFE0F",
    description: "Structure juridique Klaviyo créée",
    condition: (s) => s.has("3-1-2"),
  },
  {
    id: "machine-a-leads",
    label: "Machine à leads",
    emoji: "\uD83D\uDD04",
    description: "Tout l'axe Commercial pérenne complété",
    condition: (s) => allComplete(axeTaskIds(3, 2), s),
  },
  {
    id: "usine-a-sites",
    label: "Usine à sites",
    emoji: "\uD83C\uDFED",
    description: "Temps de setup réduit de 50%",
    condition: (s) => s.has("3-6-4"),
  },
  {
    id: "agence-parfaite",
    label: "Agence parfaite",
    emoji: "\uD83D\uDC51",
    description: "Phase 3 complète à 100%",
    condition: (s) => allComplete(phaseTaskIds(3), s),
  },
  {
    id: "cinq-legends",
    label: "CINQ Legends",
    emoji: "\uD83C\uDFC6",
    description: "100% du plan complété",
    condition: (s) => allComplete(ALL_TASK_IDS, s),
  },
];
