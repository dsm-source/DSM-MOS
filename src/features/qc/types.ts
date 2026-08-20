import type { Database } from "@/integrations/supabase/types";

export type QcStatus = Database["public"]["Enums"]["qc_status"];
export type QcInspectionRow =
  Database["public"]["Tables"]["qc_inspections"]["Row"];

export type QcInspectionWithContext = QcInspectionRow & {
  production_batch_step: {
    id: string;
    process: Database["public"]["Enums"]["production_process"];
    sequence_order: number;
    status: Database["public"]["Enums"]["production_step_status"];
    production_batch: {
      id: string;
      batch_number: string;
      quantity: number;
      engineering_job: {
        id: string;
        job_number: string;
        sales_order_item: {
          id: string;
          item_name: string;
          unit: string | null;
          sales_order: {
            id: string;
            so_number: string;
            customer: { id: string; name: string } | null;
          } | null;
        } | null;
      } | null;
    } | null;
  } | null;
};
