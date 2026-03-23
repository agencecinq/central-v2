"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Lock, Trophy } from "lucide-react";
import {
  QUEST_PHASES,
  QUEST_BADGES,
  QUEST_VISION,
  QUEST_PRINCIPES,
  TOTAL_POINTS,
  type QuestPhase,
  type QuestTask,
  type QuestBadgeDef,
} from "@/lib/quest-data";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompletionItem {
  taskId: string;
  completedBy: number;
  completedByName: string;
  completedAt: string;
}

interface BadgeItem {
  badgeId: string;
  unlockedAt: string;
}

interface Props {
  initialCompletions: CompletionItem[];
  initialBadges: BadgeItem[];
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const ROSE = "#F6E8E1";

// ─── Component ───────────────────────────────────────────────────────────────

export function QuestDashboard({ initialCompletions, initialBadges }: Props) {
  const [completions, setCompletions] = useState<CompletionItem[]>(initialCompletions);
  const [badges, setBadges] = useState<BadgeItem[]>(initialBadges);
  const [tab, setTab] = useState<"quest" | "manifeste">("quest");
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set([1]));

  const completedIds = useMemo(
    () => new Set(completions.map((c) => c.taskId)),
    [completions],
  );

  const completionMap = useMemo(() => {
    const map = new Map<string, CompletionItem>();
    for (const c of completions) map.set(c.taskId, c);
    return map;
  }, [completions]);

  const badgeSet = useMemo(
    () => new Set(badges.map((b) => b.badgeId)),
    [badges],
  );

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalCompleted = completedIds.size;
  const earnedPoints = useMemo(() => {
    let pts = 0;
    for (const phase of QUEST_PHASES) {
      for (const axe of phase.axes) {
        for (const task of axe.tasks) {
          if (completedIds.has(task.id)) pts += task.points;
        }
      }
    }
    return pts;
  }, [completedIds]);

  const globalPercent = TOTAL_POINTS > 0 ? Math.round((earnedPoints / TOTAL_POINTS) * 100) : 0;

  // ─── Phase stats ───────────────────────────────────────────────────────────

  function phaseStats(phase: QuestPhase) {
    let total = 0;
    let done = 0;
    let pts = 0;
    let ptsEarned = 0;
    for (const axe of phase.axes) {
      for (const task of axe.tasks) {
        total++;
        pts += task.points;
        if (completedIds.has(task.id)) {
          done++;
          ptsEarned += task.points;
        }
      }
    }
    return { total, done, pts, ptsEarned, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  // ─── Toggle task ───────────────────────────────────────────────────────────

  const toggleTask = useCallback(
    async (task: QuestTask) => {
      const wasCompleted = completedIds.has(task.id);

      // Optimistic update
      let newCompletions: CompletionItem[];
      if (wasCompleted) {
        newCompletions = completions.filter((c) => c.taskId !== task.id);
      } else {
        newCompletions = [
          ...completions,
          {
            taskId: task.id,
            completedBy: 0,
            completedByName: "",
            completedAt: new Date().toISOString(),
          },
        ];
      }
      setCompletions(newCompletions);

      // Evaluate badges with new state
      const newCompletedIds = new Set(newCompletions.map((c) => c.taskId));
      const newBadgeIds = new Set<string>();
      for (const badge of QUEST_BADGES) {
        if (badge.condition(newCompletedIds)) newBadgeIds.add(badge.id);
      }

      const badgesToAdd = [...newBadgeIds].filter((id) => !badgeSet.has(id));
      const badgesToRemove = [...badgeSet].filter((id) => !newBadgeIds.has(id));

      // Optimistic badge update
      let newBadges = badges.filter((b) => !badgesToRemove.includes(b.badgeId));
      for (const id of badgesToAdd) {
        newBadges = [...newBadges, { badgeId: id, unlockedAt: new Date().toISOString() }];
      }
      setBadges(newBadges);

      // Toast for new badges
      for (const id of badgesToAdd) {
        const badge = QUEST_BADGES.find((b) => b.id === id);
        if (badge) {
          toast.success(`${badge.emoji} Badge débloqué : ${badge.label}`, {
            duration: 4000,
          });
        }
      }

      // Persist
      try {
        await fetch("/api/quest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: task.id,
            badgesToAdd: badgesToAdd.length > 0 ? badgesToAdd : undefined,
            badgesToRemove: badgesToRemove.length > 0 ? badgesToRemove : undefined,
          }),
        });
      } catch {
        // Revert on error
        setCompletions(completions);
        setBadges(badges);
        toast.error("Erreur de sauvegarde");
      }
    },
    [completions, completedIds, badges, badgeSet],
  );

  // ─── Toggle phase accordion ────────────────────────────────────────────────

  function togglePhase(id: number) {
    setOpenPhases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl">
      {/* Tab switcher */}
      <div className="flex items-center gap-6 mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: ROSE }}
        >
          Quest 2026
        </h1>
        <div className="flex gap-1 rounded-lg border border-[#F6E8E1]/20 p-1">
          <button
            onClick={() => setTab("quest")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              tab === "quest"
                ? "bg-[#F6E8E1]/15 text-[#F6E8E1]"
                : "text-[#F6E8E1]/50 hover:text-[#F6E8E1]/80"
            }`}
          >
            Progression
          </button>
          <button
            onClick={() => setTab("manifeste")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              tab === "manifeste"
                ? "bg-[#F6E8E1]/15 text-[#F6E8E1]"
                : "text-[#F6E8E1]/50 hover:text-[#F6E8E1]/80"
            }`}
          >
            Manifeste
          </button>
        </div>
      </div>

      {tab === "quest" ? (
        <QuestTab
          completedIds={completedIds}
          completionMap={completionMap}
          earnedPoints={earnedPoints}
          globalPercent={globalPercent}
          totalCompleted={totalCompleted}
          openPhases={openPhases}
          togglePhase={togglePhase}
          toggleTask={toggleTask}
          phaseStats={phaseStats}
          badges={badges}
          badgeSet={badgeSet}
        />
      ) : (
        <ManifesteTab />
      )}
    </div>
  );
}

// ─── Quest Tab ───────────────────────────────────────────────────────────────

function QuestTab({
  completedIds,
  completionMap,
  earnedPoints,
  globalPercent,
  totalCompleted,
  openPhases,
  togglePhase,
  toggleTask,
  phaseStats,
  badges,
  badgeSet,
}: {
  completedIds: Set<string>;
  completionMap: Map<string, CompletionItem>;
  earnedPoints: number;
  globalPercent: number;
  totalCompleted: number;
  openPhases: Set<number>;
  togglePhase: (id: number) => void;
  toggleTask: (task: QuestTask) => void;
  phaseStats: (phase: QuestPhase) => { total: number; done: number; pts: number; ptsEarned: number; percent: number };
  badges: BadgeItem[];
  badgeSet: Set<string>;
}) {
  return (
    <div className="space-y-8">
      {/* Global stats */}
      <div className="rounded-xl border border-[#F6E8E1]/15 p-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[#F6E8E1]/60 text-sm">Progression globale</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: ROSE }}>
              {globalPercent}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#F6E8E1]/60 text-sm">
              {totalCompleted} tâches · {earnedPoints}/{TOTAL_POINTS} pts
            </p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-[#F6E8E1]/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${globalPercent}%`,
              backgroundColor: ROSE,
            }}
          />
        </div>
      </div>

      {/* Phases */}
      {QUEST_PHASES.map((phase) => {
        const stats = phaseStats(phase);
        const isOpen = openPhases.has(phase.id);

        return (
          <div key={phase.id} className="rounded-xl border border-[#F6E8E1]/15 overflow-hidden">
            {/* Phase header */}
            <button
              onClick={() => togglePhase(phase.id)}
              className="w-full flex items-center justify-between p-5 hover:bg-[#F6E8E1]/5 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#F6E8E1]/40 uppercase tracking-wider mb-1">
                  {phase.sousTitre} — {phase.periode}
                </p>
                <p className="text-lg font-semibold" style={{ color: ROSE }}>
                  {phase.titre}
                </p>
                <p className="text-sm text-[#F6E8E1]/50 mt-0.5">{phase.objectif}</p>
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums" style={{ color: ROSE }}>
                    {stats.percent}%
                  </p>
                  <p className="text-xs text-[#F6E8E1]/40 tabular-nums">
                    {stats.done}/{stats.total}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-[#F6E8E1]/40 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {/* Phase progress bar */}
            <div className="px-5 pb-1">
              <div className="h-1 rounded-full bg-[#F6E8E1]/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.percent}%`,
                    backgroundColor: ROSE,
                  }}
                />
              </div>
            </div>

            {/* Axes */}
            {isOpen && (
              <div className="px-5 pb-5 pt-3 space-y-5">
                {phase.axes.map((axe, axeIdx) => (
                  <div key={axeIdx}>
                    <p className="text-sm font-medium text-[#F6E8E1]/70 mb-2">
                      {axe.titre}
                    </p>
                    <div className="space-y-1">
                      {axe.tasks.map((task) => {
                        const done = completedIds.has(task.id);
                        const info = completionMap.get(task.id);
                        return (
                          <button
                            key={task.id}
                            onClick={() => toggleTask(task)}
                            className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors group ${
                              done
                                ? "bg-[#F6E8E1]/8"
                                : "hover:bg-[#F6E8E1]/5"
                            }`}
                          >
                            <div
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                done
                                  ? "border-[#F6E8E1]/40 bg-[#F6E8E1]/20"
                                  : "border-[#F6E8E1]/20 group-hover:border-[#F6E8E1]/40"
                              }`}
                            >
                              {done && <Check className="h-3 w-3" style={{ color: ROSE }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm ${
                                  done
                                    ? "text-[#F6E8E1]/50 line-through"
                                    : "text-[#F6E8E1]/90"
                                }`}
                              >
                                {task.label}
                              </p>
                              {done && info?.completedByName && (
                                <p className="text-xs text-[#F6E8E1]/30 mt-0.5">
                                  par {info.completedByName} ·{" "}
                                  {new Date(info.completedAt).toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </p>
                              )}
                            </div>
                            <span
                              className={`text-xs tabular-nums shrink-0 mt-0.5 ${
                                done ? "text-[#F6E8E1]/30" : "text-[#F6E8E1]/40"
                              }`}
                            >
                              {task.points} pts
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Badges */}
      <div className="rounded-xl border border-[#F6E8E1]/15 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5" style={{ color: ROSE }} />
          <h2 className="text-lg font-semibold" style={{ color: ROSE }}>
            Badges
          </h2>
          <span className="text-sm text-[#F6E8E1]/40">
            {badges.length}/{QUEST_BADGES.length}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {QUEST_BADGES.map((badge) => {
            const unlocked = badgeSet.has(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-lg border p-3 text-center transition-colors ${
                  unlocked
                    ? "border-[#F6E8E1]/30 bg-[#F6E8E1]/8"
                    : "border-[#F6E8E1]/10 opacity-40"
                }`}
              >
                <div className="text-2xl mb-1">
                  {unlocked ? badge.emoji : <Lock className="h-5 w-5 mx-auto text-[#F6E8E1]/30" />}
                </div>
                <p className="text-xs font-medium" style={{ color: unlocked ? ROSE : `${ROSE}80` }}>
                  {badge.label}
                </p>
                <p className="text-[10px] text-[#F6E8E1]/40 mt-0.5">
                  {badge.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Manifeste Tab ───────────────────────────────────────────────────────────

function ManifesteTab() {
  return (
    <div className="space-y-8">
      {/* Vision */}
      <div className="rounded-xl border border-[#F6E8E1]/15 p-6">
        <p className="text-xs font-medium text-[#F6E8E1]/40 uppercase tracking-wider mb-3">
          Vision
        </p>
        <blockquote
          className="text-lg leading-relaxed italic border-l-2 pl-4"
          style={{ color: ROSE, borderColor: `${ROSE}40` }}
        >
          {QUEST_VISION}
        </blockquote>
      </div>

      {/* Principes */}
      <div>
        <p className="text-xs font-medium text-[#F6E8E1]/40 uppercase tracking-wider mb-4">
          Les 7 principes fondateurs
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {QUEST_PRINCIPES.map((p, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#F6E8E1]/15 p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ backgroundColor: `${ROSE}15`, color: ROSE }}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: ROSE }}>
                    {p.titre}
                  </p>
                  <p className="text-sm text-[#F6E8E1]/60 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
