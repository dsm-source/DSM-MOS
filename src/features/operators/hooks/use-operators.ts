import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { Database } from "@/integrations/supabase/types";

export type OperatorRow = Database["public"]["Tables"]["operators"]["Row"];
export type OperatorUpdate =
  Database["public"]["Tables"]["operators"]["Update"];

export type OperatorFormInput = {
  name: string;
  employee_number?: string | null;
};

const LIST_KEY = ["operators"] as const;

function normalizeOperatorInput(input: OperatorFormInput): OperatorFormInput {
  return {
    name: input.name.trim(),
    employee_number: input.employee_number?.trim() || null,
  };
}

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
    mutationFn: async (input: OperatorFormInput) => {
      const { data, error } = await supabase
        .from("operators")
        .insert(normalizeOperatorInput(input))
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
      values: OperatorFormInput & Pick<OperatorUpdate, "is_active">;
    }) => {
      const { data, error } = await supabase
        .from("operators")
        .update({
          ...normalizeOperatorInput(values),
          is_active: values.is_active,
        })
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
