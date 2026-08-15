import type { PostgrestError } from "@supabase/supabase-js";

/** Petakan error Postgres/Postgrest ke pesan manusiawi bahasa Indonesia. */
export function mapPgError(err: PostgrestError | Error | null | undefined, fallback = "Terjadi kesalahan"): string {
  if (!err) return fallback;
  const anyErr = err as PostgrestError & { code?: string; message?: string };
  const code = anyErr.code;
  const msg = anyErr.message ?? fallback;

  if (code === "23505") return "Data sudah ada (nomor/kode sudah digunakan).";
  if (code === "23503") return "Data terkait tidak ditemukan atau masih dipakai oleh data lain.";
  if (code === "23514") return "Data tidak memenuhi aturan (mis. kuantitas harus > 0).";
  if (code === "P0001") return msg; // raise exception dari trigger — sudah manusiawi
  if (code === "42501" || msg.toLowerCase().includes("permission")) {
    return "Anda tidak memiliki izin untuk aksi ini.";
  }
  return msg;
}
