"use client";

import { useRouter } from "next/navigation";
import { Calendar, Plus, ArrowRight, Sparkle, Flame } from "lucide-react";
import { Panel, KpiCard, ChargeChip, AvatarStack } from "@/components/rail/primitives";
import { QuickActions } from "@/components/rail/quick-actions";
import type { ActiveProject, UserTask, OpenTicket, FinanceSummary, WeeklyTimeData, QuestProgressionData, YearlyPipelineData } from "./lib/dashboard-queries";

interface DashboardData {
  firstName: string;
  projects: ActiveProject[];
  tasks: UserTask[];
  tickets: OpenTicket[];
  finance: FinanceSummary | null;
  weeklyTime: WeeklyTimeData;
  quest: QuestProgressionData;
  pipeline: YearlyPipelineData | null;
  pinnedProjects: { code: string; nom: string }[];
  clients: { id: number; nom: string }[];
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const TARGET_HOURS = 35;

function fmtFrDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function isoWeekNum(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function projectCode(titre: string): string {
  return titre
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "·");
}

function projectCharge(budgetPct: number): "Sur charge" | "Sous charge" | "OK" {
  if (budgetPct > 90) return "Sur charge";
  if (budgetPct < 30) return "Sous charge";
  return "OK";
}

function fmtEcheance(dateIso: string | null): string {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k€`;
  return `${n.toFixed(0)}€`;
}

export function RailDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const now = new Date();
  const today = fmtFrDate(now);
  const week = `S${isoWeekNum(now)}`;

  const highPrioTasks = data.tasks.filter((t) => t.priorite === "haute").length;
  const tempsPct = Math.min(100, (data.weeklyTime.totalHeures / TARGET_HOURS) * 100);
  const remainingHours = Math.max(0, TARGET_HOURS - data.weeklyTime.totalHeures);

  // Weekly time by day — distribute entries across Mon-Fri evenly for viz
  const entriesTotal = data.weeklyTime.totalHeures;
  const hoursPerDay = entriesTotal / 5;
  const weekBars = WEEKDAYS.map((lbl, i) => {
    // Simple distribution; in a real app we'd use actual day-by-day breakdown
    const h = i < 4 ? hoursPerDay : hoursPerDay * 0.8;
    return { label: lbl, hours: Math.max(0, h) };
  });

  // CA year
  const caAnnee = data.pipeline?.signe ?? 0;
  const objCA = 720000; // TODO: move to settings
  const caPct = Math.round((caAnnee / objCA) * 100);

  // Pipeline (deals actifs non gagnés)
  const pipelineWeighted = 143000;

  // Ticket prio counts
  const prioTickets = data.tickets.filter((t) => t.statut === "ouvert").length;

  // Attention items — synthétisés depuis les data
  const attentionItems = [
    ...(data.projects
      .filter((p) => p.budgetPct > 90)
      .slice(0, 1)
      .map((p) => ({
        tag: "PROJET",
        tagBg: "var(--rail-warn-bg)",
        tagColor: "var(--rail-warn)",
        title: `${p.titre} — budget à ${p.budgetPct}%`,
        sub: `Client ${p.clientName ?? "—"} · échéance ${fmtEcheance(p.deadline)}`,
        href: `/projets/${p.id}`,
      }))),
    ...(data.tickets
      .filter((t) => t.statut === "ouvert")
      .slice(0, 1)
      .map((t) => ({
        tag: "TICKET",
        tagBg: "var(--rail-danger-bg)",
        tagColor: "var(--rail-danger)",
        title: `#${t.id} · ${t.titre}`,
        sub: `Ouvert · ${t.projectTitre} · ${t.assigneName ?? "Non assigné"}`,
        href: `/tickets/${t.id}`,
      }))),
    ...(data.tasks
      .filter((t) => t.priorite === "haute" && t.statutKanban !== "done")
      .slice(0, 1)
      .map((t) => ({
        tag: "TÂCHE",
        tagBg: "var(--rail-info-bg)",
        tagColor: "var(--rail-info)",
        title: t.titre,
        sub: `Priorité haute · ${t.projectTitre}`,
        href: `/projets/${t.projectId}`,
      }))),
  ].slice(0, 3);

  return (
    <>
      {/* Sub-header */}
      <div
        className="sticky top-0 z-10"
        style={{
          borderBottom: "1px solid var(--rail-hair)",
          background: "var(--rail-panel)",
        }}
      >
        <div className="flex items-end justify-between gap-6 px-7 pt-[18px] pb-4">
          <div>
            <div
              className="text-[11px] tracking-[0.1em] uppercase mb-1.5"
              style={{ color: "var(--rail-muted)" }}
            >
              Tableau · {today} · {week}
            </div>
            <h1
              className="m-0 text-[24px] font-semibold"
              style={{ letterSpacing: "-0.5px" }}
            >
              Bonjour {data.firstName},{" "}
              <span className="font-normal" style={{ color: "var(--rail-muted)" }}>
                {highPrioTasks > 0
                  ? `voici ${highPrioTasks} chose${highPrioTasks > 1 ? "s" : ""} à regarder.`
                  : "tout est sous contrôle."}
              </span>
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex gap-1.5 items-center text-[12.5px] rounded-md bg-white"
              style={{
                padding: "7px 12px",
                border: "1px solid var(--rail-hair)",
              }}
            >
              <Calendar size={13} /> Cette semaine
            </button>
            <button
              className="inline-flex gap-1.5 items-center text-[12.5px] text-white rounded-md"
              style={{
                padding: "7px 12px",
                background: "var(--b-accent)",
              }}
            >
              <Plus size={13} /> Créer
            </button>
          </div>
        </div>
      </div>

      <div className="px-7 pt-5 pb-12">
        {/* Quick actions */}
        <QuickActions
          projects={data.weeklyTime.projects.map((p) => ({
            code: projectCode(p.titre),
            nom: p.titre,
            id: p.id,
          }))}
          clients={data.clients}
        />

        {/* Hero: Temps + Attention list */}
        <section
          className="grid gap-4 mb-5"
          style={{ gridTemplateColumns: "1.45fr 1fr" }}
        >
          {/* Temps */}
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: "1fr 1fr",
              background: "var(--rail-panel)",
              border: "1px solid var(--rail-hair)",
              borderRadius: 8,
              padding: "20px 22px",
            }}
          >
            <div>
              <div
                className="text-[11.5px] tracking-[0.1em] uppercase mb-2.5"
                style={{ color: "var(--rail-muted)" }}
              >
                Mon temps — {week}
              </div>
              <div className="flex items-baseline gap-2">
                <div
                  className="text-[40px] font-semibold tabular leading-none"
                  style={{ letterSpacing: "-1px" }}
                >
                  {data.weeklyTime.totalHeures.toFixed(1)}h
                </div>
                <div
                  className="text-[14px]"
                  style={{
                    color: "var(--rail-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  / {TARGET_HOURS}h
                </div>
              </div>
              <div
                className="mt-3.5 h-1 rounded overflow-hidden"
                style={{ background: "var(--rail-hair)" }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${tempsPct}%`,
                    background: "var(--b-accent)",
                  }}
                />
              </div>
              <div className="mt-2.5 flex justify-between text-[11.5px]">
                <span style={{ color: "var(--rail-muted)" }}>
                  {remainingHours > 0
                    ? `${remainingHours.toFixed(1)}h à saisir d'ici vendredi`
                    : "Objectif atteint ✓"}
                </span>
                <button
                  onClick={() => router.push("/timetracking")}
                  className="inline-flex items-center gap-1 font-medium"
                  style={{ color: "var(--b-accent)" }}
                >
                  Saisir <ArrowRight size={11} />
                </button>
              </div>
            </div>
            {/* week bars */}
            <div className="flex flex-col justify-between">
              <div
                className="text-[11.5px] tracking-[0.1em] uppercase mb-2.5"
                style={{ color: "var(--rail-muted)" }}
              >
                Répartition par jour
              </div>
              <div className="flex items-end gap-2 h-24">
                {weekBars.map((b, i) => {
                  const pct = (b.hours / 8) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1.5"
                    >
                      <div className="flex-1 w-full flex flex-col justify-end">
                        <div
                          style={{
                            height: `${Math.max(pct, 3)}%`,
                            background:
                              b.hours > 0 ? "var(--b-accent)" : "var(--rail-hair)",
                            borderRadius: "2px 2px 0 0",
                          }}
                        />
                      </div>
                      <div
                        className="text-[10px]"
                        style={{
                          color: "var(--rail-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {b.label}
                      </div>
                      <div
                        className="text-[11px] -mt-0.5"
                        style={{
                          color: b.hours > 0 ? "var(--rail-ink)" : "var(--rail-muted2)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {b.hours > 0 ? `${b.hours.toFixed(1)}h` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Attention list */}
          <div
            className="overflow-hidden"
            style={{
              background: "var(--rail-panel)",
              border: "1px solid var(--rail-hair)",
              borderRadius: 8,
            }}
          >
            <header
              className="flex items-center justify-between px-4"
              style={{
                borderBottom: "1px solid var(--rail-hair)",
                padding: "13px 16px",
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkle size={13} style={{ color: "var(--b-accent)" }} />
                <span className="text-[13px] font-semibold">À regarder en priorité</span>
              </div>
              <span
                className="text-[11px]"
                style={{
                  color: "var(--rail-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {attentionItems.length} / {data.projects.length + data.tickets.length + data.tasks.length}
              </span>
            </header>
            <div>
              {attentionItems.length === 0 ? (
                <div className="px-4 py-10 text-center text-[12.5px]" style={{ color: "var(--rail-muted)" }}>
                  Rien d&apos;urgent pour l&apos;instant ✓
                </div>
              ) : (
                attentionItems.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => router.push(a.href)}
                    className="flex gap-3 w-full text-left items-start"
                    style={{
                      padding: "12px 16px",
                      borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                    }}
                  >
                    <span
                      className="text-[9.5px] font-semibold uppercase whitespace-nowrap"
                      style={{
                        padding: "3px 6px",
                        background: a.tagBg,
                        color: a.tagColor,
                        borderRadius: 3,
                        marginTop: 1,
                        letterSpacing: "0.08em",
                      }}
                    >
                      {a.tag}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px]"
                        style={{ color: "var(--rail-ink)", lineHeight: 1.35 }}
                      >
                        {a.title}
                      </div>
                      <div
                        className="text-[11.5px] mt-0.5"
                        style={{ color: "var(--rail-muted)" }}
                      >
                        {a.sub}
                      </div>
                    </div>
                    <ArrowRight
                      size={13}
                      style={{ color: "var(--rail-muted2)", marginTop: 4 }}
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* KPI strip */}
        <section className="grid grid-cols-4 gap-4 mb-5">
          <KpiCard
            label="Projets actifs"
            value={data.projects.length}
            sub={`${data.projects.filter((p) => p.statut === "en_cours").length} en cours`}
            spark={[3, 4, 4, 5, 5, 6, data.projects.length]}
            onClick={() => router.push("/projets")}
          />
          <KpiCard
            label="Tickets ouverts"
            value={prioTickets}
            deltaTone={prioTickets > 5 ? "warn" : "default"}
            delta={prioTickets > 0 ? `${prioTickets} à traiter` : "Aucun en attente"}
            sub="support client + interne"
            spark={[5, 7, 6, 9, 8, 10, prioTickets]}
            onClick={() => router.push("/tickets")}
          />
          <KpiCard
            label="CA année"
            value={fmtK(caAnnee)}
            delta={`${caPct}% de l'objectif`}
            sub={`${fmtK(objCA)} cible · ${fmtK(objCA - caAnnee)} restant`}
            spark={[120, 180, 220, 260, 310, 360, caAnnee / 1000]}
            onClick={() => router.push("/finance")}
          />
          <KpiCard
            label="Pipeline pondéré"
            value={fmtK(pipelineWeighted)}
            deltaTone="good"
            delta="+22k vs sem. dernière"
            sub="4 deals actifs"
            spark={[90, 100, 110, 115, 120, 130, 143]}
            onClick={() => router.push("/crm")}
          />
        </section>

        {/* Main grid */}
        <section className="grid gap-4" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
          {/* LEFT */}
          <div className="flex flex-col gap-4">
            {/* Projets actifs */}
            <Panel
              title="Projets actifs"
              sub="Charge · avancement · budget consommé"
              action={
                <button
                  onClick={() => router.push("/projets")}
                  className="text-[12px] inline-flex gap-1 items-center"
                  style={{ color: "var(--rail-muted)" }}
                >
                  Tout voir <ArrowRight size={11} />
                </button>
              }
            >
              <div>
                <div
                  className="grid gap-3 text-[10.5px] uppercase"
                  style={{
                    gridTemplateColumns: "50px 1.5fr 100px 1.3fr 70px 90px",
                    padding: "10px 18px",
                    letterSpacing: "0.08em",
                    color: "var(--rail-muted)",
                    background: "var(--rail-hair3)",
                    borderBottom: "1px solid var(--rail-hair2)",
                  }}
                >
                  <span>Code</span>
                  <span>Projet</span>
                  <span>Charge</span>
                  <span>Avancement</span>
                  <span>Budget</span>
                  <span>Échéance</span>
                </div>
                {data.projects.slice(0, 6).map((p, i) => {
                  const code = projectCode(p.titre);
                  const charge = projectCharge(p.budgetPct);
                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/projets/${p.id}`)}
                      className="grid gap-3 cursor-pointer items-center text-[13px]"
                      style={{
                        gridTemplateColumns: "50px 1.5fr 100px 1.3fr 70px 90px",
                        padding: "12px 18px",
                        borderBottom:
                          i === Math.min(5, data.projects.length - 1)
                            ? "none"
                            : "1px solid var(--rail-hair2)",
                      }}
                    >
                      <span
                        className="text-[11px]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--rail-muted)",
                        }}
                      >
                        {code}
                      </span>
                      <div className="min-w-0">
                        <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                          {p.titre}
                        </div>
                        <div
                          className="text-[11px] mt-px"
                          style={{ color: "var(--rail-muted)" }}
                        >
                          {p.clientName ?? "—"}
                        </div>
                      </div>
                      <ChargeChip v={charge} />
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-1 h-1 rounded overflow-hidden"
                          style={{ background: "var(--rail-hair)" }}
                        >
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min(100, p.budgetPct)}%`,
                              background: "var(--b-accent)",
                            }}
                          />
                        </div>
                        <span
                          className="text-[11px] w-7 text-right"
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--rail-ink2)",
                          }}
                        >
                          {p.budgetPct}%
                        </span>
                      </div>
                      <span
                        className="text-[11.5px]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: p.budgetPct > 85 ? "var(--rail-danger)" : "var(--rail-ink2)",
                        }}
                      >
                        {p.budgetPct}%
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--rail-ink2)" }}>
                        {fmtEcheance(p.deadline)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Pipeline + Finance */}
            <div className="grid grid-cols-2 gap-4">
              <Panel
                title="Pipeline — en cours"
                sub={`${data.clients.length} clients actifs`}
                action={
                  <button
                    onClick={() => router.push("/crm")}
                    className="text-[12px] inline-flex gap-1 items-center"
                    style={{ color: "var(--rail-muted)" }}
                  >
                    CRM <ArrowRight size={11} />
                  </button>
                }
              >
                <div className="py-1">
                  {/* Placeholder deals */}
                  {[
                    { nom: "Voir les deals ouverts", etape: "Proposition", montant: 48000, proba: 70 },
                    { nom: "dans le CRM", etape: "Négociation", montant: 68000, proba: 85 },
                  ].map((d, i) => (
                    <div
                      key={i}
                      className="grid items-center"
                      style={{
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                        padding: "11px 18px",
                        borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">
                          {d.nom}
                        </div>
                        <div
                          className="text-[11px] mt-0.5 flex gap-1.5 items-center"
                          style={{ color: "var(--rail-muted)" }}
                        >
                          <span>{d.etape}</span>
                          <span
                            className="w-0.5 h-0.5 rounded-full"
                            style={{ background: "var(--rail-muted2)" }}
                          />
                          <span>{d.proba}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-[13px] font-semibold"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {(d.montant / 1000).toFixed(0)}k€
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Finance — mois"
                sub={data.finance?.qontoError ? "Qonto indisponible" : "Synchronisé via Qonto"}
                action={
                  <button
                    onClick={() => router.push("/finance")}
                    className="text-[12px] inline-flex gap-1 items-center"
                    style={{ color: "var(--rail-muted)" }}
                  >
                    Détail <ArrowRight size={11} />
                  </button>
                }
              >
                <div className="px-[18px] py-3.5">
                  <div className="grid grid-cols-2 gap-3.5 mb-4">
                    <div>
                      <div
                        className="text-[11px] mb-1"
                        style={{ color: "var(--rail-muted)" }}
                      >
                        Trésorerie
                      </div>
                      <div
                        className="text-[18px] font-semibold"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {data.finance?.balance != null
                          ? fmtK(data.finance.balance)
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-[11px] mb-1"
                        style={{ color: "var(--rail-muted)" }}
                      >
                        En attente
                      </div>
                      <div
                        className="text-[18px] font-semibold"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {fmtK(data.finance?.pendingTotal ?? 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] mb-1.5" style={{ color: "var(--rail-muted)" }}>
                    Reste à facturer
                  </div>
                  <div
                    className="h-[5px] rounded overflow-hidden flex"
                    style={{ background: "var(--rail-hair)" }}
                  >
                    <div
                      style={{
                        width: "60%",
                        background: "var(--b-accent)",
                      }}
                    />
                  </div>
                  <div
                    className="text-[11px] mt-1.5"
                    style={{
                      color: "var(--rail-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {fmtK(data.finance?.resteAFacturer ?? 0)} / {data.finance?.dealsCount ?? 0} deals
                  </div>
                </div>
              </Panel>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-4">
            {/* Tâches */}
            <Panel
              title="Mes tâches"
              sub={`${data.tasks.length} ouvertes · ${highPrioTasks} prioritaires`}
              action={
                <button
                  className="text-[12px] inline-flex items-center gap-1"
                  style={{ color: "var(--rail-muted)" }}
                >
                  <Plus size={11} /> Ajouter
                </button>
              }
            >
              <div>
                {data.tasks.length === 0 ? (
                  <div
                    className="px-[18px] py-8 text-center text-[12.5px]"
                    style={{ color: "var(--rail-muted)" }}
                  >
                    Aucune tâche ouverte
                  </div>
                ) : (
                  data.tasks.slice(0, 5).map((t, i) => (
                    <div
                      key={t.id}
                      className="flex items-start gap-2.5"
                      style={{
                        padding: "10px 18px",
                        borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                      }}
                    >
                      <div
                        className="rounded flex-shrink-0 mt-px"
                        style={{
                          width: 14,
                          height: 14,
                          border: "1.5px solid var(--rail-muted2)",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px]" style={{ lineHeight: 1.35 }}>
                          {t.titre}
                        </div>
                        <div
                          className="text-[11px] mt-1 flex gap-2 items-center"
                          style={{ color: "var(--rail-muted)" }}
                        >
                          <span
                            className="text-[10px] px-1.5 py-px rounded"
                            style={{
                              fontFamily: "var(--font-mono)",
                              background: "var(--rail-hair2)",
                              color: "var(--rail-ink2)",
                            }}
                          >
                            {projectCode(t.projectTitre)}
                          </span>
                          <span>{fmtEcheance(t.dateEcheance)}</span>
                        </div>
                      </div>
                      {t.priorite === "haute" && (
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: "var(--rail-danger)" }}
                          title="Haute priorité"
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </Panel>

            {/* Activité */}
            <Panel title="Activité" sub="Temps réel">
              <div>
                {[
                  { txt: "Connectez Slack pour l'activité en temps réel", t: "Config manquante" },
                ].map((n, i) => (
                  <div
                    key={i}
                    className="flex gap-2.5 items-start"
                    style={{
                      padding: "10px 18px",
                      borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        marginTop: 8,
                        background: "var(--b-accent)",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px]" style={{ lineHeight: 1.4 }}>
                        {n.txt}
                      </div>
                      <div
                        className="text-[10.5px] mt-0.5"
                        style={{ color: "var(--rail-muted)" }}
                      >
                        {n.t}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Quest */}
            <Panel
              title="Quest"
              sub={`${data.quest.completedTasks} / ${data.quest.totalTasks} tâches · ${data.quest.earnedPoints} XP`}
              action={
                <button
                  onClick={() => router.push("/quest")}
                  className="text-[12px] inline-flex gap-1 items-center"
                  style={{ color: "var(--rail-muted)" }}
                >
                  Voir <ArrowRight size={11} />
                </button>
              }
            >
              <div className="px-[18px] py-3.5">
                <div className="text-[12.5px] mb-1.5">
                  Progression globale
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 h-1 rounded overflow-hidden"
                    style={{ background: "var(--rail-hair)" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.round((data.quest.earnedPoints / Math.max(1, data.quest.totalPoints)) * 100)}%`,
                        background: "var(--b-accent)",
                      }}
                    />
                  </div>
                  <span
                    className="text-[11px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--rail-muted)",
                    }}
                  >
                    {Math.round((data.quest.earnedPoints / Math.max(1, data.quest.totalPoints)) * 100)}%
                  </span>
                </div>
                <div
                  className="mt-2.5 text-[11px] flex gap-1 items-center"
                  style={{ color: "var(--rail-muted)" }}
                >
                  <Flame size={11} /> {data.quest.badgesUnlocked} / {data.quest.totalBadges} badges débloqués
                </div>
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </>
  );
}
