import { Play, Pause, CheckCircle2, MinusCircle } from "lucide-react";
import type { BatchWithContext } from "../hooks/use-batches";
import { computeStartBlocker } from "./start-blocker";
import type { ProductionBatchStepRow, ProductionStepStatus } from "../types";

export type StepAction = {
  key: string;
  label: string;
  icon: typeof Play;
  toStatus: ProductionStepStatus;
  needsOperator: boolean;
  confirmLabel?: string;
  variant?: "default" | "outline";
};

/**
 * Aksi yang boleh dilakukan Production role dari status saat ini.
 * PRD §7 rule #3: transisi ke "rework" tidak boleh lewat UI Production —
 * hanya lewat RPC Trigger Rework (role qc/admin) di M6.
 */
export function actionsFor(status: ProductionStepStatus): StepAction[] {
  switch (status) {
    case "waiting":
      return [
        {
          key: "start",
          label: "Start",
          icon: Play,
          toStatus: "running",
          needsOperator: true,
        },
        {
          key: "skip",
          label: "Skip",
          icon: MinusCircle,
          toStatus: "skipped",
          needsOperator: false,
          variant: "outline",
        },
      ];
    case "running":
      return [
        {
          key: "pause",
          label: "Pause",
          icon: Pause,
          toStatus: "paused",
          needsOperator: false,
          variant: "outline",
        },
        {
          key: "complete",
          label: "Complete",
          icon: CheckCircle2,
          toStatus: "completed",
          needsOperator: false,
        },
      ];
    case "paused":
      return [
        {
          key: "resume",
          label: "Resume",
          icon: Play,
          toStatus: "running",
          needsOperator: false,
        },
        {
          key: "complete",
          label: "Complete",
          icon: CheckCircle2,
          toStatus: "completed",
          needsOperator: false,
          variant: "outline",
        },
      ];
    case "rework":
      return [
        {
          key: "restart",
          label: "Start Ulang",
          icon: Play,
          toStatus: "running",
          needsOperator: true,
          confirmLabel: "Mulai Ulang",
        },
        {
          key: "pause",
          label: "Pause",
          icon: Pause,
          toStatus: "paused",
          needsOperator: false,
          variant: "outline",
        },
        {
          key: "complete",
          label: "Complete",
          icon: CheckCircle2,
          toStatus: "completed",
          needsOperator: false,
        },
      ];
    case "completed":
    case "skipped":
    default:
      return [];
  }
}

/** Cek final apakah sebuah aksi harus disabled (dipakai kanban drag & drawer). */
export function isActionDisabled(
  step: ProductionBatchStepRow,
  batch: BatchWithContext,
  action: StepAction,
  isPending: boolean,
): boolean {
  const blocker = computeStartBlocker(step, batch);
  return (
    isPending ||
    (action.toStatus === "running" && !!blocker && step.status === "waiting")
  );
}
