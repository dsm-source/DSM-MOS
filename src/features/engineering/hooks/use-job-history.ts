import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";

export type JobHistoryRow = {
  id: string;
  engineering_job_id: string;
  field_changed: string;
  from_value: string | null;
  to_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

export function useEngineeringJobHistory(jobId: string | undefined) {
  return useQuery({
    enabled: !!jobId,
    queryKey: ["engineering-job-history", jobId],
    queryFn: async (): Promise<JobHistoryRow[]> => {
      const { data, error } = await supabase
        .from("engineering_job_history")
        .select("*")
        .eq("engineering_job_id", jobId!)
        .order("changed_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []) as JobHistoryRow[];
    },
  });
}
