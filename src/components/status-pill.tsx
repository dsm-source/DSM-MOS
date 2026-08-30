import { cn } from "@/lib/utils";
import { toneClass, type StatusMeta } from "@/lib/status-tone";

export function StatusPill({
  icon: Icon,
  label,
  tone,
  className,
}: StatusMeta & { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass(tone),
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
