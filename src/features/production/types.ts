import type { Database } from "@/integrations/supabase/types";

export type ProductionProcess =
  Database["public"]["Enums"]["production_process"];
export type ProductionStepStatus =
  Database["public"]["Enums"]["production_step_status"];
export type ProductionBatchRow =
  Database["public"]["Tables"]["production_batches"]["Row"];
export type ProductionBatchStepRow =
  Database["public"]["Tables"]["production_batch_steps"]["Row"];

export const PRODUCTION_PROCESSES: ProductionProcess[] = [
  "laser_cutting",
  "bending",
  "welding_grinding",
  "powder_coating",
  "assembly",
];

export const STEP_STATUSES: ProductionStepStatus[] = [
  "waiting",
  "running",
  "paused",
  "completed",
  "skipped",
  "rework",
];
