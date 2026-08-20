import {
  CheckCircle2,
  Pause,
  Play,
  Clock,
  MinusCircle,
  RotateCcw,
} from "lucide-react";
import type { ProductionProcess, ProductionStepStatus } from "../types";

export const PROCESS_LABEL: Record<ProductionProcess, string> = {
  laser_cutting: "Laser Cutting",
  bending: "Bending",
  welding_grinding: "Welding & Grinding",
  powder_coating: "Powder Coating",
  assembly: "Assembly",
};

export const STEP_STATUS_LABEL: Record<ProductionStepStatus, string> = {
  waiting: "Menunggu",
  running: "Berjalan",
  paused: "Dijeda",
  completed: "Selesai",
  skipped: "Dilewati",
  rework: "Rework",
};

export const STEP_STATUS_CLASS: Record<ProductionStepStatus, string> = {
  waiting:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  running:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800",
  paused:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800",
  completed:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800",
  skipped:
    "bg-zinc-200 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  rework:
    "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800",
};

export const STEP_STATUS_ICON: Record<ProductionStepStatus, typeof Play> = {
  waiting: Clock,
  running: Play,
  paused: Pause,
  completed: CheckCircle2,
  skipped: MinusCircle,
  rework: RotateCcw,
};

/** Format durasi sejak timestamp (mis. "2j 15m", "45m", "12d"). */
export function formatDurationSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const start = new Date(iso).getTime();
  const now = Date.now();
  let s = Math.max(0, Math.floor((now - start) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d}h ${h}j`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}
