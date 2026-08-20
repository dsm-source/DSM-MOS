import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { ProductionBatchRow, ProductionBatchStepRow } from "../types";

function toRouting(processes: string[]) {
  return processes.map((process, i) => ({ process, sequence_order: i + 1 }));
}

export type BatchWithContext = ProductionBatchRow & {
  engineering_job: {
    id: string;
    job_number: string;
    status: string;
    sales_order_item: {
      id: string;
      item_name: string;
      quantity: number;
      unit: string | null;
      sales_order: {
        id: string;
        so_number: string;
        customer: { id: string; name: string } | null;
      } | null;
    } | null;
    material_status: { status: string } | null;
  } | null;
  steps: ProductionBatchStepRow[];
};

const SELECT = `
  *,
  engineering_job:engineering_jobs!inner(
    id, job_number, status,
    sales_order_item:sales_order_items!inner(
      id, item_name, quantity, unit,
      sales_order:sales_orders!inner(
        id, so_number,
        customer:customers(id, name)
      )
    ),
    material_status:material_statuses(status)
  ),
  steps:production_batch_steps(*)
`;

const BATCHES_KEY = ["production-batches"] as const;

function normalize(row: unknown): BatchWithContext {
  const r = row as BatchWithContext & {
    engineering_job:
      | (BatchWithContext["engineering_job"] & {
          material_status: unknown;
          sales_order_item:
            | (NonNullable<
                BatchWithContext["engineering_job"]
              >["sales_order_item"] & {
                sales_order:
                  | (NonNullable<
                      NonNullable<
                        BatchWithContext["engineering_job"]
                      >["sales_order_item"]
                    >["sales_order"] & { customer: unknown })
                  | null;
              })
            | null;
        })
      | null;
  };
  if (r.engineering_job) {
    const ms = r.engineering_job.material_status as unknown;
    if (Array.isArray(ms)) {
      r.engineering_job.material_status =
        (ms[0] as { status: string } | undefined) ?? null;
    }
    const so = r.engineering_job.sales_order_item?.sales_order;
    if (so) {
      const cu = so.customer as unknown;
      if (Array.isArray(cu)) {
        so.customer =
          (cu[0] as { id: string; name: string } | undefined) ?? null;
      }
    }
  }
  r.steps = [...(r.steps ?? [])].sort(
    (a, b) => a.sequence_order - b.sequence_order,
  );
  return r;
}

/** Realtime + query untuk semua batch. */
export function useProductionBatches() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("production-batches-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_batches" },
        () => qc.invalidateQueries({ queryKey: BATCHES_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_batch_steps" },
        () => qc.invalidateQueries({ queryKey: BATCHES_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_statuses" },
        () => qc.invalidateQueries({ queryKey: BATCHES_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "engineering_jobs" },
        () => qc.invalidateQueries({ queryKey: BATCHES_KEY }),
      )
      .subscribe();

    const operatorsChannel = supabase
      .channel("operators-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operators" },
        () => qc.invalidateQueries({ queryKey: ["operators"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(operatorsChannel);
    };
  }, [qc]);

  return useQuery({
    queryKey: BATCHES_KEY,
    queryFn: async (): Promise<BatchWithContext[]> => {
      const { data, error } = await supabase
        .from("production_batches")
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []).map(normalize);
    },
  });
}

export function useBatchesForJob(jobId: string | undefined) {
  return useQuery({
    enabled: !!jobId,
    queryKey: [...BATCHES_KEY, "job", jobId],
    queryFn: async (): Promise<BatchWithContext[]> => {
      const { data, error } = await supabase
        .from("production_batches")
        .select(SELECT)
        .eq("engineering_job_id", jobId!)
        .order("created_at", { ascending: true });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []).map(normalize);
    },
  });
}

export type CreateBatchInput = {
  engineering_job_id: string;
  quantity: number;
  planned_start_date: string | null;
  planned_completion_date: string | null;
  estimated_delivery_date: string | null;
  notes: string | null;
  routing: string[];
};

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBatchInput) => {
      const { data, error } = await supabase
        .from("production_batches")
        .insert({
          engineering_job_id: input.engineering_job_id,
          quantity: input.quantity,
          planned_start_date: input.planned_start_date,
          planned_completion_date: input.planned_completion_date,
          estimated_delivery_date: input.estimated_delivery_date,
          notes: input.notes,
          routing: toRouting(input.routing),
          // batch_number diisi trigger database
        } as never)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BATCHES_KEY });
    },
  });
}

export type UpdateBatchPlanInput = {
  id: string;
  planned_start_date: string | null;
  planned_completion_date: string | null;
  estimated_delivery_date: string | null;
  notes?: string | null;
  routing?: string[];
};

export function useUpdateBatchPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBatchPlanInput) => {
      const patch: Record<string, unknown> = {
        planned_start_date: input.planned_start_date,
        planned_completion_date: input.planned_completion_date,
        estimated_delivery_date: input.estimated_delivery_date,
      };
      if (input.notes !== undefined) patch.notes = input.notes;
      if (input.routing !== undefined) patch.routing = toRouting(input.routing);
      const { data, error } = await supabase
        .from("production_batches")
        .update(patch as never)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BATCHES_KEY }),
  });
}
