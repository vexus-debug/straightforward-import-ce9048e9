import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Patient = Omit<Tables<"patients">, "owner_type"> & {
  owner_type?: string;
  associate_staff_id?: string | null;
  associate_name?: string | null;
  last_visit_date?: string | null;
};

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      // Read from the patients_central view: contact info is masked for
      // associate-owned patients and rows include associate_name + last_visit_date.
      const { data, error } = await (supabase as any)
        .from("patients_central")
        .select("*")
        .order("last_visit_date", { ascending: false, nullsFirst: false });
      if (error) {
        // Fallback to the base table if the view is unavailable for some reason.
        const fallback = await supabase
          .from("patients")
          .select("*")
          .order("created_at", { ascending: false });
        if (fallback.error) throw fallback.error;
        return fallback.data as Patient[];
      }
      return data as Patient[];
    },
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patient: TablesInsert<"patients">) => {
      const { data, error } = await supabase.from("patients").insert(patient).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast({ title: "Patient registered", description: `${data.first_name} ${data.last_name} has been added.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"patients"> & { id: string }) => {
      const { data, error } = await supabase.from("patients").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient-detail", data.id] });
      toast({ title: "Patient updated", description: `${data.first_name} ${data.last_name} has been updated.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
