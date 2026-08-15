import { cn } from "@/lib/utils";
import {
  STEP_STATUS_CLASS,
  STEP_STATUS_ICON,
  STEP_STATUS_LABEL,
} from "../lib/process";
import type { ProductionStepStatus } from "../types";

export function StepStatusBadge({
  status,
  className,
}: {
  status: ProductionStepStatus;
  className?: string;
}) {
  const Icon = STEP_STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        STEP_STATUS_CLASS[status],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {STEP_STATUS_LABEL[status]}
    </span>
  );
}
