import { StatusPill } from "@/components/status-pill";
import { QC_STATUS_META } from "../lib/status";
import type { QcStatus } from "../types";

export function QcStatusBadge({
  status,
  className,
}: {
  status: QcStatus;
  className?: string;
}) {
  return <StatusPill {...QC_STATUS_META[status]} className={className} />;
}
