import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withQueryTimeout } from "@/lib/query-timeout";

export type SoStatusRow = { status: string; count: number };

export function useSoStatusCounts() {
  return useQuery({
    queryKey: ["dashboard", "so-status"],
    queryFn: async ({ signal }): Promise<SoStatusRow[]> => {
      const { data, error } = await supabase
        .from("v_dashboard_so_status")
        .select("status, count")
        .abortSignal(withQueryTimeout(signal));
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
        .abortSignal(withQueryTimeout(signal))
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
        .abortSignal(withQueryTimeout(signal))
        .maybeSingle();
      if (error) throw error;
      return Number(data?.count ?? 0);
    },
    retry: 1,
  });
}
