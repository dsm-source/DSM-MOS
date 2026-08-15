import { Badge } from "@/components/ui/badge";
import { DELIVERY_STATUS_LABEL } from "../lib/status";
import type { DeliveryStatus } from "../types";

const CLS: Record<DeliveryStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  prepared:
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-transparent",
  shipped:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
  delivered:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
};

export function DeliveryStatusBadge({
  status,
  overdue = false,
}: {
  status: DeliveryStatus;
  overdue?: boolean;
}) {
  if (overdue && status !== "delivered") {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-transparent">
        Terlambat · {DELIVERY_STATUS_LABEL[status]}
      </Badge>
    );
  }
  return <Badge className={CLS[status]}>{DELIVERY_STATUS_LABEL[status]}</Badge>;
}
