import type { EngineeringStatus } from "../types";

export const ENG_STATUS_LABEL: Record<EngineeringStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  review: "Review",
  approved: "Approved",
};

export const ENG_STATUS_CLASS: Record<EngineeringStatus, string> = {
  draft:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  in_progress:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800",
  review:
    "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800",
  approved:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800",
};

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
