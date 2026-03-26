import type { LayoutItem } from "react-grid-layout/legacy";

export const WIDGET_IDS = {
  PROJETS: "projets-actifs",
  TACHES: "taches-en-cours",
  TICKETS: "tickets-ouverts",
  FINANCE: "finance-ca",
  TEMPS: "temps-semaine",
  QUEST: "quest-progression",
  PIPELINE: "pipeline-annuel",
} as const;

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: WIDGET_IDS.PROJETS, x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: WIDGET_IDS.TACHES, x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: WIDGET_IDS.TICKETS, x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  { i: WIDGET_IDS.FINANCE, x: 6, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  { i: WIDGET_IDS.TEMPS, x: 0, y: 8, w: 6, h: 4, minW: 4, minH: 3 },
  { i: WIDGET_IDS.QUEST, x: 6, y: 8, w: 6, h: 4, minW: 4, minH: 3 },
  { i: WIDGET_IDS.PIPELINE, x: 0, y: 12, w: 6, h: 4, minW: 4, minH: 3 },
];

export const ADMIN_ONLY_WIDGETS: Set<string> = new Set([WIDGET_IDS.FINANCE, WIDGET_IDS.PIPELINE]);
