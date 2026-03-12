"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GripVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface WidgetWrapperProps {
  title: string;
  icon: LucideIcon;
  count?: number;
  children: ReactNode;
}

export function WidgetWrapper({
  title,
  icon: Icon,
  count,
  children,
}: WidgetWrapperProps) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-row items-center gap-2 shrink-0">
        <div className="drag-handle cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-medium text-muted-foreground flex-1">
          {title}
        </CardTitle>
        {count !== undefined && (
          <span className="text-2xl font-bold tabular-nums">{count}</span>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">{children}</CardContent>
    </Card>
  );
}
