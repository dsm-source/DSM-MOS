import type { Database } from "@/integrations/supabase/types";

export type DeliveryStatus = Database["public"]["Enums"]["delivery_status"];
export type DeliveryRow = Database["public"]["Tables"]["deliveries"]["Row"];
export type DeliveryItemRow =
  Database["public"]["Tables"]["delivery_items"]["Row"];

export type DeliveryWithContext = DeliveryRow & {
  sales_order: {
    id: string;
    so_number: string;
    customer: { id: string; name: string } | null;
  } | null;
  delivery_items: DeliveryItemRow[];
};
