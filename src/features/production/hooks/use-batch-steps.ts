import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { ProductionStepStatus } from "../types";
import type { BatchWithContext } from "./use-batches";

export type UpdateStepInput = {
  id: string;
  status: ProductionStepStatus;
  operator_id?: string | null;
  qty_completed?: number;
  notes?: string | null;
};

const BATCHES_KEY = ["production-batches"] as const;

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
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: BATCHES_KEY });
      const prev = qc.getQueryData<BatchWithContext[]>(BATCHES_KEY);
      qc.setQueryData<BatchWithContext[]>(BATCHES_KEY, (old) =>
        old?.map((batch) => ({
          ...batch,
          steps: batch.steps.map((step) =>
            step.id === input.id
              ? {
                  ...step,
                  status: input.status,
                  ...(input.operator_id !== undefined
                    ? { operator_id: input.operator_id }
                    : {}),
                }
              : step,
          ),
        })),
      );
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(BATCHES_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: BATCHES_KEY });
    },
  });
}
