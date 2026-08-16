import { PROCESS_LABEL } from "./process";
import type { BatchWithContext } from "../hooks/use-batches";
import type { ProductionBatchStepRow } from "../types";

export type StationBlockReason = null | {
  message: string;
  kind: "engineering" | "material" | "previous_step";
};

export function computeStartBlocker(
  step: ProductionBatchStepRow,
  batch: BatchWithContext,
): StationBlockReason {
  if (step.status !== "waiting") return null;
  const prev = [...batch.steps]
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .filter(
      (s) => s.sequence_order < step.sequence_order && s.status !== "skipped",
    )
    .pop();

  if (!prev) {
    const eng = batch.engineering_job?.status;
    const mat = batch.engineering_job?.material_status?.status;
    if (eng !== "approved") {
      return { message: "Menunggu approval engineering", kind: "engineering" };
    }
    if (mat !== "material_ready") {
      return { message: "Menunggu material ready", kind: "material" };
    }
    return null;
  }

  if (prev.status !== "completed") {
    return {
      message: `Menunggu ${PROCESS_LABEL[prev.process]} selesai`,
      kind: "previous_step",
    };
  }

  return null;
}
