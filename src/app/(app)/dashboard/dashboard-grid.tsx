"use client";

import { useCallback, useRef, useState } from "react";
import {
  Responsive,
  WidthProvider,
  type LayoutItem,
  type ResponsiveLayouts,
  type Layout,
} from "react-grid-layout/legacy";
import { saveDashboardLayout } from "./actions";
import { ProjetsActifsWidget } from "./widgets/projets-actifs";
import { TachesEnCoursWidget } from "./widgets/taches-en-cours";
import { TicketsOuvertsWidget } from "./widgets/tickets-ouverts";
import { FinanceCaWidget } from "./widgets/finance-ca";
import { TempsSemaineWidget } from "./widgets/temps-semaine";
import { QuestProgressionWidget } from "./widgets/quest-progression";
import { WIDGET_IDS } from "./lib/dashboard-defaults";
import type {
  ActiveProject,
  UserTask,
  OpenTicket,
  FinanceSummary,
  WeeklyTimeData,
  QuestProgressionData,
} from "./lib/dashboard-queries";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface WidgetData {
  [WIDGET_IDS.PROJETS]: { count: number; items: ActiveProject[] };
  [WIDGET_IDS.TACHES]: { count: number; items: UserTask[] };
  [WIDGET_IDS.TICKETS]: { count: number; items: OpenTicket[] };
  [WIDGET_IDS.FINANCE]: FinanceSummary | null;
  [WIDGET_IDS.TEMPS]: WeeklyTimeData;
  [WIDGET_IDS.QUEST]: QuestProgressionData;
}

interface Props {
  initialLayout: LayoutItem[];
  widgetData: WidgetData;
}

const WIDGET_COMPONENTS: Record<
  string,
  React.ComponentType<{ data: never }>
> = {
  [WIDGET_IDS.PROJETS]: ProjetsActifsWidget as React.ComponentType<{
    data: never;
  }>,
  [WIDGET_IDS.TACHES]: TachesEnCoursWidget as React.ComponentType<{
    data: never;
  }>,
  [WIDGET_IDS.TICKETS]: TicketsOuvertsWidget as React.ComponentType<{
    data: never;
  }>,
  [WIDGET_IDS.FINANCE]: FinanceCaWidget as React.ComponentType<{
    data: never;
  }>,
  [WIDGET_IDS.TEMPS]: TempsSemaineWidget as React.ComponentType<{
    data: never;
  }>,
  [WIDGET_IDS.QUEST]: QuestProgressionWidget as React.ComponentType<{
    data: never;
  }>,
};

export function DashboardGrid({ initialLayout, widgetData }: Props) {
  const [layouts, setLayouts] = useState<ResponsiveLayouts>({
    lg: initialLayout,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveDashboardLayout(JSON.stringify(allLayouts.lg ?? _layout));
      }, 500);
    },
    [],
  );

  return (
    <ResponsiveGridLayout
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 768, sm: 0 }}
      cols={{ lg: 12, md: 6, sm: 1 }}
      rowHeight={80}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".drag-handle"
      isResizable
      isDraggable
      containerPadding={[0, 0]}
      margin={[16, 16]}
    >
      {initialLayout.map((item) => {
        const Component = WIDGET_COMPONENTS[item.i];
        const data = widgetData[item.i as keyof WidgetData];
        if (!Component || data === undefined) return null;

        return (
          <div key={item.i}>
            <Component data={data as never} />
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
