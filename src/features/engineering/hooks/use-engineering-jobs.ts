import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { EngineeringJobRow, EngineeringStatus } from "../types";

const LIST_KEY = ["engineering-jobs"] as const;
const DETAIL_KEY = ["engineering-job"] as const;

export type EngineeringJobWithContext = EngineeringJobRow & {
  sales_order_item:
    | (Pick<
        import("@/integrations/supabase/types").Database["public"]["Tables"]["sales_order_items"]["Row"],
        "id" | "item_name" | "drawing_number" | "quantity" | "unit" | "material_spec"
      > & {
        sales_order: {
          id: string;
          so_number: string;
          customer: { name: string; code: string } | null;
        } | null;
      })
    | null;
};

export function useEngineeringJobs() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<EngineeringJobWithContext[]> => {
      const { data, error } = await supabase
        .from("engineering_jobs")
        .select(
          "*, sales_order_item:sales_order_items!inner(id, item_name, drawing_number, quantity, unit, material_spec, sales_order:sales_orders!inner(id, so_number, customer:customers(name, code)))",
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []) as unknown as EngineeringJobWithContext[];
    },
  });
}

export function useEngineeringJob(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [...DETAIL_KEY, id],
    queryFn: async (): Promise<EngineeringJobWithContext | null> => {
      const { data, error } = await supabase
        .from("engineering_jobs")
        .select(
          "*, sales_order_item:sales_order_items!inner(id, item_name, drawing_number, quantity, unit, material_spec, sales_order:sales_orders!inner(id, so_number, customer:customers(name, code)))",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw new Error(mapPgError(error));
      return (data as unknown as EngineeringJobWithContext) ?? null;
    },
  });
}

type UpdateInput = Partial<{
  status: EngineeringStatus;
  assigned_to: string | null;
  progress_percent: number;
  target_completion_date: string | null;
  drawing_url: string | null;
  notes: string | null;
}>;

export function useUpdateEngineeringJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateInput }) => {
      const { data, error } = await supabase
        .from("engineering_jobs")
        .update(values)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: [...DETAIL_KEY, v.id] });
      qc.invalidateQueries({ queryKey: ["engineering-job-history", v.id] });
    },
  });
}
