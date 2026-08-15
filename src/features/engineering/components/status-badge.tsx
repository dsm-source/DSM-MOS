import { cn } from "@/lib/utils";
import { ENG_STATUS_CLASS, ENG_STATUS_LABEL } from "../lib/status";
import type { EngineeringStatus } from "../types";

export function EngStatusBadge({
  status,
  className,
}: {
  status: EngineeringStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        ENG_STATUS_CLASS[status],
        className,
      )}
    >
      {ENG_STATUS_LABEL[status]}
    </span>
  );
}
