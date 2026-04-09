import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import {
  computeBudgetTotals,
  computeSousSectionTotal,
} from "@/lib/budget-calc";
import {
  t,
  formatMontant,
  ICON_MAP,
  parseJsonArray,
  parseJsonObject,
  type Langue,
} from "@/lib/proposition-utils";

// ─── Data fetching ─────────────────────────────────────────────────────────

async function getProposition(token: string) {
  const prop = await prisma.propositionCommerciale.findUnique({
    where: { publicToken: token },
    include: {
      deal: { include: { client: true } },
      sections: {
        include: { sousSections: { orderBy: { ordre: "asc" } } },
        orderBy: { ordre: "asc" },
      },
      planningEtapes: { orderBy: { ordre: "asc" } },
    },
  });
  return prop;
}

// ─── Metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const prop = await getProposition(token);
  if (!prop) return { title: "Proposition introuvable" };

  return {
    title: prop.nom
      ? `${prop.nom} — ${prop.deal.client.entreprise || prop.deal.client.nom}`
      : "Proposition Commerciale",
    robots: "noindex, nofollow",
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────

function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

function formatDateLong(date: Date, langue: Langue): string {
  return date.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(date: Date, langue: Langue): string {
  return date.toLocaleDateString(langue === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

// ─── Color palettes ───────────────────────────────────────────────────────

const BENEFIT_COLORS = [
  { border: "border-primary/30", text: "text-primary" },
  { border: "border-emerald-600/30", text: "text-emerald-600" },
  { border: "border-purple-600/30", text: "text-purple-600" },
  { border: "border-amber-600/30", text: "text-amber-600" },
  { border: "border-rose-600/30", text: "text-rose-600" },
  { border: "border-cyan-600/30", text: "text-cyan-600" },
];

const GANTT_COLORS = [
  "bg-primary",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function PropositionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const prop = await getProposition(token);
  if (!prop) notFound();

  const langue = (prop.langue as Langue) || "fr";
  const devise = prop.devise || "EUR";

  const client = prop.deal.client;
  const clientName = client.entreprise || client.nom;

  // Parse JSON fields
  const beneficesCles = parseJsonArray(prop.beneficesCles);
  const informationsComplementaires = parseJsonArray(
    prop.informationsComplementaires,
  );
  const callToAction = parseJsonObject(prop.callToAction);
  const references = parseJsonArray(prop.references);

  // Compute totals
  const totals = computeBudgetTotals({
    sections: prop.sections.map((s) => ({
      estOption: s.estOption,
      sousSections: s.sousSections.map((ss) => ({
        nombreJours: Number(ss.nombreJours),
        tjm: Number(ss.tjm),
        remise: Number(ss.remise),
      })),
    })),
    remiseGlobale: Number(prop.remiseGlobale),
    tauxTva: Number(prop.tauxTva),
    tauxGestionProjet: Number(prop.tauxGestionProjet),
    tjmGestionProjet: Number(prop.tjmGestionProjet),
  });

  const totalSemainesRaw = prop.planningEtapes.reduce(
    (sum, e) => sum + (e.nombreSemaines ? Number(e.nombreSemaines) : 0),
    0,
  );
  const totalSemaines = Math.ceil(totalSemainesRaw);

  const dateDebut = prop.dateDebutProjet
    ? new Date(prop.dateDebutProjet)
    : null;

  const fmt = (n: number) => formatMontant(n, devise);

  return (
    <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-4xl px-6 py-12 space-y-10">
          {/* ── Logo bar ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <Image
              src="/logo.svg"
              alt="Cinq"
              width={140}
              height={40}
              className="h-10 w-auto"
              priority
            />
            {prop.logoClient && (
              <img
                src={prop.logoClient}
                alt={clientName}
                className="h-10 object-contain"
              />
            )}
          </div>

          {/* ── Header ───────────────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              {t(langue, "titre_proposition")}
            </p>
            <h1 className="text-4xl font-bold tracking-tight">
              {prop.nom || t(langue, "titre_proposition")}
            </h1>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
              <span>{clientName}</span>
              <span>
                {t(langue, "date_proposition")} :{" "}
                {prop.createdAt
                  ? formatDateLong(new Date(prop.createdAt), langue)
                  : "—"}
              </span>
              <span>
                {t(langue, "reference")} : #
                {String(prop.id).padStart(6, "0")}
              </span>
            </div>
          </div>

          {/* ── Introduction ─────────────────────────────────────────── */}
          {prop.introduction && (
            <div className="rounded-xl border border-primary/30 bg-card p-6">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {prop.introduction}
              </p>
            </div>
          )}

          {/* ── Bénéfices clés ───────────────────────────────────────── */}
          {beneficesCles.length > 0 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold">
                {t(langue, "valeur_ajoutee")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {beneficesCles.map(
                  (
                    bc: { titre: string; description: string; icone: string },
                    i: number,
                  ) => {
                    const color =
                      BENEFIT_COLORS[i % BENEFIT_COLORS.length];
                    const Icon = ICON_MAP[bc.icone] || ICON_MAP["lightning"];
                    return (
                      <div
                        key={i}
                        className={`rounded-xl border ${color.border} bg-card p-5 space-y-3`}
                      >
                        <Icon className={`h-6 w-6 ${color.text}`} />
                        <h3 className="font-semibold">
                          {bc.titre}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {bc.description}
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          )}

          {/* ── Détail des prestations ───────────────────────────────── */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">
              {t(langue, "detail_prestations")}
            </h2>

            {prop.sections.map((section, si) => {
              const sectionTotal = totals.sections[si];
              return (
                <div
                  key={section.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Section header */}
                  <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">
                        {section.titre}
                      </h3>
                      {section.estOption && (
                        <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                          {t(langue, "option")}
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-semibold">
                      {fmt(sectionTotal?.total ?? 0)}
                    </span>
                  </div>

                  {/* Sous-sections */}
                  <div className="divide-y divide-border/50">
                    {section.sousSections.map((ss) => {
                      const ssTotal = computeSousSectionTotal({
                        nombreJours: Number(ss.nombreJours),
                        tjm: Number(ss.tjm),
                        remise: Number(ss.remise),
                      });
                      return (
                        <div
                          key={ss.id}
                          className="flex items-center justify-between px-6 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              {ss.titre}
                            </p>
                            {ss.description && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                {ss.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground shrink-0 ml-4">
                            <span>
                              {Number(ss.nombreJours)}{" "}
                              {Number(ss.nombreJours) <= 1
                                ? t(langue, "jour")
                                : t(langue, "jours")}
                            </span>
                            <span>× {fmt(Number(ss.tjm))}</span>
                            {Number(ss.remise) > 0 && (
                              <span className="text-destructive">
                                -{Number(ss.remise)}%
                              </span>
                            )}
                            <span className="font-medium text-foreground w-24 text-right">
                              {fmt(ssTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Gestion de projet */}
                    {sectionTotal && sectionTotal.joursGestionProjet > 0 && (
                      <div className="flex items-center justify-between px-6 py-3 bg-muted/50">
                        <p className="text-sm text-muted-foreground italic">
                          {t(langue, "gestion_projet")} (
                          {Number(prop.tauxGestionProjet)}
                          {t(langue, "gestion_projet_pct")})
                        </p>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground shrink-0 ml-4">
                          <span>
                            {sectionTotal.joursGestionProjet}{" "}
                            {sectionTotal.joursGestionProjet <= 1
                              ? t(langue, "jour")
                              : t(langue, "jours")}
                          </span>
                          <span>
                            × {fmt(Number(prop.tjmGestionProjet))}
                          </span>
                          <span className="font-medium text-foreground w-24 text-right">
                            {fmt(sectionTotal.montantGestionProjet)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* ── Récapitulatif financier ──────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">
              {t(langue, "recapitulatif_financier")}
            </h2>
            <div className="rounded-xl border border-border bg-card p-6 space-y-3">
              {totals.remiseAmount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t(langue, "total_ht_avant_remise")}
                    </span>
                    <span>{fmt(totals.totalHT)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-destructive">
                    <span>
                      {t(langue, "remise_globale")} (
                      {Number(prop.remiseGlobale)}%)
                    </span>
                    <span>-{fmt(totals.remiseAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t(langue, "total_ht")}
                </span>
                <span className="font-medium">
                  {fmt(totals.totalApresRemise)}
                </span>
              </div>
              {totals.totalOptions > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t(langue, "total_options")}
                  </span>
                  <span className="text-muted-foreground">
                    {fmt(totals.totalOptions)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t(langue, "tva")} ({Number(prop.tauxTva)}%)
                </span>
                <span>{fmt(totals.tvaAmount)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between items-baseline">
                <span className="text-lg font-semibold">
                  {t(langue, "total_ttc")}
                </span>
                <span className="text-2xl font-bold text-primary">
                  {fmt(totals.totalTTC)}
                </span>
              </div>
            </div>
          </section>

          {/* ── Planning — Gantt Chart ───────────────────────────────── */}
          {prop.planningEtapes.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">
                {t(langue, "planning_projet")}
              </h2>

              {dateDebut && (
                <p className="text-sm text-muted-foreground">
                  {t(langue, "date_debut")} :{" "}
                  {formatDateLong(dateDebut, langue)} ·{" "}
                  {t(langue, "duree_totale")} : {totalSemainesRaw}{" "}
                  {totalSemainesRaw <= 1
                    ? t(langue, "semaine")
                    : t(langue, "semaines")}{" "}
                  ({t(langue, "jusqu_au")}{" "}
                  {formatDateLong(addWeeks(dateDebut, totalSemaines), langue)})
                </p>
              )}

              {totalSemaines > 0 ? (
                <div className="rounded-xl border border-border bg-card p-6 overflow-x-auto">
                  <div
                    style={{
                      minWidth: `${Math.max(totalSemaines * 48 + 192, 500)}px`,
                    }}
                  >
                    {/* Week column headers */}
                    <div className="flex items-end border-b border-border/50 pb-2 mb-4">
                      <div className="w-48 shrink-0" />
                      <div
                        className="flex-1 grid"
                        style={{
                          gridTemplateColumns: `repeat(${totalSemaines}, 1fr)`,
                        }}
                      >
                        {Array.from({ length: totalSemaines }, (_, i) => (
                          <div key={i} className="text-center px-0.5">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              S{i + 1}
                            </span>
                            {dateDebut && (
                              <span className="block text-[9px] text-muted-foreground/60 mt-0.5">
                                {formatShortDate(
                                  addWeeks(dateDebut, i),
                                  langue,
                                )}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gantt rows */}
                    <div className="space-y-2">
                      {(() => {
                        let cumulWeeks = 0;
                        return prop.planningEtapes.map((etape, i) => {
                          const weeksRaw = etape.nombreSemaines
                            ? Number(etape.nombreSemaines)
                            : 0;
                          const weeks = Math.round(weeksRaw) || (weeksRaw > 0 ? 1 : 0);
                          const startCol = cumulWeeks + 1;
                          cumulWeeks += weeks;

                          return (
                            <div
                              key={etape.id}
                              className="flex items-center"
                            >
                              <div className="w-48 shrink-0 pr-4">
                                <p className="text-sm font-medium truncate">
                                  {etape.titre}
                                </p>
                                {etape.description && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {etape.description}
                                  </p>
                                )}
                              </div>
                              <div
                                className="flex-1 grid h-10"
                                style={{
                                  gridTemplateColumns: `repeat(${totalSemaines}, 1fr)`,
                                }}
                              >
                                {weeks > 0 && (
                                  <div
                                    className={`${GANTT_COLORS[i % GANTT_COLORS.length]} rounded-md flex items-center justify-center text-xs font-medium text-white shadow-sm overflow-hidden`}
                                    style={{
                                      gridColumn: `${startCol} / span ${weeks}`,
                                    }}
                                  >
                                    <span className="truncate px-1">
                                      {weeksRaw}{" "}
                                      {langue === "en" ? "wk" : "sem."}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                /* Fallback: list when no weeks defined */
                <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                  {prop.planningEtapes.map((etape) => (
                    <div key={etape.id}>
                      <p className="text-sm font-medium">{etape.titre}</p>
                      {etape.description && (
                        <p className="text-xs text-muted-foreground">
                          {etape.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Informations complémentaires ─────────────────────────── */}
          {informationsComplementaires.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">
                {t(langue, "informations_complementaires")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {informationsComplementaires.map(
                  (
                    ic: { titre: string; description: string; icone: string },
                    i: number,
                  ) => {
                    const Icon = ICON_MAP[ic.icone] || ICON_MAP["shield"];
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-border bg-card p-5 space-y-3"
                      >
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">
                          {ic.titre}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {ic.description}
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          )}

          {/* ── Conclusion ───────────────────────────────────────────── */}
          {prop.conclusion && (
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {prop.conclusion}
              </p>
            </div>
          )}

          {/* ── Call to action ───────────────────────────────────────── */}
          {callToAction &&
            (callToAction.titre || callToAction.description) && (
              <div className="rounded-xl bg-primary/10 border border-primary/30 p-8 text-center space-y-4">
                <h2 className="text-2xl font-bold">
                  {callToAction.titre || t(langue, "pret_demarrer")}
                </h2>
                {callToAction.description && (
                  <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
                    {callToAction.description}
                  </p>
                )}
                {(callToAction.validite_jours ||
                  callToAction.validiteJours) &&
                  prop.createdAt && (
                    <p className="text-sm text-muted-foreground/70">
                      {t(langue, "valable_jusqu_au")}{" "}
                      {formatDateLong(
                        addWeeks(
                          new Date(prop.createdAt),
                          (callToAction.validite_jours ||
                            callToAction.validiteJours) / 7,
                        ),
                        langue,
                      )}
                    </p>
                  )}
              </div>
            )}

          {/* ── Références ───────────────────────────────────────────── */}
          {references.length > 0 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold">
                {t(langue, "nos_references")}
              </h2>

              {/* Simple references */}
              {references.filter(
                (r: { type: string }) => r.type !== "featured",
              ).length > 0 && (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {references
                    .filter((r: { type: string }) => r.type !== "featured")
                    .map(
                      (
                        r: { nom: string; logo: string; lien: string },
                        i: number,
                      ) => (
                        <div
                          key={i}
                          className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 text-center"
                        >
                          {r.logo && (
                            <img
                              src={r.logo}
                              alt={r.nom}
                              className="h-8 object-contain"
                            />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {r.nom}
                          </span>
                        </div>
                      ),
                    )}
                </div>
              )}

              {/* Featured references */}
              {references.filter(
                (r: { type: string }) => r.type === "featured",
              ).length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {references
                    .filter((r: { type: string }) => r.type === "featured")
                    .map(
                      (
                        r: {
                          nom: string;
                          logo: string;
                          temoignage: string;
                          contact_nom: string;
                          contactNom: string;
                          contact_poste: string;
                          contactPoste: string;
                        },
                        i: number,
                      ) => (
                        <div
                          key={i}
                          className="rounded-xl border border-border bg-card p-6 space-y-4"
                        >
                          <div className="flex items-center gap-3">
                            {r.logo && (
                              <img
                                src={r.logo}
                                alt={r.nom}
                                className="h-8 object-contain"
                              />
                            )}
                            <span className="font-semibold">
                              {r.nom}
                            </span>
                          </div>
                          {r.temoignage && (
                            <blockquote className="border-l-2 border-primary/50 pl-4 text-sm text-muted-foreground italic leading-relaxed">
                              {r.temoignage}
                            </blockquote>
                          )}
                          {(r.contact_nom || r.contactNom) && (
                            <p className="text-xs text-muted-foreground/70">
                              — {r.contact_nom || r.contactNom}
                              {(r.contact_poste || r.contactPoste) &&
                                `, ${r.contact_poste || r.contactPoste}`}
                            </p>
                          )}
                        </div>
                      ),
                    )}
                </div>
              )}
            </section>
          )}

          {/* ── Footer ───────────────────────────────────────────────── */}
          <footer className="border-t border-border pt-6 text-center space-y-1 text-xs text-muted-foreground/70">
            <p>{t(langue, "confidentielle")}</p>
            <p>
              {t(langue, "document_genere")}{" "}
              {formatDateLong(new Date(), langue)} ·{" "}
              {t(langue, "reproduction_interdite")}
            </p>
          </footer>
        </div>
      </div>
  );
}
