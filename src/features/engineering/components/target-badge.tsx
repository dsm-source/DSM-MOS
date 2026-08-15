import { AlertTriangle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysOverdue } from "../lib/status";
import type { EngineeringStatus } from "../types";

export function TargetBadge({
  target,
  status,
  className,
}: {
  target: string | null;
  status: EngineeringStatus;
  className?: string;
}) {
  if (!target) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <Calendar className="h-3 w-3" /> Target belum diset
      </span>
    );
  }
  const over = daysOverdue(target, status);
  const isOverdue = over > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        isOverdue
          ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800"
          : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",
        className,
      )}
      aria-label={isOverdue ? `Terlambat ${over} hari` : `Target ${target}`}
    >
      {isOverdue ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Calendar className="h-3 w-3" />
      )}
      <span>{target}</span>
      {isOverdue && <span>· Terlambat {over} hari</span>}
    </span>
  );
}
