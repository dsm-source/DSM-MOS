// src/features/production/components/board-column.tsx
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnId } from "../lib/board-columns";

const STORAGE_KEY = "dsm-board-selesai-collapsed";

type BoardColumnProps = {
  id: ColumnId;
  label: string;
  count: number;
  collapsible?: boolean;
  children: React.ReactNode;
};

export function BoardColumn({
  id,
  label,
  count,
  collapsible,
  children,
}: BoardColumnProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const { setNodeRef, isOver } = useDroppable({ id });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`board-column-${id}`}
      className={cn(
        "flex flex-col rounded-xl border bg-card",
        collapsible && collapsed ? "w-11 shrink-0" : "w-[220px] shrink-0",
        isOver && "ring-2 ring-brand",
      )}
    >
      <button
        type="button"
        onClick={collapsible ? toggle : undefined}
        aria-expanded={collapsible ? !collapsed : undefined}
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold border-b",
          collapsible &&
            collapsed &&
            "flex-col h-full [writing-mode:vertical-rl]",
          !collapsible && "cursor-default",
        )}
      >
        <span className="flex items-center gap-1">
          {collapsible &&
            (collapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            ))}
          {label}
        </span>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
          {count}
        </span>
      </button>
      {!(collapsible && collapsed) && (
        <div className="flex-1 min-h-[120px] max-h-[calc(100vh-16rem)] overflow-y-auto p-2 space-y-2">
          {count === 0 ? (
            <div className="text-center text-xs text-muted-foreground/60 py-4">
              —
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
