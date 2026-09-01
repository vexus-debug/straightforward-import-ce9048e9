import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LdExternalLabPrice {
  id: string;
  external_lab_id: string;
  work_type_name: string;
  price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// List prices for one lab, or all when no id passed.
export function useLdExternalLabPrices(externalLabId?: string | null) {
  return useQuery({
    queryKey: ["ld_external_lab_prices", externalLabId ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("ld_external_lab_prices" as any)
        .select("*")
        .order("work_type_name");
      if (externalLabId) q = q.eq("external_lab_id", externalLabId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LdExternalLabPrice[];
    },
    enabled: externalLabId === undefined ? true : !!externalLabId,
  });
}

export function useUpsertLdExternalLabPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      id?: string;
      external_lab_id: string;
      work_type_name: string;
      price: number;
      notes?: string | null;
    }) => {
      if (row.id) {
        const { error } = await supabase
          .from("ld_external_lab_prices" as any)
          .update({
            external_lab_id: row.external_lab_id,
            work_type_name: row.work_type_name,
            price: row.price,
            notes: row.notes ?? null,
          } as any)
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ld_external_lab_prices" as any)
          .insert({
            external_lab_id: row.external_lab_id,
            work_type_name: row.work_type_name,
            price: row.price,
            notes: row.notes ?? null,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ld_external_lab_prices"] }),
  });
}

export function useDeleteLdExternalLabPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ld_external_lab_prices" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ld_external_lab_prices"] }),
  });
}
