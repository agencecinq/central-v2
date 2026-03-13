"use client";

import { useReducer, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Link2,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { MiniEditor } from "@/components/mini-editor";
import {
  computeBudgetTotals,
  formatEuro,
  type BudgetData,
} from "@/lib/budget-calc";
import { parseJsonArray, parseJsonObject, ICON_OPTIONS } from "@/lib/proposition-utils";
import { saveBudget } from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────

interface SousSectionState {
  tempId: string;
  titre: string;
  description: string;
  nombreJours: number;
  tjm: number;
  remise: number;
}

interface SectionState {
  tempId: string;
  titre: string;
  description: string;
  estOption: boolean;
  sousSections: SousSectionState[];
}

interface PlanningEtapeState {
  tempId: string;
  titre: string;
  description: string;
  nombreSemaines: number | null;
}

interface BeneficeCleState {
  tempId: string;
  titre: string;
  description: string;
  icone: string;
}

interface InformationComplementaireState {
  tempId: string;
  titre: string;
  description: string;
  icone: string;
}

interface CallToActionState {
  titre: string;
  description: string;
  validiteJours: number;
}

interface ReferenceState {
  tempId: string;
  type: "simple" | "featured";
  nom: string;
  logo: string;
  lien: string;
  temoignage: string;
  contactNom: string;
  contactEmail: string;
  contactTelephone: string;
  contactPoste: string;
}

interface BudgetState {
  nom: string;
  introduction: string;
  conclusion: string;
  remiseGlobale: number;
  tauxTva: number;
  tauxGestionProjet: number;
  tjmGestionProjet: number;
  langue: string;
  devise: string;
  dateDebutProjet: string;
  logoEntreprise: string;
  logoClient: string;
  sections: SectionState[];
  planningEtapes: PlanningEtapeState[];
  beneficesCles: BeneficeCleState[];
  informationsComplementaires: InformationComplementaireState[];
  callToAction: CallToActionState;
  references: ReferenceState[];
}

// ─── Serialized budget from server ────────────────────────────────────────

interface SerializedBudget {
  id: number;
  publicToken: string;
  nom: string | null;
  introduction: string | null;
  conclusion: string | null;
  remiseGlobale: number;
  tauxTva: number;
  tauxGestionProjet: number;
  tjmGestionProjet: number;
  langue: string;
  devise: string;
  dateDebutProjet: string | null;
  logoEntreprise: string | null;
  logoClient: string | null;
  beneficesCles: string | null;
  informationsComplementaires: string | null;
  callToAction: string | null;
  references: string | null;
  sections: {
    id: number;
    titre: string;
    description: string | null;
    ordre: number;
    estOption: boolean;
    sousSections: {
      id: number;
      titre: string;
      description: string | null;
      nombreJours: number;
      tjm: number;
      ordre: number;
      remise: number;
    }[];
  }[];
  planningEtapes: {
    id: number;
    titre: string;
    description: string | null;
    ordre: number;
    nombreSemaines: number | null;
  }[];
}

// ─── Actions ──────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_FIELD"; field: keyof BudgetState; value: string | number }
  | { type: "ADD_SECTION" }
  | { type: "REMOVE_SECTION"; tempId: string }
  | { type: "UPDATE_SECTION"; tempId: string; field: string; value: string | boolean }
  | { type: "MOVE_SECTION"; tempId: string; direction: "up" | "down" }
  | { type: "ADD_SOUS_SECTION"; sectionTempId: string }
  | { type: "REMOVE_SOUS_SECTION"; sectionTempId: string; ssTempId: string }
  | {
      type: "UPDATE_SOUS_SECTION";
      sectionTempId: string;
      ssTempId: string;
      field: string;
      value: string | number;
    }
  | {
      type: "MOVE_SOUS_SECTION";
      sectionTempId: string;
      ssTempId: string;
      direction: "up" | "down";
    }
  | { type: "ADD_PLANNING_ETAPE" }
  | { type: "REMOVE_PLANNING_ETAPE"; tempId: string }
  | {
      type: "UPDATE_PLANNING_ETAPE";
      tempId: string;
      field: string;
      value: string | number | null;
    }
  | { type: "MOVE_PLANNING_ETAPE"; tempId: string; direction: "up" | "down" }
  | { type: "ADD_BENEFICE_CLE" }
  | { type: "REMOVE_BENEFICE_CLE"; tempId: string }
  | { type: "UPDATE_BENEFICE_CLE"; tempId: string; field: string; value: string }
  | { type: "ADD_INFO_COMPLEMENTAIRE" }
  | { type: "REMOVE_INFO_COMPLEMENTAIRE"; tempId: string }
  | {
      type: "UPDATE_INFO_COMPLEMENTAIRE";
      tempId: string;
      field: string;
      value: string;
    }
  | { type: "UPDATE_CALL_TO_ACTION"; field: string; value: string | number }
  | { type: "ADD_REFERENCE" }
  | { type: "REMOVE_REFERENCE"; tempId: string }
  | {
      type: "UPDATE_REFERENCE";
      tempId: string;
      field: string;
      value: string;
    }
  | { type: "LOAD_AI_DRAFT"; draft: AIDraft };

// ─── AI Draft type ───────────────────────────────────────────────────────

interface AIDraftSousSection {
  titre: string;
  description: string;
  nombreJours: number;
  tjm: number;
  remise: number;
}

interface AIDraftSection {
  titre: string;
  description: string;
  estOption: boolean;
  sousSections: AIDraftSousSection[];
}

interface AIDraftPlanningEtape {
  titre: string;
  description: string;
  nombreSemaines: number | null;
}

interface AIDraftBenefice {
  titre: string;
  description: string;
  icone: string;
}

interface AIDraftInfo {
  titre: string;
  description: string;
  icone: string;
}

interface AIDraft {
  introduction: string;
  conclusion: string;
  sections: AIDraftSection[];
  planningEtapes: AIDraftPlanningEtape[];
  beneficesCles: AIDraftBenefice[];
  informationsComplementaires: AIDraftInfo[];
  dateDebutProjet: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function moveItem<T>(arr: T[], index: number, direction: "up" | "down"): T[] {
  const newArr = [...arr];
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= arr.length) return arr;
  [newArr[index], newArr[targetIndex]] = [newArr[targetIndex], newArr[index]];
  return newArr;
}

function uid() {
  return crypto.randomUUID();
}

function newSousSection(): SousSectionState {
  return {
    tempId: uid(),
    titre: "",
    description: "",
    nombreJours: 0,
    tjm: 800,
    remise: 0,
  };
}

function newSection(): SectionState {
  return {
    tempId: uid(),
    titre: "",
    description: "",
    estOption: false,
    sousSections: [newSousSection()],
  };
}

function newPlanningEtape(): PlanningEtapeState {
  return {
    tempId: uid(),
    titre: "",
    description: "",
    nombreSemaines: null,
  };
}

function newBeneficeCle(): BeneficeCleState {
  return { tempId: uid(), titre: "", description: "", icone: "lightning" };
}

function newInfoComplementaire(): InformationComplementaireState {
  return { tempId: uid(), titre: "", description: "", icone: "shield" };
}

function defaultCallToAction(): CallToActionState {
  return { titre: "", description: "", validiteJours: 30 };
}

function newReference(): ReferenceState {
  return {
    tempId: uid(),
    type: "simple",
    nom: "",
    logo: "",
    lien: "",
    temoignage: "",
    contactNom: "",
    contactEmail: "",
    contactTelephone: "",
    contactPoste: "",
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────

function reducer(state: BudgetState, action: Action): BudgetState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };

    case "ADD_SECTION":
      return { ...state, sections: [...state.sections, newSection()] };

    case "REMOVE_SECTION":
      return {
        ...state,
        sections: state.sections.filter((s) => s.tempId !== action.tempId),
      };

    case "UPDATE_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.tempId === action.tempId
            ? { ...s, [action.field]: action.value }
            : s,
        ),
      };

    case "MOVE_SECTION": {
      const idx = state.sections.findIndex((s) => s.tempId === action.tempId);
      return { ...state, sections: moveItem(state.sections, idx, action.direction) };
    }

    case "ADD_SOUS_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.tempId === action.sectionTempId
            ? { ...s, sousSections: [...s.sousSections, newSousSection()] }
            : s,
        ),
      };

    case "REMOVE_SOUS_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.tempId === action.sectionTempId
            ? {
                ...s,
                sousSections: s.sousSections.filter(
                  (ss) => ss.tempId !== action.ssTempId,
                ),
              }
            : s,
        ),
      };

    case "UPDATE_SOUS_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.tempId === action.sectionTempId
            ? {
                ...s,
                sousSections: s.sousSections.map((ss) =>
                  ss.tempId === action.ssTempId
                    ? { ...ss, [action.field]: action.value }
                    : ss,
                ),
              }
            : s,
        ),
      };

    case "MOVE_SOUS_SECTION": {
      return {
        ...state,
        sections: state.sections.map((s) => {
          if (s.tempId !== action.sectionTempId) return s;
          const idx = s.sousSections.findIndex(
            (ss) => ss.tempId === action.ssTempId,
          );
          return {
            ...s,
            sousSections: moveItem(s.sousSections, idx, action.direction),
          };
        }),
      };
    }

    case "ADD_PLANNING_ETAPE":
      return {
        ...state,
        planningEtapes: [...state.planningEtapes, newPlanningEtape()],
      };

    case "REMOVE_PLANNING_ETAPE":
      return {
        ...state,
        planningEtapes: state.planningEtapes.filter(
          (e) => e.tempId !== action.tempId,
        ),
      };

    case "UPDATE_PLANNING_ETAPE":
      return {
        ...state,
        planningEtapes: state.planningEtapes.map((e) =>
          e.tempId === action.tempId
            ? { ...e, [action.field]: action.value }
            : e,
        ),
      };

    case "MOVE_PLANNING_ETAPE": {
      const idx = state.planningEtapes.findIndex(
        (e) => e.tempId === action.tempId,
      );
      return {
        ...state,
        planningEtapes: moveItem(state.planningEtapes, idx, action.direction),
      };
    }

    // ── Bénéfices clés ────────────────────────────────────────────────────
    case "ADD_BENEFICE_CLE":
      return {
        ...state,
        beneficesCles: [...state.beneficesCles, newBeneficeCle()],
      };

    case "REMOVE_BENEFICE_CLE":
      return {
        ...state,
        beneficesCles: state.beneficesCles.filter(
          (b) => b.tempId !== action.tempId,
        ),
      };

    case "UPDATE_BENEFICE_CLE":
      return {
        ...state,
        beneficesCles: state.beneficesCles.map((b) =>
          b.tempId === action.tempId
            ? { ...b, [action.field]: action.value }
            : b,
        ),
      };

    // ── Informations complémentaires ──────────────────────────────────────
    case "ADD_INFO_COMPLEMENTAIRE":
      return {
        ...state,
        informationsComplementaires: [
          ...state.informationsComplementaires,
          newInfoComplementaire(),
        ],
      };

    case "REMOVE_INFO_COMPLEMENTAIRE":
      return {
        ...state,
        informationsComplementaires: state.informationsComplementaires.filter(
          (i) => i.tempId !== action.tempId,
        ),
      };

    case "UPDATE_INFO_COMPLEMENTAIRE":
      return {
        ...state,
        informationsComplementaires: state.informationsComplementaires.map(
          (i) =>
            i.tempId === action.tempId
              ? { ...i, [action.field]: action.value }
              : i,
        ),
      };

    // ── Call to action ────────────────────────────────────────────────────
    case "UPDATE_CALL_TO_ACTION":
      return {
        ...state,
        callToAction: { ...state.callToAction, [action.field]: action.value },
      };

    // ── Références ────────────────────────────────────────────────────────
    case "ADD_REFERENCE":
      return {
        ...state,
        references: [...state.references, newReference()],
      };

    case "REMOVE_REFERENCE":
      return {
        ...state,
        references: state.references.filter(
          (r) => r.tempId !== action.tempId,
        ),
      };

    case "UPDATE_REFERENCE":
      return {
        ...state,
        references: state.references.map((r) =>
          r.tempId === action.tempId
            ? { ...r, [action.field]: action.value }
            : r,
        ),
      };

    case "LOAD_AI_DRAFT":
      return {
        ...state,
        introduction: action.draft.introduction,
        conclusion: action.draft.conclusion,
        dateDebutProjet: action.draft.dateDebutProjet ?? "",
        sections: action.draft.sections.map((s) => ({
          tempId: uid(),
          titre: s.titre,
          description: s.description,
          estOption: s.estOption,
          sousSections: s.sousSections.map((ss) => ({
            tempId: uid(),
            titre: ss.titre,
            description: ss.description,
            nombreJours: ss.nombreJours,
            tjm: ss.tjm,
            remise: ss.remise,
          })),
        })),
        planningEtapes: action.draft.planningEtapes.map((e) => ({
          tempId: uid(),
          titre: e.titre,
          description: e.description,
          nombreSemaines: e.nombreSemaines,
        })),
        beneficesCles: action.draft.beneficesCles.map((b) => ({
          tempId: uid(),
          titre: b.titre,
          description: b.description,
          icone: b.icone,
        })),
        informationsComplementaires: action.draft.informationsComplementaires.map((i) => ({
          tempId: uid(),
          titre: i.titre,
          description: i.description,
          icone: i.icone,
        })),
      };

    default:
      return state;
  }
}

// ─── Init state ───────────────────────────────────────────────────────────

function parseCallToAction(json: string | null): CallToActionState {
  if (!json) return defaultCallToAction();
  try {
    const obj = JSON.parse(json);
    return {
      titre: obj.titre ?? "",
      description: obj.description ?? "",
      validiteJours: obj.validite_jours ?? obj.validiteJours ?? 30,
    };
  } catch {
    return defaultCallToAction();
  }
}

function parseBeneficesCles(json: string | null): BeneficeCleState[] {
  const arr = parseJsonArray(json);
  return arr.map((b: Record<string, string>) => ({
    tempId: uid(),
    titre: b.titre ?? "",
    description: b.description ?? "",
    icone: b.icone ?? "lightning",
  }));
}

function parseInfoComplementaires(
  json: string | null,
): InformationComplementaireState[] {
  const arr = parseJsonArray(json);
  return arr.map((i: Record<string, string>) => ({
    tempId: uid(),
    titre: i.titre ?? "",
    description: i.description ?? "",
    icone: i.icone ?? "shield",
  }));
}

function parseReferences(json: string | null): ReferenceState[] {
  const arr = parseJsonArray(json);
  return arr.map((r: Record<string, string>) => ({
    tempId: uid(),
    type: (r.type === "featured" ? "featured" : "simple") as
      | "simple"
      | "featured",
    nom: r.nom ?? "",
    logo: r.logo ?? "",
    lien: r.lien ?? "",
    temoignage: r.temoignage ?? "",
    contactNom: r.contact_nom ?? r.contactNom ?? "",
    contactEmail: r.contact_email ?? r.contactEmail ?? "",
    contactTelephone: r.contact_telephone ?? r.contactTelephone ?? "",
    contactPoste: r.contact_poste ?? r.contactPoste ?? "",
  }));
}

function initState(budget: SerializedBudget | null): BudgetState {
  if (!budget) {
    return {
      nom: "",
      introduction: "",
      conclusion: "",
      remiseGlobale: 0,
      tauxTva: 20,
      tauxGestionProjet: 20,
      tjmGestionProjet: 800,
      langue: "fr",
      devise: "EUR",
      dateDebutProjet: "",
      logoEntreprise: "",
      logoClient: "",
      sections: [newSection()],
      planningEtapes: [],
      beneficesCles: [],
      informationsComplementaires: [],
      callToAction: defaultCallToAction(),
      references: [],
    };
  }

  return {
    nom: budget.nom ?? "",
    introduction: budget.introduction ?? "",
    conclusion: budget.conclusion ?? "",
    remiseGlobale: budget.remiseGlobale,
    tauxTva: budget.tauxTva,
    tauxGestionProjet: budget.tauxGestionProjet,
    tjmGestionProjet: budget.tjmGestionProjet,
    langue: budget.langue ?? "fr",
    devise: budget.devise ?? "EUR",
    dateDebutProjet: budget.dateDebutProjet ?? "",
    logoEntreprise: budget.logoEntreprise ?? "",
    logoClient: budget.logoClient ?? "",
    sections: budget.sections.map((s) => ({
      tempId: uid(),
      titre: s.titre,
      description: s.description ?? "",
      estOption: s.estOption,
      sousSections: s.sousSections.map((ss) => ({
        tempId: uid(),
        titre: ss.titre,
        description: ss.description ?? "",
        nombreJours: ss.nombreJours,
        tjm: ss.tjm,
        remise: ss.remise,
      })),
    })),
    planningEtapes: budget.planningEtapes.map((e) => ({
      tempId: uid(),
      titre: e.titre,
      description: e.description ?? "",
      nombreSemaines: e.nombreSemaines,
    })),
    beneficesCles: parseBeneficesCles(budget.beneficesCles),
    informationsComplementaires: parseInfoComplementaires(
      budget.informationsComplementaires,
    ),
    callToAction: parseCallToAction(budget.callToAction),
    references: parseReferences(budget.references),
  };
}

// ─── Component ────────────────────────────────────────────────────────────

export function BudgetEditor({
  dealId,
  dealTitre,
  clientName,
  budget,
}: {
  dealId: number;
  dealTitre: string;
  clientName: string;
  budget: SerializedBudget | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(reducer, budget, initState);
  const [linkCopied, setLinkCopied] = useState(false);

  const isNew = !budget;
  const [brief, setBrief] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleGenerateAI() {
    if (brief.trim().length < 20) return;
    setIsGenerating(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/generate-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        setAiError(err.error || "Erreur lors de la génération");
        return;
      }
      const draft = await res.json();
      dispatch({ type: "LOAD_AI_DRAFT", draft });
    } catch {
      setAiError("Erreur réseau. Réessayez.");
    } finally {
      setIsGenerating(false);
    }
  }

  // Compute totals live
  const budgetData: BudgetData = useMemo(
    () => ({
      sections: state.sections.map((s) => ({
        estOption: s.estOption,
        sousSections: s.sousSections.map((ss) => ({
          nombreJours: ss.nombreJours,
          tjm: ss.tjm,
          remise: ss.remise,
        })),
      })),
      remiseGlobale: state.remiseGlobale,
      tauxTva: state.tauxTva,
      tauxGestionProjet: state.tauxGestionProjet,
      tjmGestionProjet: state.tjmGestionProjet,
    }),
    [state],
  );

  const totals = useMemo(() => computeBudgetTotals(budgetData), [budgetData]);

  function handleCopyLink() {
    if (!budget?.publicToken) return;
    const url = `${window.location.origin}/proposition/${budget.publicToken}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function handleSave() {
    startTransition(async () => {
      // Serialize JSON fields
      const beneficesClesJson =
        state.beneficesCles.length > 0
          ? JSON.stringify(
              state.beneficesCles.map((b) => ({
                titre: b.titre,
                description: b.description,
                icone: b.icone,
              })),
            )
          : null;

      const informationsComplementairesJson =
        state.informationsComplementaires.length > 0
          ? JSON.stringify(
              state.informationsComplementaires.map((i) => ({
                titre: i.titre,
                description: i.description,
                icone: i.icone,
              })),
            )
          : null;

      const callToActionJson =
        state.callToAction.titre || state.callToAction.description
          ? JSON.stringify({
              titre: state.callToAction.titre,
              description: state.callToAction.description,
              validite_jours: state.callToAction.validiteJours,
            })
          : null;

      const referencesJson =
        state.references.length > 0
          ? JSON.stringify(
              state.references.map((r) => ({
                type: r.type,
                nom: r.nom,
                logo: r.logo,
                lien: r.lien,
                temoignage: r.temoignage,
                contact_nom: r.contactNom,
                contact_email: r.contactEmail,
                contact_telephone: r.contactTelephone,
                contact_poste: r.contactPoste,
              })),
            )
          : null;

      await saveBudget(dealId, budget?.id ?? null, {
        nom: state.nom || null,
        introduction: state.introduction || null,
        conclusion: state.conclusion || null,
        remiseGlobale: state.remiseGlobale,
        tauxTva: state.tauxTva,
        tauxGestionProjet: state.tauxGestionProjet,
        tjmGestionProjet: state.tjmGestionProjet,
        langue: state.langue,
        devise: state.devise,
        dateDebutProjet: state.dateDebutProjet || null,
        logoEntreprise: state.logoEntreprise || null,
        logoClient: state.logoClient || null,
        beneficesCles: beneficesClesJson,
        informationsComplementaires: informationsComplementairesJson,
        callToAction: callToActionJson,
        references: referencesJson,
        sections: state.sections.map((s) => ({
          titre: s.titre,
          description: s.description || null,
          estOption: s.estOption,
          sousSections: s.sousSections.map((ss) => ({
            titre: ss.titre,
            description: ss.description || null,
            nombreJours: ss.nombreJours,
            tjm: ss.tjm,
            remise: ss.remise,
          })),
        })),
        planningEtapes: state.planningEtapes.map((e) => ({
          titre: e.titre,
          description: e.description || null,
          nombreSemaines: e.nombreSemaines,
        })),
      });

      if (!isNew) {
        router.refresh();
      }
      // For new budgets, the server action redirects
    });
  }

  return (
    <div className="flex gap-6">
      {/* Left column — Form */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? "Nouveau budget" : `Budget : ${state.nom || "Sans nom"}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dealTitre} · {clientName}
          </p>
        </div>

        {/* AI Brief Panel — only for new budgets */}
        {isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Générer avec l&apos;IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Décrivez le projet en quelques lignes et l&apos;IA pré-remplira la proposition.
              </p>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Ex : Refonte d'un site e-commerce Shopify pour une marque de cosmétiques bio. Budget estimé 15-20k€, lancement prévu septembre 2026. Besoin : nouveau design, migration des produits, intégration CRM..."
                rows={4}
                disabled={isGenerating}
              />
              {aiError && (
                <p className="text-sm text-destructive">{aiError}</p>
              )}
              <Button
                onClick={handleGenerateAI}
                disabled={isGenerating || brief.trim().length < 20}
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Génération en cours…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Générer le brouillon
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* General settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paramètres généraux</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget-nom">Nom du budget</Label>
              <Input
                id="budget-nom"
                value={state.nom}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "nom",
                    value: e.target.value,
                  })
                }
                placeholder="Ex : Budget V1"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="remise">Remise globale (%)</Label>
                <Input
                  id="remise"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={state.remiseGlobale}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "remiseGlobale",
                      value: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tva">TVA (%)</Label>
                <Input
                  id="tva"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={state.tauxTva}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "tauxTva",
                      value: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taux-gp">Taux gestion projet (%)</Label>
                <Input
                  id="taux-gp"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={state.tauxGestionProjet}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "tauxGestionProjet",
                      value: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tjm-gp">TJM gestion projet (€)</Label>
                <Input
                  id="tjm-gp"
                  type="number"
                  min="0"
                  step="1"
                  value={state.tjmGestionProjet}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "tjmGestionProjet",
                      value: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="langue">Langue</Label>
                <select
                  id="langue"
                  value={state.langue}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "langue",
                      value: e.target.value,
                    })
                  }
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="devise">Devise</Label>
                <select
                  id="devise"
                  value={state.devise}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "devise",
                      value: e.target.value,
                    })
                  }
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-debut">Date de début projet</Label>
                <Input
                  id="date-debut"
                  type="date"
                  value={state.dateDebutProjet}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "dateDebutProjet",
                      value: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Sections</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "ADD_SECTION" })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ajouter une section
            </Button>
          </div>

          {state.sections.map((section, si) => (
            <SectionCard
              key={section.tempId}
              section={section}
              sectionIndex={si}
              totalSections={state.sections.length}
              sectionTotals={totals.sections[si]}
              tauxGestionProjet={state.tauxGestionProjet}
              tjmGestionProjet={state.tjmGestionProjet}
              dispatch={dispatch}
            />
          ))}

          {state.sections.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucune section. Cliquez sur « Ajouter une section » pour commencer.
            </p>
          )}
        </div>

        {/* Planning */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Planning</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "ADD_PLANNING_ETAPE" })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ajouter une étape
            </Button>
          </div>

          {state.planningEtapes.length > 0 ? (
            <Card>
              <CardContent className="p-3 space-y-2">
                {state.planningEtapes.map((etape, pi) => (
                  <div
                    key={etape.tempId}
                    className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <Input
                      value={etape.titre}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_PLANNING_ETAPE",
                          tempId: etape.tempId,
                          field: "titre",
                          value: e.target.value,
                        })
                      }
                      placeholder="Nom de l'étape"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={etape.nombreSemaines ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_PLANNING_ETAPE",
                          tempId: etape.tempId,
                          field: "nombreSemaines",
                          value: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        })
                      }
                      placeholder="Sem."
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      sem.
                    </span>

                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={pi === 0}
                        onClick={() =>
                          dispatch({
                            type: "MOVE_PLANNING_ETAPE",
                            tempId: etape.tempId,
                            direction: "up",
                          })
                        }
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={pi === state.planningEtapes.length - 1}
                        onClick={() =>
                          dispatch({
                            type: "MOVE_PLANNING_ETAPE",
                            tempId: etape.tempId,
                            direction: "down",
                          })
                        }
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() =>
                          dispatch({
                            type: "REMOVE_PLANNING_ETAPE",
                            tempId: etape.tempId,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucune étape de planning.
            </p>
          )}
        </div>

        {/* Introduction / Conclusion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Textes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intro">Introduction</Label>
              <textarea
                id="intro"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={state.introduction}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "introduction",
                    value: e.target.value,
                  })
                }
                placeholder="Introduction de la proposition..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conclusion">Conclusion</Label>
              <textarea
                id="conclusion"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={state.conclusion}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "conclusion",
                    value: e.target.value,
                  })
                }
                placeholder="Conclusion de la proposition..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Logos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logo-entreprise">Logo entreprise (URL)</Label>
                <Input
                  id="logo-entreprise"
                  value={state.logoEntreprise}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "logoEntreprise",
                      value: e.target.value,
                    })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo-client">Logo client (URL)</Label>
                <Input
                  id="logo-client"
                  value={state.logoClient}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "logoClient",
                      value: e.target.value,
                    })
                  }
                  placeholder="https://..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bénéfices clés */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Bénéfices clés</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "ADD_BENEFICE_CLE" })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>

          {state.beneficesCles.map((bc) => (
            <Card key={bc.tempId}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={bc.icone}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_BENEFICE_CLE",
                        tempId: bc.tempId,
                        field: "icone",
                        value: e.target.value,
                      })
                    }
                    className="flex h-8 w-32 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={bc.titre}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_BENEFICE_CLE",
                        tempId: bc.tempId,
                        field: "titre",
                        value: e.target.value,
                      })
                    }
                    placeholder="Titre du bénéfice"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() =>
                      dispatch({
                        type: "REMOVE_BENEFICE_CLE",
                        tempId: bc.tempId,
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <textarea
                  rows={2}
                  className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={bc.description}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_BENEFICE_CLE",
                      tempId: bc.tempId,
                      field: "description",
                      value: e.target.value,
                    })
                  }
                  placeholder="Description..."
                />
              </CardContent>
            </Card>
          ))}

          {state.beneficesCles.length === 0 && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              Aucun bénéfice clé.
            </p>
          )}
        </div>

        {/* Informations complémentaires */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              Informations complémentaires
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "ADD_INFO_COMPLEMENTAIRE" })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>

          {state.informationsComplementaires.map((ic) => (
            <Card key={ic.tempId}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={ic.icone}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_INFO_COMPLEMENTAIRE",
                        tempId: ic.tempId,
                        field: "icone",
                        value: e.target.value,
                      })
                    }
                    className="flex h-8 w-32 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={ic.titre}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_INFO_COMPLEMENTAIRE",
                        tempId: ic.tempId,
                        field: "titre",
                        value: e.target.value,
                      })
                    }
                    placeholder="Titre"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() =>
                      dispatch({
                        type: "REMOVE_INFO_COMPLEMENTAIRE",
                        tempId: ic.tempId,
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <textarea
                  rows={2}
                  className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={ic.description}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_INFO_COMPLEMENTAIRE",
                      tempId: ic.tempId,
                      field: "description",
                      value: e.target.value,
                    })
                  }
                  placeholder="Description..."
                />
              </CardContent>
            </Card>
          ))}

          {state.informationsComplementaires.length === 0 && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              Aucune information complémentaire.
            </p>
          )}
        </div>

        {/* Call to action */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call to action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cta-titre">Titre</Label>
              <Input
                id="cta-titre"
                value={state.callToAction.titre}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CALL_TO_ACTION",
                    field: "titre",
                    value: e.target.value,
                  })
                }
                placeholder="Ex : Prêt à démarrer ?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta-desc">Description</Label>
              <textarea
                id="cta-desc"
                rows={2}
                className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={state.callToAction.description}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CALL_TO_ACTION",
                    field: "description",
                    value: e.target.value,
                  })
                }
                placeholder="Description du call to action..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta-validite">Validité (jours)</Label>
              <Input
                id="cta-validite"
                type="number"
                min="1"
                value={state.callToAction.validiteJours}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CALL_TO_ACTION",
                    field: "validiteJours",
                    value: parseInt(e.target.value) || 30,
                  })
                }
                className="w-24"
              />
            </div>
          </CardContent>
        </Card>

        {/* Références */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Références</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "ADD_REFERENCE" })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>

          {state.references.map((ref) => (
            <Card key={ref.tempId}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <select
                    value={ref.type}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_REFERENCE",
                        tempId: ref.tempId,
                        field: "type",
                        value: e.target.value,
                      })
                    }
                    className="flex h-8 w-32 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="simple">Simple</option>
                    <option value="featured">Featured</option>
                  </select>
                  <Input
                    value={ref.nom}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_REFERENCE",
                        tempId: ref.tempId,
                        field: "nom",
                        value: e.target.value,
                      })
                    }
                    placeholder="Nom de la référence"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() =>
                      dispatch({
                        type: "REMOVE_REFERENCE",
                        tempId: ref.tempId,
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={ref.logo}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_REFERENCE",
                        tempId: ref.tempId,
                        field: "logo",
                        value: e.target.value,
                      })
                    }
                    placeholder="URL du logo"
                  />
                  <Input
                    value={ref.lien}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_REFERENCE",
                        tempId: ref.tempId,
                        field: "lien",
                        value: e.target.value,
                      })
                    }
                    placeholder="URL du site"
                  />
                </div>
                {ref.type === "featured" && (
                  <div className="space-y-2 border-t pt-2">
                    <textarea
                      rows={2}
                      className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={ref.temoignage}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_REFERENCE",
                          tempId: ref.tempId,
                          field: "temoignage",
                          value: e.target.value,
                        })
                      }
                      placeholder="Témoignage..."
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={ref.contactNom}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_REFERENCE",
                            tempId: ref.tempId,
                            field: "contactNom",
                            value: e.target.value,
                          })
                        }
                        placeholder="Nom du contact"
                      />
                      <Input
                        value={ref.contactPoste}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_REFERENCE",
                            tempId: ref.tempId,
                            field: "contactPoste",
                            value: e.target.value,
                          })
                        }
                        placeholder="Poste"
                      />
                      <Input
                        value={ref.contactEmail}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_REFERENCE",
                            tempId: ref.tempId,
                            field: "contactEmail",
                            value: e.target.value,
                          })
                        }
                        placeholder="Email du contact"
                      />
                      <Input
                        value={ref.contactTelephone}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_REFERENCE",
                            tempId: ref.tempId,
                            field: "contactTelephone",
                            value: e.target.value,
                          })
                        }
                        placeholder="Téléphone"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {state.references.length === 0 && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              Aucune référence.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <Button
            variant="outline"
            onClick={() => router.push(`/crm/${dealId}`)}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending
              ? "Enregistrement..."
              : isNew
                ? "Créer le budget"
                : "Enregistrer"}
          </Button>
        </div>
      </div>

      {/* Right column — Financial summary */}
      <div className="w-80 shrink-0">
        <div className="sticky top-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-medium">{formatEuro(totals.totalHT)}</span>
              </div>
              {totals.remiseAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Remise ({state.remiseGlobale}%)</span>
                  <span>-{formatEuro(totals.remiseAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Après remise</span>
                <span className="font-medium">
                  {formatEuro(totals.totalApresRemise)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  TVA ({state.tauxTva}%)
                </span>
                <span>{formatEuro(totals.tvaAmount)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total TTC</span>
                <span className="font-semibold text-lg">
                  {formatEuro(totals.totalTTC)}
                </span>
              </div>
              {totals.totalOptions > 0 && (
                <div className="border-t pt-3 flex justify-between text-muted-foreground">
                  <span>Options</span>
                  <span>{formatEuro(totals.totalOptions)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Copy public link */}
          {!isNew && budget?.publicToken && (
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={handleCopyLink}
            >
              {linkCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-emerald-600" />
                  Copié !
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Copier le lien public
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────

function SectionCard({
  section,
  sectionIndex,
  totalSections,
  sectionTotals,
  tauxGestionProjet,
  tjmGestionProjet,
  dispatch,
}: {
  section: SectionState;
  sectionIndex: number;
  totalSections: number;
  sectionTotals?: {
    totalSousSections: number;
    joursTotal: number;
    joursGestionProjet: number;
    montantGestionProjet: number;
    total: number;
  };
  tauxGestionProjet: number;
  tjmGestionProjet: number;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={sectionIndex === 0}
              onClick={() =>
                dispatch({
                  type: "MOVE_SECTION",
                  tempId: section.tempId,
                  direction: "up",
                })
              }
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={sectionIndex === totalSections - 1}
              onClick={() =>
                dispatch({
                  type: "MOVE_SECTION",
                  tempId: section.tempId,
                  direction: "down",
                })
              }
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Input
            value={section.titre}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_SECTION",
                tempId: section.tempId,
                field: "titre",
                value: e.target.value,
              })
            }
            placeholder="Nom de la section"
            className="font-medium"
          />

          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={section.estOption}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_SECTION",
                  tempId: section.tempId,
                  field: "estOption",
                  value: e.target.checked,
                })
              }
              className="rounded"
            />
            Option
          </label>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            onClick={() =>
              dispatch({ type: "REMOVE_SECTION", tempId: section.tempId })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Section description */}
        <MiniEditor
          content={section.description}
          onChange={(html) =>
            dispatch({
              type: "UPDATE_SECTION",
              tempId: section.tempId,
              field: "description",
              value: html,
            })
          }
          placeholder="Description de la section…"
        />

        {/* Sous-sections */}
        {section.sousSections.map((ss, ssi) => (
          <div
            key={ss.tempId}
            className="rounded-lg border bg-muted/20 px-3 py-2 space-y-2"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

              <Input
                value={ss.titre}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_SOUS_SECTION",
                    sectionTempId: section.tempId,
                    ssTempId: ss.tempId,
                    field: "titre",
                    value: e.target.value,
                  })
                }
                placeholder="Sous-section"
                className="flex-1 min-w-0"
              />

              <Input
                type="number"
                min="0"
                step="0.5"
                value={ss.nombreJours}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_SOUS_SECTION",
                    sectionTempId: section.tempId,
                    ssTempId: ss.tempId,
                    field: "nombreJours",
                    value: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-16 text-center"
                title="Jours"
              />
              <span className="text-xs text-muted-foreground">j ×</span>

              <Input
                type="number"
                min="0"
                step="1"
                value={ss.tjm}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_SOUS_SECTION",
                    sectionTempId: section.tempId,
                    ssTempId: ss.tempId,
                    field: "tjm",
                    value: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-20 text-center"
                title="TJM"
              />
              <span className="text-xs text-muted-foreground">€</span>

              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={ss.remise}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_SOUS_SECTION",
                    sectionTempId: section.tempId,
                    ssTempId: ss.tempId,
                    field: "remise",
                    value: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-16 text-center"
                title="Remise %"
              />
              <span className="text-xs text-muted-foreground">%</span>

              <span className="text-xs font-medium whitespace-nowrap w-20 text-right">
                {formatEuro(ss.nombreJours * ss.tjm * (1 - ss.remise / 100))}
              </span>

              <div className="flex gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={ssi === 0}
                  onClick={() =>
                    dispatch({
                      type: "MOVE_SOUS_SECTION",
                      sectionTempId: section.tempId,
                      ssTempId: ss.tempId,
                      direction: "up",
                    })
                  }
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={ssi === section.sousSections.length - 1}
                  onClick={() =>
                    dispatch({
                      type: "MOVE_SOUS_SECTION",
                      sectionTempId: section.tempId,
                      ssTempId: ss.tempId,
                      direction: "down",
                    })
                  }
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() =>
                    dispatch({
                      type: "REMOVE_SOUS_SECTION",
                      sectionTempId: section.tempId,
                      ssTempId: ss.tempId,
                    })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Sous-section description */}
            <MiniEditor
              content={ss.description}
              onChange={(html) =>
                dispatch({
                  type: "UPDATE_SOUS_SECTION",
                  sectionTempId: section.tempId,
                  ssTempId: ss.tempId,
                  field: "description",
                  value: html,
                })
              }
              placeholder="Description de la sous-section…"
            />
          </div>
        ))}

        {/* Add sous-section button */}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() =>
            dispatch({
              type: "ADD_SOUS_SECTION",
              sectionTempId: section.tempId,
            })
          }
        >
          <Plus className="mr-1 h-3 w-3" />
          Sous-section
        </Button>

        {/* Section footer: gestion projet + total */}
        {sectionTotals && (
          <div className="flex items-center justify-between border-t pt-2 mt-2 text-xs text-muted-foreground">
            <span>
              Gestion projet : {sectionTotals.joursGestionProjet}j ×{" "}
              {formatEuro(tjmGestionProjet)} ={" "}
              {formatEuro(sectionTotals.montantGestionProjet)}
            </span>
            <span className="font-semibold text-sm text-foreground">
              Total : {formatEuro(sectionTotals.total)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
