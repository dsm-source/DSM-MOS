/**
 * Beri batas waktu pada satu request query. Request Supabase yang menggantung
 * (koneksi stalled, request diblok) tidak pernah reject sendiri, sehingga
 * React Query tetap `isLoading` selamanya dan UI stuck di spinner tanpa error
 * notice. Gabungkan sinyal abort dari React Query (`queryFn({ signal })`)
 * dengan timeout lokal supaya request semacam itu jatuh ke error state.
 *
 * Pakai: `.abortSignal(withQueryTimeout(signal))` pada builder Supabase.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

export function withQueryTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("Permintaan data melebihi batas waktu.")),
    timeoutMs,
  );
  controller.signal.addEventListener("abort", () => clearTimeout(timer), {
    once: true,
  });
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        once: true,
      });
  }
  return controller.signal;
}
