import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type SalesOrderStatus =
  Database["public"]["Enums"]["sales_order_status"];

export const SALES_ORDER_STATUSES: SalesOrderStatus[] = [
  "draft",
  "confirmed",
  "engineering",
  "production",
  "quality_control",
  "delivery",
  "completed",
  "cancelled",
];

export const salesOrderItemSchema = z.object({
  id: z.string().uuid().optional(),
  item_name: z.string().trim().min(1, "Nama item wajib diisi").max(200),
  drawing_number: z.string().trim().max(64).optional().or(z.literal("")),
  quantity: z
    .number({ invalid_type_error: "Kuantitas harus angka" })
    .positive("Kuantitas harus lebih dari 0"),
  unit: z.string().trim().min(1, "Satuan wajib").max(20),
  material_spec: z.string().trim().max(200).optional().or(z.literal("")),
});

export const salesOrderFormSchema = z
  .object({
    customer_id: z.string().uuid("Pilih customer"),
    order_date: z.string().min(1, "Tanggal order wajib"),
    due_date: z.string().optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    items: z.array(salesOrderItemSchema).min(1, "Minimal 1 item"),
  })
  .refine((v) => !v.due_date || v.due_date >= v.order_date, {
    message: "Jatuh tempo harus setelah tanggal order",
    path: ["due_date"],
  });

export type SalesOrderFormValues = z.infer<typeof salesOrderFormSchema>;
export type SalesOrderItemFormValues = z.infer<typeof salesOrderItemSchema>;
