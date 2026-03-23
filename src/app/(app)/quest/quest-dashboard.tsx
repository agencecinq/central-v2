"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown, Lock, Trophy, Swords, Quote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  QUEST_PHASES,
  QUEST_BADGES,
  QUEST_VISION,
  QUEST_PRINCIPES,
  TOTAL_POINTS,
  type QuestPhase,
  type QuestTask,
} from "@/lib/quest-data";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompletionItem {
  taskId: string;
  completedBy: number;
  completedByName: string;
  completedAt: string;
}

export interface BadgeItem {
  badgeId: string;
  unlockedAt: string;
}

interface Props {
  initialCompletions: CompletionItem[];
  initialBadges: BadgeItem[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuestDashboard({ initialCompletions, initialBadges }: Props) {
  const [completions, setCompletions] = useState<CompletionItem[]>(initialCompletions);
  const [badges, setBadges] = useState<BadgeItem[]>(initialBadges);
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

  function phaseStats(phase: QuestPhase) {
    let total = 0;
    let done = 0;
    for (const axe of phase.axes) {
      for (const task of axe.tasks) {
        total++;
        if (completedIds.has(task.id)) done++;
      }
    }
    return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
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
          { taskId: task.id, completedBy: 0, completedByName: "", completedAt: new Date().toISOString() },
        ];
      }
      setCompletions(newCompletions);

      // Evaluate badges
      const newCompletedIds = new Set(newCompletions.map((c) => c.taskId));
      const newBadgeIds = new Set<string>();
      for (const badge of QUEST_BADGES) {
        if (badge.condition(newCompletedIds)) newBadgeIds.add(badge.id);
      }

      const badgesToAdd = [...newBadgeIds].filter((id) => !badgeSet.has(id));
      const badgesToRemove = [...badgeSet].filter((id) => !newBadgeIds.has(id));

      let newBadges = badges.filter((b) => !badgesToRemove.includes(b.badgeId));
      for (const id of badgesToAdd) {
        newBadges = [...newBadges, { badgeId: id, unlockedAt: new Date().toISOString() }];
      }
      setBadges(newBadges);

      for (const id of badgesToAdd) {
        const badge = QUEST_BADGES.find((b) => b.id === id);
        if (badge) {
          toast.success(`${badge.emoji} Badge débloqué : ${badge.label}`, { duration: 4000 });
        }
      }

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
        setCompletions(completions);
        setBadges(badges);
        toast.error("Erreur de sauvegarde");
      }
    },
    [completions, completedIds, badges, badgeSet],
  );

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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Quest 2026</h2>
        <p className="mt-1 text-muted-foreground">
          Plan d&apos;exécution de l&apos;agence CINQ
        </p>
      </div>

      <Tabs defaultValue="progression">
        <TabsList>
          <TabsTrigger value="progression">
            <Swords className="h-4 w-4 mr-1.5" />
            Progression
          </TabsTrigger>
          <TabsTrigger value="manifeste">
            <Quote className="h-4 w-4 mr-1.5" />
            Manifeste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progression" className="mt-6 space-y-6">
          {/* Global stats */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Progression globale</p>
                  <p className="text-3xl font-bold tabular-nums">{globalPercent}%</p>
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {completedIds.size} tâches · {earnedPoints}/{TOTAL_POINTS} pts
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${globalPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Phases */}
          {QUEST_PHASES.map((phase) => {
            const stats = phaseStats(phase);
            const isOpen = openPhases.has(phase.id);

            return (
              <Card key={phase.id}>
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors text-left rounded-t-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {phase.sousTitre} — {phase.periode}
                    </p>
                    <p className="text-base font-semibold">{phase.titre}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{phase.objectif}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{stats.percent}%</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{stats.done}/{stats.total}</p>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Progress bar */}
                <div className="px-5 pb-1">
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>
                </div>

                {/* Axes & tasks */}
                {isOpen && (
                  <CardContent className="pt-3 space-y-5">
                    {phase.axes.map((axe, axeIdx) => (
                      <div key={axeIdx}>
                        <p className="text-sm font-medium text-muted-foreground mb-2">{axe.titre}</p>
                        <div className="space-y-0.5">
                          {axe.tasks.map((task) => {
                            const done = completedIds.has(task.id);
                            const info = completionMap.get(task.id);
                            return (
                              <button
                                key={task.id}
                                onClick={() => toggleTask(task)}
                                className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors group ${
                                  done ? "bg-muted/50" : "hover:bg-muted/30"
                                }`}
                              >
                                <div
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                    done
                                      ? "border-primary bg-primary/20"
                                      : "border-muted-foreground/30 group-hover:border-muted-foreground/60"
                                  }`}
                                >
                                  {done && <Check className="h-3 w-3 text-primary" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
                                    {task.label}
                                  </p>
                                  {done && info?.completedByName && (
                                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                                      par {info.completedByName} ·{" "}
                                      {new Date(info.completedAt).toLocaleDateString("fr-FR", {
                                        day: "numeric",
                                        month: "short",
                                      })}
                                    </p>
                                  )}
                                </div>
                                <span className={`text-xs tabular-nums shrink-0 mt-0.5 ${done ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                                  {task.points} pts
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Badges */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold flex-1">Badges</CardTitle>
              <span className="text-sm text-muted-foreground">{badges.length}/{QUEST_BADGES.length}</span>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {QUEST_BADGES.map((badge) => {
                  const unlocked = badgeSet.has(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`rounded-lg border p-3 text-center transition-colors ${
                        unlocked ? "border-primary/30 bg-primary/5" : "opacity-40"
                      }`}
                    >
                      <div className="text-2xl mb-1">
                        {unlocked ? badge.emoji : <Lock className="h-5 w-5 mx-auto text-muted-foreground" />}
                      </div>
                      <p className="text-xs font-medium">{badge.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{badge.description}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manifeste" className="mt-6 space-y-6">
          {/* Vision */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Vision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <blockquote className="text-base leading-relaxed italic border-l-2 border-primary/40 pl-4">
                {QUEST_VISION}
              </blockquote>
            </CardContent>
          </Card>

          {/* Principes */}
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Les 7 principes fondateurs
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {QUEST_PRINCIPES.map((p, i) => (
                <Card key={i}>
                  <CardContent className="py-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold mb-1">{p.titre}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
