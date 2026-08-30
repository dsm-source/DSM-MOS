import { TriangleAlert } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { DELIVERY_STATUS_META } from "../lib/status";
import type { DeliveryStatus } from "../types";

export function DeliveryStatusBadge({
  status,
  overdue = false,
}: {
  status: DeliveryStatus;
  overdue?: boolean;
}) {
  const meta = DELIVERY_STATUS_META[status];
  if (overdue && status !== "delivered") {
    return (
      <StatusPill
        icon={TriangleAlert}
        label={`Terlambat · ${meta.label}`}
        tone="danger"
      />
    );
  }
  return <StatusPill {...meta} />;
}
