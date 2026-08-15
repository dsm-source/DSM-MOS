import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { Database } from "@/integrations/supabase/types";

export type MaterialStatus = Database["public"]["Enums"]["material_status"];
export type MaterialStatusRow = Database["public"]["Tables"]["material_statuses"]["Row"];

export type MaterialWithContext = MaterialStatusRow & {
  engineering_job: {
    id: string;
    job_number: string;
    status: Database["public"]["Enums"]["engineering_status"];
    sales_order_item: {
      id: string;
      item_name: string;
      drawing_number: string | null;
      quantity: number;
      unit: string | null;
      material_spec: string | null;
      sales_order: {
        id: string;
        so_number: string;
        customer: { name: string; code: string } | null;
      } | null;
    } | null;
  } | null;
};

const LIST_KEY = ["material-statuses"] as const;

export function useMaterialStatuses() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<MaterialWithContext[]> => {
      const { data, error } = await supabase
        .from("material_statuses")
        .select(
          "*, engineering_job:engineering_jobs!inner(id, job_number, status, sales_order_item:sales_order_items!inner(id, item_name, drawing_number, quantity, unit, material_spec, sales_order:sales_orders!inner(id, so_number, customer:customers(name, code))))",
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []) as unknown as MaterialWithContext[];
    },
  });
}

export function useMaterialStatusesRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("material-statuses-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "material_statuses" }, () => {
        qc.invalidateQueries({ queryKey: LIST_KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useUpdateMaterialStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<{ status: MaterialStatus; notes: string | null }>;
    }) => {
      const { data, error } = await supabase
        .from("material_statuses")
        .update(values)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export const MATERIAL_STATUSES: {
  key: MaterialStatus;
  label: string;
  className: string;
  dot: string;
}[] = [
  {
    key: "waiting_material",
    label: "Menunggu Material",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  {
    key: "partial_material",
    label: "Material Sebagian",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    key: "material_ready",
    label: "Material Siap",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
];
