import { activeStep, isBatchDone } from "./batch-progress";
import { computeStartBlocker } from "./start-blocker";
import { computeStatus } from "./planning-status";
import { PROCESS_LABEL } from "./process";
import { PRODUCTION_PROCESSES, type ProductionProcess } from "../types";
import type { BatchWithContext } from "../hooks/use-batches";

export type ColumnId = "antrian" | ProductionProcess | "selesai";

export const BOARD_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "antrian", label: "Antrian" },
  ...PRODUCTION_PROCESSES.map((p) => ({
    id: p as ColumnId,
    label: PROCESS_LABEL[p],
  })),
  { id: "selesai", label: "Selesai" },
];

export function assignColumn(batch: BatchWithContext): ColumnId {
  if (isBatchDone(batch.steps)) return "selesai";
  if (
    batch.steps.length > 0 &&
    batch.steps.every((s) => s.status === "waiting")
  ) {
    return "antrian";
  }
  const active = activeStep(batch.steps);
  return (active?.process ?? "antrian") as ColumnId;
}

export function isDraggable(batch: BatchWithContext): boolean {
  const active = activeStep(batch.steps);
  if (!active) return false;
  if (active.status !== "running" && active.status !== "paused") return false;
  if (computeStartBlocker(active, batch)) return false;
  return true;
}

export function nextColumnFor(batch: BatchWithContext): ColumnId | null {
  if (!isDraggable(batch)) return null;
  const active = activeStep(batch.steps)!;
  const next = [...batch.steps]
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .find(
      (s) => s.sequence_order > active.sequence_order && s.status !== "skipped",
    );
  return next ? (next.process as ColumnId) : "selesai";
}

export function canDropOn(batch: BatchWithContext, target: ColumnId): boolean {
  return nextColumnFor(batch) === target;
}

export function isAtRisk(batch: BatchWithContext): boolean {
  if (isBatchDone(batch.steps)) return false;
  if (computeStatus(batch) === "overdue") return true;
  if (!batch.planned_completion_date) return false;
  const end = new Date(batch.planned_completion_date + "T00:00:00").getTime();
  const twoDays = Date.now() + 2 * 24 * 60 * 60 * 1000;
  return end <= twoDays;
}
