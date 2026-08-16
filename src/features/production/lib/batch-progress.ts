import type { BatchWithContext } from "../hooks/use-batches";
import type { ProductionBatchStepRow } from "../types";

export function activeStep(
  steps: ProductionBatchStepRow[],
): ProductionBatchStepRow | null {
  const sorted = [...steps].sort((a, b) => a.sequence_order - b.sequence_order);
  return (
    sorted.find((s) => s.status !== "completed" && s.status !== "skipped") ??
    null
  );
}

export function isBatchDone(steps: ProductionBatchStepRow[]): boolean {
  return (
    steps.length > 0 &&
    steps.every((s) => s.status === "completed" || s.status === "skipped")
  );
}

export function activeRunningStep(batch: BatchWithContext) {
  return (batch.steps ?? []).find((s) => s.status === "running") ?? null;
}
