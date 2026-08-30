import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SoStatusRow = { status: string; count: number };

/** Batas waktu request statistik dashboard; request yang menggantung
 *  (mis. koneksi stalled) diabort agar jatuh ke error state, bukan spinner tanpa akhir. */
const DASHBOARD_QUERY_TIMEOUT_MS = 10_000;

/** Gabungkan sinyal abort dari React Query dengan timeout lokal. */
function withTimeout(signal: AbortSignal | undefined): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error("Permintaan data dashboard melebihi batas waktu."),
      ),
    DASHBOARD_QUERY_TIMEOUT_MS,
  );
  const cleanup = () => clearTimeout(timer);
  controller.signal.addEventListener("abort", cleanup, { once: true });
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        once: true,
      });
  }
  return controller.signal;
}

export function useSoStatusCounts() {
  return useQuery({
    queryKey: ["dashboard", "so-status"],
    queryFn: async ({ signal }): Promise<SoStatusRow[]> => {
      const { data, error } = await supabase
        .from("v_dashboard_so_status")
        .select("status, count")
        .abortSignal(withTimeout(signal));
      if (error) throw error;
      return (data ?? []).map((r) => ({
        status: r.status as string,
        count: Number(r.count),
      }));
    },
    retry: 1,
  });
}

export function useMaterialWaitingCount() {
  return useQuery({
    queryKey: ["dashboard", "material-waiting"],
    queryFn: async ({ signal }): Promise<number> => {
      const { data, error } = await supabase
        .from("v_dashboard_material_waiting")
        .select("count")
        .abortSignal(withTimeout(signal))
        .maybeSingle();
      if (error) throw error;
      return Number(data?.count ?? 0);
    },
    retry: 1,
  });
}

export function useProductionRunningCount() {
  return useQuery({
    queryKey: ["dashboard", "production-running"],
    queryFn: async ({ signal }): Promise<number> => {
      const { data, error } = await supabase
        .from("v_dashboard_production_running")
        .select("count")
        .abortSignal(withTimeout(signal))
        .maybeSingle();
      if (error) throw error;
      return Number(data?.count ?? 0);
    },
    retry: 1,
  });
}
