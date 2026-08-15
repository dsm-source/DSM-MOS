import { forwardRef } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { announceError, toUserError, type UserError } from "@/lib/error-message";
import { cn } from "@/lib/utils";

type Props = {
  /** Error mentah — akan dipetakan ke judul/detail standar. */
  error: unknown;
  /** Judul standar aksi yang gagal, mis. "Gagal memuat riwayat blocker". */
  title?: string;
  /** Label tombol call-to-action. Default: "Coba lagi". */
  actionLabel?: string;
  /** Handler tombol. Tanpa ini tombol tidak dirender. */
  onRetry?: () => void;
  /** Teks tambahan yang dibacakan pembaca layar (mis. "Email fallback dipakai."). */
  srExtra?: string;
  /** Teks tambahan yang ikut tampil setelah detail. */
  hint?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Tampilan error tunggal untuk seluruh aplikasi: ikon + judul + detail + CTA.
 * Aksesibilitas: satu live region assertive (sr-only) berisi kalimat utuh,
 * bagian visual di-`aria-hidden` agar tidak dibacakan ganda.
 */
export const ErrorNotice = forwardRef<HTMLButtonElement, Props>(function ErrorNotice(
  { error, title, actionLabel, onRetry, srExtra, hint, className, compact }: Props,
  retryRef,
) {
  const e: UserError = toUserError(error, { title, action: actionLabel });

  return (
    <>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {announceError(e, srExtra)}
      </div>
      <div
        className={cn(
          "flex items-start justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 text-destructive",
          compact ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
          className,
        )}
      >
        <span className="flex items-start gap-2 min-w-0" aria-hidden="true">
          <AlertCircle className={cn("shrink-0", compact ? "h-4 w-4 mt-px" : "h-4 w-4 mt-0.5")} />
          <span className="min-w-0">
            <span className="font-medium">{e.title}:</span> <span>{e.detail}</span>
            {hint ? <span className="opacity-90"> {hint}</span> : null}
          </span>
        </span>
        {onRetry && (
          <Button
            ref={retryRef}
            type="button"
            variant="ghost"
            size="sm"
            className={cn("shrink-0", compact ? "h-6 px-2 text-xs" : "h-7 px-2 text-xs")}
            onClick={onRetry}
            aria-label={`${e.action} — ${e.title}`}
          >
            {e.action}
          </Button>
        )}
      </div>
    </>
  );
});
