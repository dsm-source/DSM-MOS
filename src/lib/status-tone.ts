import type { LucideIcon } from "lucide-react";

/**
 * Semantic tone for a status. Every status across the app maps to one of these
 * — the tone carries the meaning, the icon and label carry the specifics, so no
 * status relies on colour alone (WCAG 1.4.1).
 */
export type StatusTone =
  | "neutral" // inactive / draft / queued
  | "active" // in progress / running
  | "attention" // needs a decision / paused / flagged
  | "success" // done / approved / passed
  | "danger"; // rejected / failed

export type StatusMeta = {
  label: string;
  icon: LucideIcon;
  tone: StatusTone;
};

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  active:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-900",
  attention:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900",
  success:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900",
  danger:
    "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-200 dark:border-red-900",
};

export function toneClass(tone: StatusTone): string {
  return TONE_CLASS[tone];
}
