import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { ProductionStepStatus } from "../types";

export type UpdateStepInput = {
  id: string;
  status: ProductionStepStatus;
  qty_completed?: number;
  notes?: string | null;
};

export function useUpdateBatchStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateStepInput) => {
      const { id, ...values } = input;
      const { data, error } = await supabase
        .from("production_batch_steps")
        .update(values)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-batches"] });
    },
  });
}
