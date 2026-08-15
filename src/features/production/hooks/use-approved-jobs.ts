import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { Database } from "@/integrations/supabase/types";

export type ApprovedJob = {
  id: string;
  job_number: string;
  status: Database["public"]["Enums"]["engineering_status"];
  sales_order_item: {
    id: string;
    item_name: string;
    quantity: number;
    unit: string | null;
    sales_order: { id: string; so_number: string } | null;
  } | null;
  material_status: {
    status: Database["public"]["Enums"]["material_status"];
  } | null;
  batches_count: number;
};

/** Semua engineering job (approved diprioritaskan) untuk halaman perencanaan. */
export function usePlannableJobs() {
  return useQuery({
    queryKey: ["plannable-jobs"],
    queryFn: async (): Promise<ApprovedJob[]> => {
      const { data, error } = await supabase
        .from("engineering_jobs")
        .select(
          `
          id, job_number, status,
          sales_order_item:sales_order_items!inner(
            id, item_name, quantity, unit,
            sales_order:sales_orders!inner(id, so_number)
          ),
          material_status:material_statuses(status),
          batches:production_batches(id)
        `,
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(mapPgError(error));
      return (data ?? []).map((row) => {
        const r = row as unknown as ApprovedJob & {
          material_status:
            | ApprovedJob["material_status"]
            | ApprovedJob["material_status"][];
          batches: { id: string }[] | null;
        };
        const ms = Array.isArray(r.material_status)
          ? (r.material_status[0] ?? null)
          : (r.material_status ?? null);
        return {
          id: r.id,
          job_number: r.job_number,
          status: r.status,
          sales_order_item: r.sales_order_item,
          material_status: ms,
          batches_count: r.batches?.length ?? 0,
        };
      });
    },
  });
}
