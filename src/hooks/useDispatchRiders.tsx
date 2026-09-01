import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DispatchRider {
  user_id: string;
  full_name: string;
}

export function useDispatchRiders() {
  return useQuery({
    queryKey: ["dispatch-riders"],
    queryFn: async () => {
      const { data: roleRows, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "dispatch_rider");
      if (error) throw error;
      const ids = (roleRows || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [] as DispatchRider[];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      if (pErr) throw pErr;
      return (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name || "Rider",
      })) as DispatchRider[];
    },
  });
}

export async function uploadProofOfDelivery(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `proof-of-delivery/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("ld-digital-files")
    .upload(filename, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("ld-digital-files").getPublicUrl(filename);
  return data.publicUrl;
}
