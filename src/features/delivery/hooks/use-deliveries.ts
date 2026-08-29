import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { DeliveryStatus, DeliveryWithContext } from "../types";

const SELECT = `
  *,
  sales_order:sales_orders!inner(
    id, so_number,
    customer:customers(id, name)
  ),
  delivery_items(*)
`;

const KEY = ["deliveries"] as const;

function normalize(row: unknown): DeliveryWithContext {
  const r = row as DeliveryWithContext & {
    sales_order: { customer: unknown } | null;
  };
  if (r.sales_order) {
    const cu = r.sales_order.customer as unknown;
    if (Array.isArray(cu))
      r.sales_order.customer =
        (cu[0] as { id: string; name: string } | undefined) ?? null;
  }
  return r;
}

function useDeliveriesRealtimeInvalidate() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("deliveries-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => qc.invalidateQueries({ queryKey: KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_items" },
        () => qc.invalidateQueries({ queryKey: KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

// Status yang masih "berjalan" — belum delivered. Ini default list supaya
// query tidak unbounded seiring histori pengiriman bertambah terus.
const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  "draft",
  "prepared",
  "shipped",
];
const LIST_LIMIT = 200;

export function useDeliveries(
  status: DeliveryStatus | "active" | "all" = "active",
) {
  useDeliveriesRealtimeInvalidate();
  return useQuery({
    queryKey: [...KEY, "list", status],
    queryFn: async (): Promise<DeliveryWithContext[]> => {
      let query = supabase
        .from("deliveries")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (status === "active")
        query = query.in("status", ACTIVE_DELIVERY_STATUSES);
      else if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(mapPgError(error));
      return (data ?? []).map(normalize);
    },
  });
}

// Untuk Gantt: fetch dibatasi rentang tanggal (bukan status), supaya volume
// terkendali seiring waktu tapi tetap tampilkan semua status untuk konteks.
// Overlap-check null-safe: baris tanpa salah satu tanggal tetap ikut lolos
// (semantik sama seperti filter client-side sebelumnya).
export function useDeliveriesForSchedule(range: { from: string; to: string }) {
  useDeliveriesRealtimeInvalidate();
  return useQuery({
    queryKey: [...KEY, "schedule", range.from, range.to],
    queryFn: async (): Promise<DeliveryWithContext[]> => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(SELECT)
        .or(
          `planned_delivery_date.is.null,planned_delivery_date.gte.${range.from}`,
        )
        .or(`planned_ship_date.is.null,planned_ship_date.lte.${range.to}`)
        .order("created_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []).map(normalize);
    },
  });
}

export function useDelivery(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [...KEY, id],
    queryFn: async (): Promise<DeliveryWithContext | null> => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(SELECT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw new Error(mapPgError(error));
      return data ? normalize(data) : null;
    },
  });
}

export type CreateDeliveryInput = {
  sales_order_id: string;
  planned_ship_date: string | null;
  planned_delivery_date: string | null;
  driver_name?: string | null;
  vehicle_number?: string | null;
  notes?: string | null;
};

export function useCreateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDeliveryInput) => {
      const { data, error } = await supabase
        .from("deliveries")
        .insert(input as never)
        .select("id")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type UpdateDeliveryInput = {
  id: string;
  status?: DeliveryStatus;
  planned_ship_date?: string | null;
  planned_delivery_date?: string | null;
  driver_name?: string | null;
  vehicle_number?: string | null;
  received_by?: string | null;
  notes?: string | null;
};

export function useUpdateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateDeliveryInput) => {
      const { error } = await supabase
        .from("deliveries")
        .update(patch as never)
        .eq("id", id);
      if (error) throw new Error(mapPgError(error));
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, v.id] });
    },
  });
}

export function useDeleteDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deliveries").delete().eq("id", id);
      if (error) throw new Error(mapPgError(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddDeliveryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      delivery_id: string;
      qc_inspection_id: string;
      quantity: number;
    }) => {
      const { error } = await supabase
        .from("delivery_items")
        .insert(input as never);
      if (error) throw new Error(mapPgError(error));
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, v.delivery_id] });
    },
  });
}

export function useRemoveDeliveryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; delivery_id: string }) => {
      const { error } = await supabase
        .from("delivery_items")
        .delete()
        .eq("id", id);
      if (error) throw new Error(mapPgError(error));
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, v.delivery_id] });
    },
  });
}

// Eligible QC inspections (pass) for a given SO, minus those already added to any delivery of that SO.
export type EligibleQc = {
  id: string;
  batch_number: string;
  item_name: string;
  qty_ok: number;
  already_used: boolean;
};

export function useEligibleQcInspections(salesOrderId: string | undefined) {
  return useQuery({
    enabled: !!salesOrderId,
    queryKey: ["deliveries", "eligible-qc", salesOrderId],
    queryFn: async (): Promise<EligibleQc[]> => {
      const { data, error } = await supabase
        .from("qc_inspections")
        .select(
          `id, qty_ok, production_batch_step:production_batch_steps!inner(
             sequence_order, production_batch_id,
             production_batch:production_batches!inner(
               batch_number,
               engineering_job:engineering_jobs!inner(
                 sales_order_item:sales_order_items!inner(
                   item_name, sales_order_id
                 )
               )
             )
           )`,
        )
        .eq("status", "pass");
      if (error) throw new Error(mapPgError(error));

      type Row = {
        id: string;
        qty_ok: number;
        production_batch_step: {
          sequence_order: number;
          production_batch_id: string;
          production_batch: {
            batch_number: string;
            engineering_job: {
              sales_order_item: { item_name: string; sales_order_id: string };
            };
          };
        };
      };
      const rows = (data as unknown as Row[]).filter(
        (r) =>
          r.production_batch_step?.production_batch?.engineering_job
            ?.sales_order_item?.sales_order_id === salesOrderId,
      );
      if (rows.length === 0) return [];

      // PRD §7 rule #4 / delivery_items_validate(): hanya QC pass pada
      // tahapan TERAKHIR (max sequence_order, exclude 'skipped') per batch
      // yang boleh ditawarkan sebagai kandidat pengiriman.
      const batchIds = [
        ...new Set(
          rows.map((r) => r.production_batch_step.production_batch_id),
        ),
      ];
      const { data: steps, error: sErr } = await supabase
        .from("production_batch_steps")
        .select("production_batch_id, sequence_order")
        .in("production_batch_id", batchIds)
        .neq("status", "skipped");
      if (sErr) throw new Error(mapPgError(sErr));
      const maxSeqByBatch = new Map<string, number>();
      for (const s of steps ?? []) {
        const prev = maxSeqByBatch.get(s.production_batch_id) ?? -1;
        if (s.sequence_order > prev)
          maxSeqByBatch.set(s.production_batch_id, s.sequence_order);
      }

      // Fetch used QC inspection ids for this SO
      const { data: used, error: uErr } = await supabase
        .from("delivery_items")
        .select("qc_inspection_id, delivery:deliveries!inner(sales_order_id)")
        .eq("delivery.sales_order_id", salesOrderId!);
      if (uErr) throw new Error(mapPgError(uErr));
      const usedSet = new Set(
        (used ?? []).map(
          (u: { qc_inspection_id: string }) => u.qc_inspection_id,
        ),
      );

      return rows
        .filter(
          (r) =>
            r.production_batch_step.sequence_order ===
            maxSeqByBatch.get(r.production_batch_step.production_batch_id),
        )
        .map((r) => ({
          id: r.id,
          batch_number: r.production_batch_step.production_batch.batch_number,
          item_name:
            r.production_batch_step.production_batch.engineering_job
              .sales_order_item.item_name,
          qty_ok: Number(r.qty_ok),
          already_used: usedSet.has(r.id),
        }));
    },
  });
}

// PRD §11 poin #10 / §9 M7: prefill planned_delivery_date dari MAX(estimated_delivery_date)
// seluruh production_batches milik SO — one-time saat create, tetap editable.
export function useMaxEstimatedDeliveryDate(salesOrderId: string | undefined) {
  return useQuery({
    enabled: !!salesOrderId,
    queryKey: ["deliveries", "max-estimated-delivery-date", salesOrderId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("production_batches")
        .select(
          `estimated_delivery_date,
           engineering_job:engineering_jobs!inner(
             sales_order_item:sales_order_items!inner(sales_order_id)
           )`,
        )
        .eq("engineering_job.sales_order_item.sales_order_id", salesOrderId!);
      if (error) throw new Error(mapPgError(error));
      const dates = (data ?? [])
        .map((r) => r.estimated_delivery_date as string | null)
        .filter((d): d is string => !!d);
      if (dates.length === 0) return null;
      return dates.reduce((max, d) => (d > max ? d : max));
    },
  });
}

export function useSalesOrdersForDelivery() {
  return useQuery({
    queryKey: ["deliveries", "so-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("id, so_number, status, customer:customers(id, name)")
        .in("status", ["quality_control", "delivery", "production"])
        .order("created_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      type Row = {
        id: string;
        so_number: string;
        status: string;
        customer:
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
      };
      return (data as unknown as Row[]).map((r) => ({
        ...r,
        customer: Array.isArray(r.customer)
          ? (r.customer[0] ?? null)
          : r.customer,
      }));
    },
  });
}
