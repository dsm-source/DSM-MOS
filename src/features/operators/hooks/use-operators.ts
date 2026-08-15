import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { Database } from "@/integrations/supabase/types";

export type OperatorRow = Database["public"]["Tables"]["operators"]["Row"];
export type OperatorInsert =
  Database["public"]["Tables"]["operators"]["Insert"];
export type OperatorUpdate =
  Database["public"]["Tables"]["operators"]["Update"];

const LIST_KEY = ["operators"] as const;

export function useOperators() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<OperatorRow[]> => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw new Error(mapPgError(error));
      return data ?? [];
    },
  });
}

export function useCreateOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      employee_number?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("operators")
        .insert({
          name: input.name.trim(),
          employee_number: input.employee_number?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUpdateOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: OperatorUpdate;
    }) => {
      const { data, error } = await supabase
        .from("operators")
        .update(values)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useToggleOperatorActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { data, error } = await supabase
        .from("operators")
        .update({ is_active })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
