import type { DeliveryWithContext } from "../types";

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? null : dt;
}

export function isOverdue(d: DeliveryWithContext): boolean {
  if (d.status === "delivered") return false;
  const end = parseDate(d.planned_delivery_date);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}
