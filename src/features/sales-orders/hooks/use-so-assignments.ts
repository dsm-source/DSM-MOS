import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listUsersByRole, type UserOption } from "@/lib/assignments.functions";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/roles.functions";

export type SOAssignmentRow =
  Database["public"]["Tables"]["sales_order_assignments"]["Row"];

const KEY = ["so-assignments"] as const;

export function useSOAssignments(salesOrderId: string | undefined) {
  return useQuery({
    enabled: !!salesOrderId,
    queryKey: [...KEY, salesOrderId],
    queryFn: async (): Promise<SOAssignmentRow[]> => {
      const { data, error } = await supabase
        .from("sales_order_assignments")
        .select("*")
        .eq("sales_order_id", salesOrderId!);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useUsersByRole(role: AppRole | null) {
  const fn = useServerFn(listUsersByRole);
  return useQuery({
    enabled: !!role,
    queryKey: ["users-by-role", role],
    queryFn: async (): Promise<UserOption[]> => {
      if (!role) return [];
      return await fn({ data: { role } });
    },
  });
}

export function useUpsertAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      salesOrderId: string;
      role: AppRole;
      userId: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const actor = userData.user?.id ?? null;
      const { error } = await supabase.from("sales_order_assignments").upsert(
        {
          sales_order_id: input.salesOrderId,
          role: input.role,
          user_id: input.userId,
          created_by: actor,
        },
        { onConflict: "sales_order_id,role" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.salesOrderId] });
    },
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { salesOrderId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("sales_order_assignments")
        .delete()
        .eq("sales_order_id", input.salesOrderId)
        .eq("role", input.role);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.salesOrderId] });
    },
  });
}
