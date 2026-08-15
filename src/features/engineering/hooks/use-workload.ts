import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";

export type WorkloadRow = {
  assigned_to: string;
  assignee_email: string | null;
  total_jobs: number;
  draft_count: number;
  in_progress_count: number;
  review_count: number;
  approved_count: number;
  avg_progress: number | null;
  overdue_count: number;
};

export function useEngineeringWorkload(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ["engineering-workload"],
    queryFn: async (): Promise<WorkloadRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_engineering_workload");
      if (error) throw new Error(mapPgError(error));
      return (data ?? []) as WorkloadRow[];
    },
  });
}
