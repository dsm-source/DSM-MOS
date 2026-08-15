import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import type { Database } from "@/integrations/supabase/types";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];

export const customerSchema = z.object({
  code: z.string().trim().min(1, "Kode wajib").max(32),
  name: z.string().trim().min(1, "Nama wajib").max(120),
  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});
export type CustomerFormValues = z.infer<typeof customerSchema>;

const KEY = ["customers"] as const;

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: [...KEY, { search: search ?? "" }],
    queryFn: async (): Promise<Customer[]> => {
      let q = supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true })
        .limit(500);
      if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`name.ilike.${s},code.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw new Error(mapPgError(error));
      return data ?? [];
    },
  });
}

function normalize(v: CustomerFormValues) {
  return {
    code: v.code.trim(),
    name: v.name.trim(),
    contact_person: v.contact_person?.trim() || null,
    phone: v.phone?.trim() || null,
    address: v.address?.trim() || null,
  };
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        ...normalize(values),
        created_by: userData.user?.id ?? null,
      };
      const { data, error } = await supabase
        .from("customers")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: CustomerFormValues;
    }) => {
      const { data, error } = await supabase
        .from("customers")
        .update(normalize(values))
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapPgError(error));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw new Error(mapPgError(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
