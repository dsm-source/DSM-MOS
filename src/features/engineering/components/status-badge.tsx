import { StatusPill } from "@/components/status-pill";
import { ENG_STATUS_META } from "../lib/status";
import type { EngineeringStatus } from "../types";

export function EngStatusBadge({
  status,
  className,
}: {
  status: EngineeringStatus;
  className?: string;
}) {
  return <StatusPill {...ENG_STATUS_META[status]} className={className} />;
}
