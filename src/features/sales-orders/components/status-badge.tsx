import { cn } from "@/lib/utils";
import { STATUS_CLASS, STATUS_LABEL } from "../lib/status";
import type { SalesOrderStatus } from "../types";

export function StatusBadge({
  status,
  className,
}: {
  status: SalesOrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
