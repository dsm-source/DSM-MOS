import { useMemo } from "react";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import {
  DELIVERY_STATUS_COLOR,
  DELIVERY_STATUS_LABEL,
  OVERDUE_COLOR,
} from "../lib/status";
import { isOverdue } from "../lib/is-overdue";
import type { DeliveryWithContext } from "../types";

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? null : dt;
}

export function DeliveryGantt({
  deliveries,
  viewMode,
  onSelect,
}: {
  deliveries: DeliveryWithContext[];
  viewMode: ViewMode;
  onSelect: (delivery: DeliveryWithContext) => void;
}) {
  const { tasks, byId } = useMemo(() => {
    const tasks: Task[] = [];
    const byId = new Map<string, DeliveryWithContext>();

    for (const d of deliveries) {
      const start = parseDate(d.planned_ship_date);
      const end = parseDate(d.planned_delivery_date);
      if (!start || !end) continue;

      const overdue = isOverdue(d);
      const palette = overdue ? OVERDUE_COLOR : DELIVERY_STATUS_COLOR[d.status];
      const endInclusive = new Date(end);
      endInclusive.setHours(23, 59, 59, 0);

      const name =
        `${d.do_number} · ${d.sales_order?.customer?.name ?? "-"} · SO ${d.sales_order?.so_number ?? "?"}` +
        ` · ${DELIVERY_STATUS_LABEL[d.status]}` +
        (overdue ? " · Terlambat" : "");

      tasks.push({
        id: d.id,
        name,
        start,
        end: endInclusive,
        type: "task",
        progress: 0,
        isDisabled: false,
        styles: {
          backgroundColor: palette.bg,
          backgroundSelectedColor: palette.bgSel,
          progressColor: palette.progress,
          progressSelectedColor: palette.progress,
        },
      });
      byId.set(d.id, d);
    }
    return { tasks, byId };
  }, [deliveries]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        Tidak ada pengiriman berjadwal untuk filter ini.
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
        onSelect={(task, selected) => {
          if (!selected) return;
          const d = byId.get(task.id);
          if (d) onSelect(d);
        }}
        onDoubleClick={(task) => {
          const d = byId.get(task.id);
          if (d) onSelect(d);
        }}
      />
    </div>
  );
}
