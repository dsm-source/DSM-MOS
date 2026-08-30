import { FileText, CircleDashed, Eye, CircleCheckBig } from "lucide-react";
import type { StatusMeta } from "@/lib/status-tone";
import type { EngineeringStatus } from "../types";

export const ENG_STATUS_META: Record<EngineeringStatus, StatusMeta> = {
  draft: { label: "Draft", icon: FileText, tone: "neutral" },
  in_progress: { label: "In Progress", icon: CircleDashed, tone: "active" },
  review: { label: "Review", icon: Eye, tone: "attention" },
  approved: { label: "Approved", icon: CircleCheckBig, tone: "success" },
};

export const ENG_STATUS_LABEL: Record<EngineeringStatus, string> =
  Object.fromEntries(
    Object.entries(ENG_STATUS_META).map(([k, v]) => [k, v.label]),
  ) as Record<EngineeringStatus, string>;

export function daysOverdue(
  target: string | null,
  status: EngineeringStatus,
): number {
  if (!target || status === "approved") return 0;
  const t = new Date(target + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (today.getTime() - t.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff > 0 ? diff : 0;
}
