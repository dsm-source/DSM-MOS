import { StatusPill } from "@/components/status-pill";
import { STEP_STATUS_META } from "../lib/process";
import type { ProductionStepStatus } from "../types";

export function StepStatusBadge({
  status,
  className,
}: {
  status: ProductionStepStatus;
  className?: string;
}) {
  return <StatusPill {...STEP_STATUS_META[status]} className={className} />;
}
