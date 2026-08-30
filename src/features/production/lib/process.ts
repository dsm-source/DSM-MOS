import {
  CircleCheckBig,
  Pause,
  Play,
  Clock,
  MinusCircle,
  RotateCcw,
} from "lucide-react";
import type { StatusMeta } from "@/lib/status-tone";
import type { ProductionProcess, ProductionStepStatus } from "../types";

export const PROCESS_LABEL: Record<ProductionProcess, string> = {
  laser_cutting: "Laser Cutting",
  bending: "Bending",
  welding_grinding: "Welding & Grinding",
  powder_coating: "Powder Coating",
  assembly: "Assembly",
};

export const STEP_STATUS_META: Record<ProductionStepStatus, StatusMeta> = {
  waiting: { label: "Menunggu", icon: Clock, tone: "neutral" },
  running: { label: "Berjalan", icon: Play, tone: "active" },
  paused: { label: "Dijeda", icon: Pause, tone: "attention" },
  completed: { label: "Selesai", icon: CircleCheckBig, tone: "success" },
  skipped: { label: "Dilewati", icon: MinusCircle, tone: "neutral" },
  rework: { label: "Rework", icon: RotateCcw, tone: "attention" },
};

export const STEP_STATUS_LABEL: Record<ProductionStepStatus, string> =
  Object.fromEntries(
    Object.entries(STEP_STATUS_META).map(([k, v]) => [k, v.label]),
  ) as Record<ProductionStepStatus, string>;

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
