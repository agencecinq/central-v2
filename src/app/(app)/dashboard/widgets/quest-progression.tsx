"use client";

import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { WidgetWrapper } from "./widget-wrapper";

export interface QuestWidgetData {
  earnedPoints: number;
  totalPoints: number;
  completedTasks: number;
  totalTasks: number;
  badgesUnlocked: number;
  totalBadges: number;
}

interface Props {
  data: QuestWidgetData;
}

export function QuestProgressionWidget({ data }: Props) {
  const percent =
    data.totalPoints > 0
      ? Math.round((data.earnedPoints / data.totalPoints) * 100)
      : 0;

  return (
    <WidgetWrapper title="Quest 2026" icon={Swords}>
      <div className="space-y-4">
        {/* Points & percentage */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold tabular-nums">{percent}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.earnedPoints}/{data.totalPoints} pts
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium tabular-nums">
              {data.completedTasks}/{data.totalTasks}
            </p>
            <p className="text-xs text-muted-foreground">tâches</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Badges count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" />
          <span>
            {data.badgesUnlocked}/{data.totalBadges} badges débloqués
          </span>
        </div>

        {/* Link */}
        <Link
          href="/quest"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          Voir la progression →
        </Link>
      </div>
    </WidgetWrapper>
  );
}
