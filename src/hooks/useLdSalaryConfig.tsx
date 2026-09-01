import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const toPreviousDay = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split("T")[0];
};

const getMonthKey = (dateString?: string | null) => (dateString || "").slice(0, 7);

export function useLdSalaryConfigs(periodStart?: string, periodEnd?: string) {
  const activePeriodStart = periodStart || new Date().toISOString().split("T")[0];
  const activePeriodEnd = periodEnd || activePeriodStart;

  return useQuery({
    queryKey: ["ld-salary-configs", activePeriodStart, activePeriodEnd],
    queryFn: async () => {
      // Fetch ALL configs in one query (no date filter) and pick the best
      // one per staff member client-side. This avoids any risk of the two
      // separate date-bounded queries silently returning empty (e.g. if
      // RLS, ordering, or filter quirks cause one of them to miss rows).
      // Selection priority for the requested period:
      //   1. Config that OVERLAPS the period (effective_from <= periodEnd
      //      AND (effective_to is null OR effective_to >= periodStart))
      //   2. Most recent PRIOR config (effective_from <= periodEnd) as a
      //      fallback for historical months without a dedicated config.
      //   3. Earliest FUTURE config (effective_from > periodEnd) — common
      //      when records were backdated (data entry began in an older
      //      month but configs were only created later).
      const { data: allConfigs, error } = await supabase
        .from("ld_salary_config")
        .select("*, staff:ld_staff(id, full_name, role, status, specialty, created_at)")
        .order("effective_from", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const overlapping: Record<string, any> = {};
      const priorFallback: Record<string, any> = {};
      const futureFallback: Record<string, any> = {};

      (allConfigs || []).forEach((row: any) => {
        const startsBeforeOrAtEnd = row.effective_from <= activePeriodEnd;
        const endsAfterOrAtStart = !row.effective_to || row.effective_to >= activePeriodStart;

        if (startsBeforeOrAtEnd && endsAfterOrAtStart) {
          // Overlapping — keep the LATEST one that overlaps
          const current = overlapping[row.staff_id];
          if (!current || row.effective_from >= current.effective_from) {
            overlapping[row.staff_id] = row;
          }
        } else if (startsBeforeOrAtEnd) {
          // Prior — keep the LATEST prior
          const current = priorFallback[row.staff_id];
          if (!current || row.effective_from >= current.effective_from) {
            priorFallback[row.staff_id] = row;
          }
        } else {
          // Future — keep the EARLIEST future
          const current = futureFallback[row.staff_id];
          if (!current || row.effective_from <= current.effective_from) {
            futureFallback[row.staff_id] = row;
          }
        }
      });

      const allStaffIds = Array.from(new Set((allConfigs || []).map((r: any) => r.staff_id)));

      const merged = allStaffIds
        .map((staffId: string) => overlapping[staffId] || priorFallback[staffId] || futureFallback[staffId])
        .filter(Boolean);

      return merged.sort((a: any, b: any) =>
        (a.staff?.full_name || "").localeCompare(b.staff?.full_name || "")
      );
    },
  });
}

export function useSaveLdSalaryConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      effectiveFrom: string;
      configs: { staff_id: string; basic_percentage: number; output_percentage: number }[];
    }) => {
      const { effectiveFrom, configs } = payload;

      if (!configs.length) return;

      const staffIds = configs.map((config) => config.staff_id);
      const { data: existingRows, error: fetchError } = await supabase
        .from("ld_salary_config")
        .select("id, staff_id, effective_from, effective_to, created_at")
        .in("staff_id", staffIds)
        .order("effective_from", { ascending: true })
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      for (const config of configs) {
        const rowsForStaff = ((existingRows as any[]) || []).filter((row) => row.staff_id === config.staff_id);
        const replacementRow = rowsForStaff.find((row) =>
          row.effective_from === effectiveFrom ||
          (!row.effective_to && getMonthKey(row.effective_from) === getMonthKey(effectiveFrom) && row.effective_from > effectiveFrom),
        );
        const nextRow = rowsForStaff
          .filter((row) => row.effective_from > effectiveFrom && row.id !== replacementRow?.id)
          .sort((a, b) => a.effective_from.localeCompare(b.effective_from))[0];

        if (replacementRow) {
          const { error } = await supabase
            .from("ld_salary_config")
            .update({
              basic_percentage: config.basic_percentage,
              output_percentage: config.output_percentage,
              effective_from: effectiveFrom,
              effective_to: nextRow ? toPreviousDay(nextRow.effective_from) : null,
            })
            .eq("id", replacementRow.id);

          if (error) throw error;
          continue;
        }

        const previousRow = rowsForStaff
          .filter((row) => row.effective_from < effectiveFrom)
          .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];

        if (previousRow && (!previousRow.effective_to || previousRow.effective_to >= effectiveFrom)) {
          const { error } = await supabase
            .from("ld_salary_config")
            .update({ effective_to: toPreviousDay(effectiveFrom) })
            .eq("id", previousRow.id);

          if (error) throw error;
        }

        const { error: insertError } = await supabase
          .from("ld_salary_config")
          .insert([{ ...config, effective_from: effectiveFrom, effective_to: nextRow ? toPreviousDay(nextRow.effective_from) : null } as any]);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ld-salary-configs"] });
      toast.success("Salary percentages saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLdSalaryDeductions(periodStart?: string, periodEnd?: string) {
  return useQuery({
    queryKey: ["ld-salary-deductions", periodStart, periodEnd],
    queryFn: async () => {
      let q = supabase
        .from("ld_salary_deductions")
        .select("*, staff:ld_staff(id, full_name)")
        .order("created_at", { ascending: false });
      if (periodStart) q = q.gte("period_start", periodStart);
      if (periodEnd) q = q.lte("period_end", periodEnd);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateLdSalaryDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      staff_id: string;
      period_start: string;
      period_end: string;
      deduction_type: string;
      amount: number;
      notes?: string;
    }) => {
      const { error } = await supabase.from("ld_salary_deductions").insert([values]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ld-salary-deductions"] });
      toast.success("Deduction added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLdSalaryDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ld_salary_deductions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ld-salary-deductions"] });
      toast.success("Deduction removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
