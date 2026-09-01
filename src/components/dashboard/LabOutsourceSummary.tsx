import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function LabOutsourceSummary() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  const { start, end, label } = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const s = new Date(y, m - 1, 1);
    const e = new Date(y, m, 1);
    return {
      start: s.toISOString(),
      end: e.toISOString(),
      label: format(s, "MMMM yyyy"),
    };
  }, [month]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["lab_outsource_summary", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_orders")
        .select("id, lab_name, external_lab_id, lab_work_type, created_at, lab_order_items(work_type_name, units)")
        .gte("created_at", start)
        .lt("created_at", end);
      if (error) throw error;
      return data as any[];
    },
  });

  // Aggregate: lab -> work_type -> { cases, units }
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, { cases: number; units: number }>>();
    for (const order of data) {
      const labName = order.lab_name || "Unknown Lab";
      if (!map.has(labName)) map.set(labName, new Map());
      const wtMap = map.get(labName)!;
      const items: { work_type_name: string; units: number }[] = order.lab_order_items || [];
      if (items.length === 0) {
        const wt = order.lab_work_type || "Unspecified";
        const cur = wtMap.get(wt) || { cases: 0, units: 0 };
        cur.cases += 1;
        cur.units += 1;
        wtMap.set(wt, cur);
      } else {
        const seen = new Set<string>();
        for (const it of items) {
          const wt = it.work_type_name || "Unspecified";
          const cur = wtMap.get(wt) || { cases: 0, units: 0 };
          if (!seen.has(wt)) { cur.cases += 1; seen.add(wt); }
          cur.units += Number(it.units) || 0;
          wtMap.set(wt, cur);
        }
      }
    }
    return Array.from(map.entries())
      .map(([lab, wtMap]) => ({
        lab,
        rows: Array.from(wtMap.entries())
          .map(([wt, v]) => ({ wt, ...v }))
          .sort((a, b) => b.units - a.units),
        totalCases: Array.from(wtMap.values()).reduce((s, v) => s + v.cases, 0),
        totalUnits: Array.from(wtMap.values()).reduce((s, v) => s + v.units, 0),
      }))
      .sort((a, b) => b.totalUnits - a.totalUnits);
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Periodic Outsource Summary <span className="text-muted-foreground font-normal">— {label}</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="period-month" className="text-xs text-muted-foreground">Month</Label>
          <Input
            id="period-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-8 w-40"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lab orders sent in {label}.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.lab} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{g.lab}</div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{g.totalCases} cases</Badge>
                    <Badge>{g.totalUnits} units</Badge>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {g.rows.map((r) => (
                    <div key={r.wt} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1">
                      <span className="truncate">{r.wt}</span>
                      <span className="text-muted-foreground whitespace-nowrap ml-2">
                        {r.cases} {r.cases === 1 ? "case" : "cases"} · {r.units} units
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
