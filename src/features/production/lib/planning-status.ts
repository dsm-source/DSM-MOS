import type { BatchWithContext } from "../hooks/use-batches";

export type PlanningStatus = "on_track" | "overdue";

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? null : dt;
}

export function computeStatus(
  batch: BatchWithContext,
): PlanningStatus | "unscheduled" {
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
