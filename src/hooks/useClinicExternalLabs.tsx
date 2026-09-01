import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ClinicExternalLab {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  specialties: string[] | null;
  status: string;
  notes: string | null;
}

export interface ClinicLabWorkType {
  id: string;
  external_lab_id: string;
  name: string;
  price: number;
  notes: string | null;
  is_active: boolean;
}

export function useClinicExternalLabs() {
  return useQuery({
    queryKey: ["clinic_external_labs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_external_labs")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as ClinicExternalLab[];
    },
  });
}

export function useUpsertClinicExternalLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lab: Partial<ClinicExternalLab> & { name: string }) => {
      const { id, ...rest } = lab;
      if (id) {
        const { error } = await supabase.from("clinic_external_labs").update(rest as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_external_labs").insert([rest as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic_external_labs"] });
      toast({ title: "Lab saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteClinicExternalLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinic_external_labs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic_external_labs"] });
      qc.invalidateQueries({ queryKey: ["clinic_lab_work_types"] });
      toast({ title: "Lab deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useClinicLabWorkTypes(externalLabId?: string | null) {
  return useQuery({
    queryKey: ["clinic_lab_work_types", externalLabId || "all"],
    queryFn: async () => {
      let query = supabase.from("clinic_lab_work_types").select("*").order("name");
      if (externalLabId) query = query.eq("external_lab_id", externalLabId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ClinicLabWorkType[];
    },
  });
}

export function useUpsertClinicLabWorkType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (wt: Partial<ClinicLabWorkType> & { external_lab_id: string; name: string }) => {
      const { id, ...rest } = wt;
      if (id) {
        const { error } = await supabase.from("clinic_lab_work_types").update(rest as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_lab_work_types").insert([rest as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic_lab_work_types"] });
      toast({ title: "Work type saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteClinicLabWorkType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinic_lab_work_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic_lab_work_types"] });
      toast({ title: "Work type removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}
