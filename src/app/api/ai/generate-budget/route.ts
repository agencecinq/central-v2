import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5-20250929";

const SYSTEM_PROMPT = `Tu es un assistant qui génère des brouillons de propositions commerciales (budgets) pour une agence digitale.
À partir du brief client, tu dois produire UNIQUEMENT un JSON valide respectant exactement la structure ci-dessous.

Ton et style : rédige en ton INDIRECT (impersonnel). Bannir "Nous" + verbe (ex. "Nous intégrerons..."). Utiliser des formulations nominales ou à l'infinitif : "Intégration des produits...", "Déploiement prévu en...", "Livraison des livrables...". Pas de "nous", pas de "vous" comme sujet d'action de l'agence.

Structure attendue du JSON :
- introduction : STRING (pas un objet, pas un tableau). 2 à 4 phrases : rappel implicite du contexte + objectifs du projet, sans libellés "Contexte :", "Objectifs :", "But :", etc. Le texte doit naturellement contenir ces éléments sans les nommer.
  Exemples de style attendu (indicatif) :
  - "Refonte d'un site e-commerce pour moderniser l'expérience d'achat et améliorer la conversion. Objectifs : parcours simplifié, performance, contenus migrés et autonomie côté équipe."
  Mauvais exemples :
  - "Contexte : ... Objectifs : ..." (interdit)
  - { "contexte": "...", "objectifs": "..." } (interdit)
- conclusion : STRING (pas un objet, pas un tableau). En 2 à 4 phrases, le client doit comprendre clairement : (1) ce qu'il achète (résumé des livrables / périmètre), (2) à combien (ordre de grandeur ou montant si déductible des sections), (3) pour combien de temps (durée totale en semaines/mois). Formulation impersonnelle.
- sections : tableau d'objets. Chaque section a :
  - titre (string)
  - description (string, 1 à 3 phrases, ton indirect)
  - est_option (boolean, false par défaut)
  - sous_sections : tableau d'objets avec titre (string), description (string, ton indirect), nombre_jours (number, entier ou décimal)
- planning_etapes : tableau d'étapes de rétro-planning. Chaque étape a :
  - titre (string, peut reprendre le titre d'une section)
  - description (string, courte, ton indirect)
  - nombre_semaines (number, décimal possible)
  L'ordre des étapes doit correspondre à l'ordre des sections. Répartis les jours en semaines (environ 5 jours ouvrés par semaine).
- benefices_cles : exactement 3 objets avec titre (string), description (string) et icone (string, une valeur parmi : "lightning", "shield", "users", "rocket", "star", "target", "trending-up", "check-circle", "award", "code"). Avantages de travailler avec l'agence. Ton indirect dans les descriptions.
- informations_complementaires : exactement 4 objets avec titre (string), description (string) et icone (string, une valeur parmi : "calendar", "clipboard", "support", "euro"). Les 4 titres obligatoires : "Délais & Planning", "Méthodologie", "Support & Maintenance", "Modalités de Paiement". Descriptions au ton indirect.
- date_debut_projet : string au format YYYY-MM-DD (date de début plausible, peut être null si non précisé dans le brief)

Règles : tous les champs de type texte doivent être des STRING (jamais des objets). Génère au moins 1 section avec au moins 1 sous-section. Les nombre_jours doivent être réalistes. Réponds UNIQUEMENT avec le JSON, sans texte avant ou après. Pas de markdown, pas de \`\`\`.`;

interface AISousSection {
  titre: string;
  description: string;
  nombre_jours: number;
}

interface AISection {
  titre: string;
  description: string;
  est_option?: boolean;
  sous_sections: AISousSection[];
}

interface AIPlanningEtape {
  titre: string;
  description: string;
  nombre_semaines: number;
}

interface AIBenefice {
  titre: string;
  description: string;
  icone?: string;
}

interface AIInfo {
  titre: string;
  description: string;
  icone?: string;
}

interface AIBudgetDraft {
  introduction: string;
  conclusion: string;
  sections: AISection[];
  planning_etapes: AIPlanningEtape[];
  benefices_cles: AIBenefice[];
  informations_complementaires: AIInfo[];
  date_debut_projet: string | null;
}

const DEFAULT_TJM = 800;

const INFO_ICONS: Record<string, string> = {
  "Délais & Planning": "calendar",
  "Méthodologie": "clipboard",
  "Support & Maintenance": "support",
  "Modalités de Paiement": "euro",
};

function valueToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.values(value).filter(Boolean).join(" ");
  }
  return "";
}

function normalizeDraft(data: AIBudgetDraft) {
  return {
    introduction: valueToString(data.introduction),
    conclusion: valueToString(data.conclusion),
    sections: (data.sections || []).map((s) => ({
      titre: s.titre || "",
      description: valueToString(s.description),
      estOption: s.est_option ?? false,
      sousSections: (s.sous_sections || []).map((ss) => ({
        titre: ss.titre || "",
        description: valueToString(ss.description),
        nombreJours: Number(ss.nombre_jours) || 0,
        tjm: DEFAULT_TJM,
        remise: 0,
      })),
    })),
    planningEtapes: (data.planning_etapes || []).map((e) => ({
      titre: e.titre || "",
      description: valueToString(e.description),
      nombreSemaines: Number(e.nombre_semaines) || null,
    })),
    beneficesCles: (data.benefices_cles || []).slice(0, 3).map((b) => ({
      titre: b.titre || "",
      description: valueToString(b.description),
      icone: b.icone || "lightning",
    })),
    informationsComplementaires: (data.informations_complementaires || [])
      .slice(0, 4)
      .map((info) => ({
        titre: info.titre || "",
        description: valueToString(info.description),
        icone: info.icone || INFO_ICONS[info.titre] || "shield",
      })),
    dateDebutProjet: data.date_debut_projet || null,
  };
}

export async function POST(request: Request) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (session.user.role === "client") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // API key check
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans .env.local" },
      { status: 500 },
    );
  }

  // Parse body
  const body = await request.json();
  const brief = (body.brief ?? "").trim();
  if (!brief || brief.length < 20) {
    return NextResponse.json(
      { error: "Le brief doit contenir au moins 20 caractères" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Génère un brouillon de proposition commerciale à partir de ce brief :\n\n${brief}`,
          },
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Erreur API Anthropic", response.status, errorBody);
      return NextResponse.json(
        { error: "Erreur lors de l'appel à l'API Anthropic" },
        { status: 502 },
      );
    }

    const result = await response.json();

    // Check if response was truncated due to max_tokens
    if (result.stop_reason === "max_tokens") {
      console.error("Réponse IA tronquée (max_tokens atteint)");
      return NextResponse.json(
        { error: "La proposition générée était trop longue. Réessayez avec un brief plus concis." },
        { status: 502 },
      );
    }

    let content = result.content?.[0]?.text ?? "";

    // Clean potential markdown wrappers and stray text
    content = content.trim();
    // Remove ```json ... ``` blocks
    content = content.replace(/^```(?:json)?\s*/i, "");
    content = content.replace(/\s*```\s*$/, "");
    content = content.trim();

    // If the AI added text before or after the JSON, extract the outermost { ... }
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      content = content.slice(firstBrace, lastBrace + 1);
    }

    let data: AIBudgetDraft;
    try {
      data = JSON.parse(content) as AIBudgetDraft;
    } catch {
      console.error("JSON invalide reçu de l'IA:", content.slice(0, 500));
      return NextResponse.json(
        { error: "L'IA a renvoyé une réponse invalide. Réessayez." },
        { status: 502 },
      );
    }

    const normalized = normalizeDraft(data);

    return NextResponse.json(normalized);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("JSON invalide reçu de l'IA");
      return NextResponse.json(
        { error: "L'IA a renvoyé une réponse invalide. Réessayez." },
        { status: 502 },
      );
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error("Timeout appel API Anthropic");
      return NextResponse.json(
        { error: "La génération a pris trop de temps. Réessayez avec un brief plus court." },
        { status: 504 },
      );
    }
    console.error("Erreur génération budget IA", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération. Réessayez." },
      { status: 500 },
    );
  }
}
