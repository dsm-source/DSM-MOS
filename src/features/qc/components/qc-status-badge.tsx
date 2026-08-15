import { cn } from "@/lib/utils";
import { QC_STATUS_CLASS, QC_STATUS_ICON, QC_STATUS_LABEL } from "../lib/status";
import type { QcStatus } from "../types";

export function QcStatusBadge({ status, className }: { status: QcStatus; className?: string }) {
  const Icon = QC_STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        QC_STATUS_CLASS[status],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {QC_STATUS_LABEL[status]}
    </span>
  );
}
