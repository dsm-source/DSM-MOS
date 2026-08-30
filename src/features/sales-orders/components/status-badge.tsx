import { StatusPill } from "@/components/status-pill";
import { SO_STATUS_META } from "../lib/status";
import type { SalesOrderStatus } from "../types";

export function StatusBadge({
  status,
  className,
}: {
  status: SalesOrderStatus;
  className?: string;
}) {
  return <StatusPill {...SO_STATUS_META[status]} className={className} />;
}
