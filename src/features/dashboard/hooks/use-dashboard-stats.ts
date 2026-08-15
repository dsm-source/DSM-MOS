import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SoStatusRow = { status: string; count: number };

export function useSoStatusCounts() {
  return useQuery({
    queryKey: ["dashboard", "so-status"],
    queryFn: async (): Promise<SoStatusRow[]> => {
      const { data, error } = await supabase.from("v_dashboard_so_status").select("status, count");
      if (error) throw error;
      return (data ?? []).map((r) => ({ status: r.status as string, count: Number(r.count) }));
    },
  });
}

export function useMaterialWaitingCount() {
  return useQuery({
    queryKey: ["dashboard", "material-waiting"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("v_dashboard_material_waiting")
        .select("count")
        .maybeSingle();
      if (error) throw error;
      return Number(data?.count ?? 0);
    },
  });
}

export function useProductionRunningCount() {
  return useQuery({
    queryKey: ["dashboard", "production-running"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("v_dashboard_production_running")
        .select("count")
        .maybeSingle();
      if (error) throw error;
      return Number(data?.count ?? 0);
    },
  });
}
