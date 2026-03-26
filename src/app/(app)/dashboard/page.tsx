import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { DashboardGrid } from "./dashboard-grid";
import type { WidgetData } from "./dashboard-grid";
import {
  DEFAULT_LAYOUT,
  ADMIN_ONLY_WIDGETS,
  WIDGET_IDS,
} from "./lib/dashboard-defaults";
import {
  getActiveProjects,
  getUserTasks,
  getOpenTickets,
  getFinanceSummary,
  getWeeklyTime,
  getQuestProgression,
  getYearlyPipeline,
} from "./lib/dashboard-queries";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "client") {
    redirect("/espace-client");
  }

  const userId = parseInt(session.user.id);
  const userIsAdmin = isAdmin(session.user.role);

  // Parallel fetch: layout + all widget data
  const [savedLayout, projects, tasks, tickets, finance, weeklyTime, questData, pipelineData] = await Promise.all([
    prisma.dashboardLayout.findUnique({ where: { userId } }),
    getActiveProjects(),
    getUserTasks(userId),
    getOpenTickets(),
    userIsAdmin ? getFinanceSummary() : Promise.resolve(null),
    getWeeklyTime(userId),
    getQuestProgression(),
    userIsAdmin ? getYearlyPipeline() : Promise.resolve(null),
  ]);

  // Build layout: use saved or default, filtering admin-only widgets for non-admins
  // Merge new widgets from DEFAULT_LAYOUT into saved layouts so they appear automatically
  const allowedDefaults = DEFAULT_LAYOUT.filter(
    (w) => userIsAdmin || !ADMIN_ONLY_WIDGETS.has(w.i),
  );

  let layout: typeof DEFAULT_LAYOUT;
  if (savedLayout) {
    const saved = JSON.parse(savedLayout.layout) as typeof DEFAULT_LAYOUT;
    const savedIds = new Set(saved.map((w) => w.i));
    const missing = allowedDefaults.filter((w) => !savedIds.has(w.i));
    layout = [...saved, ...missing];
  } else {
    layout = allowedDefaults;
  }

  const widgetData: WidgetData = {
    [WIDGET_IDS.PROJETS]: { count: projects.length, items: projects },
    [WIDGET_IDS.TACHES]: { count: tasks.length, items: tasks },
    [WIDGET_IDS.TICKETS]: { count: tickets.length, items: tickets },
    [WIDGET_IDS.FINANCE]: finance,
    [WIDGET_IDS.TEMPS]: weeklyTime,
    [WIDGET_IDS.QUEST]: questData,
    [WIDGET_IDS.PIPELINE]: pipelineData,
  };

  const firstName = session.user.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Bonjour, {firstName}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Bienvenue sur votre tableau de bord.
        </p>
      </div>

      <DashboardGrid initialLayout={layout} widgetData={widgetData} />
    </div>
  );
}
