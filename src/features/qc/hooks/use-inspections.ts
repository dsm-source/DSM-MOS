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

function useQcRealtimeInvalidate(channelName: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qc_inspections" },
        () => qc.invalidateQueries({ queryKey: QC_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, channelName]);
}

// Status yang masih perlu ditindaklanjuti QC — dibatasi status, bukan
// tanggal, karena antrian ini memang selalu kecil (item keluar begitu lulus).
const ACTIVE_QC_STATUSES: QcStatus[] = [
  "waiting",
  "inspection",
  "reject",
  "rework",
];

export function useQcActiveQueue() {
  useQcRealtimeInvalidate("qc-inspections-realtime-active");
  return useQuery({
    queryKey: [...QC_KEY, "active"],
    queryFn: async (): Promise<QcInspectionWithContext[]> => {
      const { data, error } = await supabase
        .from("qc_inspections")
        .select(SELECT)
        .in("status", ACTIVE_QC_STATUSES)
        .order("created_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []).map(normalize);
    },
  });
}

// Riwayat lulus: dibatasi rentang tanggal (default 90 hari, lihat qc.tsx)
// supaya tidak fetch seluruh histori QC selamanya seiring waktu.
// `toExclusive` harus sudah dihitung 1 hari setelah tanggal "sampai" yang
// dipilih user (batas atas eksklusif), supaya data hari itu sendiri ikut.
const HISTORY_LIMIT = 300;

export function useQcHistory(range: { from: string; toExclusive: string }) {
  useQcRealtimeInvalidate("qc-inspections-realtime-history");
  return useQuery({
    queryKey: [...QC_KEY, "history", range.from, range.toExclusive],
    queryFn: async (): Promise<QcInspectionWithContext[]> => {
      const { data, error } = await supabase
        .from("qc_inspections")
        .select(SELECT)
        .eq("status", "pass")
        .gte("created_at", range.from)
        .lt("created_at", range.toExclusive)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
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
