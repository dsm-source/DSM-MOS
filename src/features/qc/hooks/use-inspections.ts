import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { QcInspectionWithContext, QcStatus } from "../types";

const SELECT = `
  *,
  production_batch_step:production_batch_steps!inner(
    id, process, sequence_order, status,
    production_batch:production_batches!inner(
      id, batch_number, quantity,
      engineering_job:engineering_jobs!inner(
        id, job_number,
        sales_order_item:sales_order_items!inner(
          id, item_name, unit,
          sales_order:sales_orders!inner(
            id, so_number,
            customer:customers(id, name)
          )
        )
      )
    )
  )
`;

const QC_KEY = ["qc-inspections"] as const;

function normalize(row: unknown): QcInspectionWithContext {
  const r = row as QcInspectionWithContext & {
    production_batch_step:
      | (NonNullable<QcInspectionWithContext["production_batch_step"]> & {
          production_batch:
            | (NonNullable<
                NonNullable<
                  QcInspectionWithContext["production_batch_step"]
                >["production_batch"]
              > & {
                engineering_job:
                  | (NonNullable<
                      NonNullable<
                        NonNullable<
                          QcInspectionWithContext["production_batch_step"]
                        >["production_batch"]
                      >["engineering_job"]
                    > & {
                      sales_order_item:
                        | (NonNullable<
                            NonNullable<
                              NonNullable<
                                NonNullable<
                                  QcInspectionWithContext["production_batch_step"]
                                >["production_batch"]
                              >["engineering_job"]
                            >["sales_order_item"]
                          > & {
                            sales_order:
                              | (NonNullable<
                                  NonNullable<
                                    NonNullable<
                                      NonNullable<
                                        NonNullable<
                                          QcInspectionWithContext["production_batch_step"]
                                        >["production_batch"]
                                      >["engineering_job"]
                                    >["sales_order_item"]
                                  >["sales_order"]
                                > & { customer: unknown })
                              | null;
                          })
                        | null;
                    })
                  | null;
              })
            | null;
        })
      | null;
  };
  const so =
    r.production_batch_step?.production_batch?.engineering_job?.sales_order_item
      ?.sales_order;
  if (so) {
    const cu = so.customer as unknown;
    if (Array.isArray(cu))
      so.customer = (cu[0] as { id: string; name: string } | undefined) ?? null;
  }
  return r;
}

export function useQcInspections() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("qc-inspections-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qc_inspections" },
        () => qc.invalidateQueries({ queryKey: QC_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: QC_KEY,
    queryFn: async (): Promise<QcInspectionWithContext[]> => {
      const { data, error } = await supabase
        .from("qc_inspections")
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []).map(normalize);
    },
  });
}

export function useQcInspectionsForStep(stepId: string | undefined) {
  return useQuery({
    enabled: !!stepId,
    queryKey: [...QC_KEY, "step", stepId],
    queryFn: async (): Promise<QcInspectionWithContext[]> => {
      const { data, error } = await supabase
        .from("qc_inspections")
        .select(SELECT)
        .eq("production_batch_step_id", stepId!)
        .order("created_at", { ascending: true });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []).map(normalize);
    },
  });
}

export type UpdateInspectionInput = {
  id: string;
  status?: QcStatus;
  qty_total?: number;
  qty_ok?: number;
  qty_reject?: number;
  defect_notes?: string | null;
};

export function useUpdateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInspectionInput) => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from("qc_inspections")
        .update(patch as never)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QC_KEY }),
  });
}

export function useTriggerRework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (qcInspectionId: string) => {
      const { error } = await supabase.rpc("trigger_rework", {
        _qc_inspection_id: qcInspectionId,
      });
      if (error) throw new Error(mapPgError(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QC_KEY }),
  });
}
