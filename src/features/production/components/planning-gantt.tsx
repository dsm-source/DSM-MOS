import { useMemo } from "react";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import type { BatchWithContext } from "../hooks/use-batches";
import { PROCESS_LABEL, STEP_STATUS_LABEL } from "../lib/process";

export type PlanningStatus = "on_track" | "overdue";

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? null : dt;
}

export function computeStatus(batch: BatchWithContext): PlanningStatus | "unscheduled" {
  const end = parseDate(batch.planned_completion_date);
  if (!batch.planned_start_date || !end) return "unscheduled";
  const allDone = (batch.steps ?? []).every(
    (s) => s.status === "completed" || s.status === "skipped",
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (end < today && !allDone) return "overdue";
  return "on_track";
}

function activeStep(batch: BatchWithContext) {
  return (batch.steps ?? []).find((s) => s.status === "running") ?? null;
}

export function PlanningGantt({
  batches,
  viewMode,
  onSelect,
}: {
  batches: BatchWithContext[];
  viewMode: ViewMode;
  onSelect: (batch: BatchWithContext) => void;
}) {
  const { tasks, batchById } = useMemo(() => {
    const tasks: Task[] = [];
    const batchById = new Map<string, BatchWithContext>();

    for (const b of batches) {
      const start = parseDate(b.planned_start_date);
      const end = parseDate(b.planned_completion_date);
      if (!start || !end) continue;

      const status = computeStatus(b);
      const overdue = status === "overdue";
      const active = activeStep(b);
      const item = b.engineering_job?.sales_order_item;
      const so = item?.sales_order;
      const activeLabel = active
        ? ` · ${PROCESS_LABEL[active.process]} (${STEP_STATUS_LABEL[active.status]})`
        : "";

      const barBg = overdue ? "hsl(0 84% 60%)" : "hsl(217 91% 60%)";
      const barBgSel = overdue ? "hsl(0 84% 50%)" : "hsl(217 91% 50%)";
      const progressBg = overdue ? "hsl(0 74% 45%)" : "hsl(217 91% 45%)";

      const endInclusive = new Date(end);
      endInclusive.setHours(23, 59, 59, 0);

      tasks.push({
        id: b.id,
        name: `${b.batch_number} · ${item?.item_name ?? "?"} · SO ${so?.so_number ?? "?"}${activeLabel}${overdue ? " · Terlambat dari rencana" : ""}`,
        start,
        end: endInclusive,
        type: "task",
        progress: 0,
        isDisabled: false,
        styles: {
          backgroundColor: barBg,
          backgroundSelectedColor: barBgSel,
          progressColor: progressBg,
          progressSelectedColor: progressBg,
        },
      });
      batchById.set(b.id, b);

      const delivery = parseDate(b.estimated_delivery_date);
      if (delivery) {
        const dEnd = new Date(delivery);
        dEnd.setHours(23, 59, 59, 0);
        const mid = `${b.id}::milestone`;
        tasks.push({
          id: mid,
          name: `◆ Est. kirim ${b.batch_number}`,
          start: delivery,
          end: dEnd,
          type: "milestone",
          progress: 0,
          isDisabled: true,
          styles: {
            backgroundColor: "hsl(280 70% 55%)",
            backgroundSelectedColor: "hsl(280 70% 45%)",
            progressColor: "hsl(280 70% 45%)",
            progressSelectedColor: "hsl(280 70% 45%)",
          },
        });
      }
    }

    return { tasks, batchById };
  }, [batches]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        Tidak ada batch berjadwal untuk filter ini.
      </div>
    );
  }

  const columnWidth = viewMode === ViewMode.Month ? 220 : 90;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Gantt
        tasks={tasks}
        viewMode={viewMode}
        listCellWidth="360px"
        columnWidth={columnWidth}
        barCornerRadius={4}
        barBackgroundColor="hsl(217 91% 60%)"
        barProgressColor="hsl(217 91% 45%)"
        milestoneBackgroundColor="hsl(280 70% 55%)"
        onSelect={(task, isSelected) => {
          if (!isSelected) return;
          const b = batchById.get(task.id);
          if (b) onSelect(b);
        }}
        onDoubleClick={(task) => {
          const b = batchById.get(task.id);
          if (b) onSelect(b);
        }}
      />
    </div>
  );
}
