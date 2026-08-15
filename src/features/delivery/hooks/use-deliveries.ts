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

export function useDeliveries() {
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

  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<DeliveryWithContext[]> => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(SELECT)
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
          `id, qty_ok, production_batch:production_batches!inner(
             batch_number,
             engineering_job:engineering_jobs!inner(
               sales_order_item:sales_order_items!inner(
                 item_name, sales_order_id
               )
             )
           )`,
        )
        .eq("status", "pass");
      if (error) throw new Error(mapPgError(error));

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

      type Row = {
        id: string;
        qty_ok: number;
        production_batch: {
          batch_number: string;
          engineering_job: {
            sales_order_item: { item_name: string; sales_order_id: string };
          };
        };
      };
      return (data as unknown as Row[])
        .filter(
          (r) =>
            r.production_batch?.engineering_job?.sales_order_item
              ?.sales_order_id === salesOrderId,
        )
        .map((r) => ({
          id: r.id,
          batch_number: r.production_batch.batch_number,
          item_name:
            r.production_batch.engineering_job.sales_order_item.item_name,
          qty_ok: Number(r.qty_ok),
          already_used: usedSet.has(r.id),
        }));
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
