import type { Database } from "@/integrations/supabase/types";

export type EngineeringStatus =
  Database["public"]["Enums"]["engineering_status"];
export const ENGINEERING_STATUSES: EngineeringStatus[] = [
  "draft",
  "in_progress",
  "review",
  "approved",
];

export type EngineeringJobRow =
  Database["public"]["Tables"]["engineering_jobs"]["Row"];
