import { Clock, Search, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import type { QcStatus } from "../types";

export const QC_STATUS_LABEL: Record<QcStatus, string> = {
  waiting: "Menunggu",
  inspection: "Inspeksi",
  pass: "Lulus",
  reject: "Tolak",
  rework: "Rework",
};

export const QC_STATUS_CLASS: Record<QcStatus, string> = {
  waiting:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600",
  inspection:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
  pass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  reject:
    "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
  rework:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
};

export const QC_STATUS_ICON: Record<QcStatus, typeof Clock> = {
  waiting: Clock,
  inspection: Search,
  pass: CheckCircle2,
  reject: XCircle,
  rework: RotateCcw,
};

export const QC_STATUS_ORDER: QcStatus[] = [
  "waiting",
  "inspection",
  "reject",
  "rework",
  "pass",
];
