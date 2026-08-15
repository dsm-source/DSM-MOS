import { toast } from "sonner";
import { mapPgError } from "./pg-error";

/**
 * Format pesan error standar aplikasi.
 * - `title`  : ringkas, menjelaskan aksi apa yang gagal (mis. "Gagal menyimpan sales order")
 * - `detail` : penyebab yang sudah manusiawi (hasil mapPgError / message)
 * - `action` : label call-to-action tombol (mis. "Coba lagi")
 */
export type UserError = {
  title: string;
  detail: string;
  action: string;
};

export const DEFAULT_ERROR_TITLE = "Terjadi kesalahan";
export const DEFAULT_ERROR_ACTION = "Coba lagi";

function extractDetail(err: unknown): string {
  if (!err) return "Penyebab tidak diketahui.";
  if (typeof err === "string") return err;
  if (
    err instanceof Error ||
    (typeof err === "object" && "message" in (err as object))
  ) {
    return mapPgError(err as Error);
  }
  return "Penyebab tidak diketahui.";
}

/** Ubah error apa pun menjadi struktur pesan yang konsisten untuk UI. */
export function toUserError(
  err: unknown,
  opts?: { title?: string; action?: string },
): UserError {
  return {
    title: opts?.title ?? DEFAULT_ERROR_TITLE,
    detail: extractDetail(err),
    action: opts?.action ?? DEFAULT_ERROR_ACTION,
  };
}

/**
 * Kalimat tunggal untuk pembaca layar / live region.
 * Contoh: "Gagal menyimpan sales order: Nomor dokumen sudah digunakan. Coba lagi."
 */
export function announceError(e: UserError, extra?: string): string {
  return [`${e.title}: ${e.detail}`, extra, `Tindakan tersedia: ${e.action}.`]
    .filter(Boolean)
    .join(" ");
}

/** Toast error dengan format judul + detail yang seragam. */
export function notifyError(
  err: unknown,
  opts?: { title?: string },
): UserError {
  const e = toUserError(err, opts);
  toast.error(e.title, { description: e.detail });
  return e;
}
