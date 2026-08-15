import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { Database } from "@/integrations/supabase/types";
import type { SalesOrderFormValues, SalesOrderStatus } from "../types";

export type SalesOrderRow = Database["public"]["Tables"]["sales_orders"]["Row"];
export type SalesOrderItemRow = Database["public"]["Tables"]["sales_order_items"]["Row"];

export type SalesOrderListItem = SalesOrderRow & {
  customer: { id: string; code: string; name: string } | null;
  item_count: number;
};

export type SalesOrderListParams = {
  page: number;
  pageSize: number;
  status?: SalesOrderStatus | "all";
  search?: string;
};

const LIST_KEY = ["sales-orders"] as const;
const DETAIL_KEY = ["sales-order"] as const;

export function useSalesOrders(params: SalesOrderListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: async (): Promise<{ rows: SalesOrderListItem[]; total: number }> => {
      const from = (params.page - 1) * params.pageSize;
      const to = from + params.pageSize - 1;

      let q = supabase
        .from("sales_orders")
        .select("*, customer:customers!inner(id, code, name), sales_order_items(count)", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (params.status && params.status !== "all") q = q.eq("status", params.status);

      const s = params.search?.trim();
      if (s) {
        // Cari di so_number ATAU nama/kode customer (via inner join filter)
        const like = `%${s}%`;
        q = q.or(`so_number.ilike.${like},customer.name.ilike.${like},customer.code.ilike.${like}`);
      }

      const { data, error, count } = await q;
      if (error) throw new Error(mapPgError(error));
      const rows: SalesOrderListItem[] = (data ?? []).map((r) => {
        const items = (r as unknown as { sales_order_items: { count: number }[] })
          .sales_order_items;
        return {
          ...(r as SalesOrderRow & { customer: SalesOrderListItem["customer"] }),
          item_count: items?.[0]?.count ?? 0,
        };
      });
      return { rows, total: count ?? 0 };
    },
  });
}

export function useSalesOrder(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [...DETAIL_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*, customer:customers(*), items:sales_order_items(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
  });
}

async function replaceItems(
  salesOrderId: string,
  items: SalesOrderFormValues["items"],
  userId: string | null,
) {
  const { error: delErr } = await supabase
    .from("sales_order_items")
    .delete()
    .eq("sales_order_id", salesOrderId);
  if (delErr) throw new Error(mapPgError(delErr));
  if (items.length === 0) return;
  const payload = items.map((it) => ({
    sales_order_id: salesOrderId,
    item_name: it.item_name.trim(),
    drawing_number: it.drawing_number?.trim() || null,
    quantity: it.quantity,
    unit: it.unit.trim(),
    material_spec: it.material_spec?.trim() || null,
    created_by: userId,
  }));
  const { error: insErr } = await supabase.from("sales_order_items").insert(payload);
  if (insErr) throw new Error(mapPgError(insErr));
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: SalesOrderFormValues) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      const { data: so, error: soErr } = await supabase
        .from("sales_orders")
        .insert({
          customer_id: values.customer_id,
          order_date: values.order_date,
          due_date: values.due_date || null,
          notes: values.notes?.trim() || null,
          created_by: uid,
          // so_number diisi trigger, status default 'draft'
        } as Database["public"]["Tables"]["sales_orders"]["Insert"])
        .select("*")
        .single();
      if (soErr) throw new Error(mapPgError(soErr));

      await replaceItems(so.id, values.items, uid);
      return so;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUpdateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SalesOrderFormValues }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      const { data: so, error: soErr } = await supabase
        .from("sales_orders")
        .update({
          customer_id: values.customer_id,
          order_date: values.order_date,
          due_date: values.due_date || null,
          notes: values.notes?.trim() || null,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (soErr) throw new Error(mapPgError(soErr));

      await replaceItems(id, values.items, uid);
      return so;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: [...DETAIL_KEY, v.id] });
    },
  });
}

export function useDeleteSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from("sales_orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(mapPgError(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useTransitionSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, next }: { id: string; next: SalesOrderStatus }) => {
      const { data, error } = await supabase
        .from("sales_orders")
        .update({ status: next })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: [...DETAIL_KEY, v.id] });
    },
  });
}
