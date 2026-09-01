import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type StaffMember = Tables<"staff">;

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as StaffMember[];
    },
  });
}

export function useDentists() {
  return useQuery({
    queryKey: ["staff", "dentists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("role", "dentist")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as StaffMember[];
    },
  });
}

export function useAssociateDentists() {
  return useQuery({
    queryKey: ["staff", "associate_dentists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("role", "associate_dentist")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as StaffMember[];
    },
  });
}

export function useCurrentStaff() {
  return useQuery({
    queryKey: ["staff", "me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("user_id", userRes.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as StaffMember | null) ?? null;
    },
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staff: TablesInsert<"staff">) => {
      const { data, error } = await supabase.from("staff").insert(staff).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Staff added", description: `${data.full_name} has been added.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"staff"> & { id: string }) => {
      const { data, error } = await supabase.from("staff").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Staff updated", description: `${data.full_name} has been updated.` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
