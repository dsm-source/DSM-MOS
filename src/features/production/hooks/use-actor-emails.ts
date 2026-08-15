import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Cache resolusi user_id -> email lintas komponen (Riwayat Blocker, ekspor, dsb).
// Setiap user_id disimpan sebagai entry TanStack Query terpisah agar bisa
// dipakai ulang antar batch tanpa memanggil RPC berkali-kali.
//
// Permintaan yang sedang berjalan (in-flight) juga dideduplikasi per user_id:
// kalau dua komponen membutuhkan user_id yang sama sebelum cache terisi,
// keduanya menunggu satu RPC yang sama.

const STALE_MS = 10 * 60 * 1000; // 10 menit
const GC_MS = 60 * 60 * 1000; // 1 jam

const actorEmailKey = (userId: string) => ["actor-email", userId] as const;

type EmailRow = { id: string; email: string | null };

// Promise yang sedang menunggu hasil RPC untuk user_id tertentu.
const inFlightEmails = new Map<string, Promise<string | null>>();

// Retry dengan exponential backoff untuk RPC yang gagal karena masalah
// sementara (jaringan putus, 5xx, timeout). Error permanen (misalnya RLS/
// permission) langsung dilempar tanpa retry supaya user tidak menunggu sia-sia.
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 4000;

function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; status?: number; message?: string; name?: string };
  const code = e.code ?? "";
  const status = e.status ?? 0;
  const msg = (e.message ?? "").toLowerCase();
  if (e.name === "AbortError") return false;
  if (status >= 500 && status < 600) return true;
  if (status === 408 || status === 429) return true;
  // PostgREST / fetch network errors biasanya tanpa status atau berkode
  // 'PGRST' generik; anggap transient bila tidak ada status HTTP.
  if (
    !status &&
    (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout"))
  ) {
    return true;
  }
  // Kode Postgres transient (deadlock/serialization).
  if (code === "40001" || code === "40P01") return true;
  return false;
}

function backoffDelay(attempt: number): number {
  const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  // Full jitter agar banyak klien tidak retry bersamaan.
  return Math.floor(Math.random() * base);
}

async function rpcOnce(userIds: string[]): Promise<EmailRow[]> {
  const { data, error } = await supabase.rpc("get_actor_emails", {
    _user_ids: userIds,
  });
  if (error) throw error;
  return (data ?? []) as EmailRow[];
}

async function fetchEmails(userIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (userIds.length === 0) return map;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const rows = await rpcOnce(userIds);
      for (const row of rows) {
        map.set(row.id, row.email ?? null);
      }
      // User yang tidak dikembalikan tetap di-cache sebagai null agar tidak
      // diminta ulang saat batch berikutnya menyertakannya lagi.
      for (const id of userIds) if (!map.has(id)) map.set(id, null);
      return map;
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === MAX_ATTEMPTS - 1) break;
      await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Gagal memuat nama aktor");
}

function isFreshCache(
  queryClient: QueryClient,
  userId: string,
): { fresh: true; email: string | null } | { fresh: false } {
  const cached = queryClient.getQueryState<string | null>(actorEmailKey(userId));
  const fresh =
    cached?.data !== undefined &&
    cached.dataUpdatedAt > Date.now() - STALE_MS &&
    cached.status === "success" &&
    !cached.isInvalidated;
  if (fresh) {
    return { fresh: true, email: cached!.data ?? null };
  }
  return { fresh: false };
}

/**
 * Ambil email untuk banyak user_id sekaligus, memanfaatkan cache TanStack Query.
 * Hanya user_id yang belum ada di cache (atau sudah basi) yang di-fetch via RPC.
 * Permintaan yang masih berlangsung untuk user_id yang sama akan berbagi satu RPC.
 */
export async function resolveActorEmails(
  queryClient: QueryClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const result = new Map<string, string | null>();
  const missing: string[] = [];
  const pending: Promise<void>[] = [];

  for (const id of unique) {
    const cached = isFreshCache(queryClient, id);
    if (cached.fresh) {
      result.set(id, cached.email);
      continue;
    }

    const flight = inFlightEmails.get(id);
    if (flight) {
      pending.push(
        flight.then((email) => {
          result.set(id, email);
        }),
      );
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    const fetchPromise = fetchEmails(missing)
      .then((fetched) => {
        for (const id of missing) {
          const email = fetched.get(id) ?? null;
          queryClient.setQueryData(actorEmailKey(id), email);
        }
        return fetched;
      })
      .finally(() => {
        for (const id of missing) {
          inFlightEmails.delete(id);
        }
      });

    for (const id of missing) {
      const perIdPromise = fetchPromise.then((fetched) => fetched.get(id) ?? null);
      inFlightEmails.set(id, perIdPromise);
      pending.push(
        perIdPromise.then((email) => {
          result.set(id, email);
        }),
      );
    }
  }

  await Promise.all(pending);
  return result;
}

/**
 * Tandai semua cache actor-email sebagai basi. Panggil saat berpindah batch
 * atau saat user logout supaya lookup berikutnya mengambil data segar dari RPC.
 */
export function invalidateActorEmails(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["actor-email"] });
  queryClient.invalidateQueries({ queryKey: ["actor-emails"] });
}

/**
 * Hapus seluruh cache actor-email. Dipakai saat logout agar tidak ada residu
 * email pengguna sebelumnya di memori.
 */
export function clearActorEmails(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: ["actor-email"] });
  queryClient.removeQueries({ queryKey: ["actor-emails"] });
}

/**
 * Versi hook untuk komponen yang hanya butuh sekumpulan email.
 */
export function useActorEmails(userIds: string[]) {
  const qc = useQueryClient();
  const unique = Array.from(new Set(userIds.filter(Boolean))).sort();
  return useQuery({
    enabled: unique.length > 0,
    queryKey: ["actor-emails", unique],
    queryFn: () => resolveActorEmails(qc, unique),
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
