import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Pencil, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const fmt = (v: number) => `₦${(v || 0).toLocaleString()}`;
const norm = (s: string) => (s || "").toLowerCase().trim().replace(/s$/, "");

export function LdOutsourceSummary() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [drillDown, setDrillDown] = useState<{ labName: string; scope: "month" | "year"; cases: any[] } | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editExpress, setEditExpress] = useState<string>("");
  const [editDiscount, setEditDiscount] = useState<string>("");

  const { mStart, mEnd, yStart, yEnd, monthLabel, yearLabel } = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const ms = new Date(y, m - 1, 1);
    const me = new Date(y, m, 1);
    const ys = new Date(y, 0, 1);
    const ye = new Date(y + 1, 0, 1);
    return {
      mStart: format(ms, "yyyy-MM-dd"),
      mEnd: format(me, "yyyy-MM-dd"),
      yStart: format(ys, "yyyy-MM-dd"),
      yEnd: format(ye, "yyyy-MM-dd"),
      monthLabel: format(ms, "MMMM yyyy"),
      yearLabel: String(y),
    };
  }, [month]);

  const { data: yearCases = [], isLoading: l1 } = useQuery({
    queryKey: ["ld_outsource_cases", yStart, yEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ld_cases")
        .select("id, case_number, patient_name, work_type_id, work_type_name, tooth_number, lab_fee, discount, client_id, external_lab_id, external_lab_unit_price, external_lab_express_charge, external_lab_discount, received_date, created_at, status, ld_external_labs:external_lab_id(name)")
        .not("external_lab_id", "is", null)
        .gte("received_date", yStart)
        .lt("received_date", yEnd);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: labPrices = [] } = useQuery({
    queryKey: ["ld_external_lab_prices", "__all__"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ld_external_lab_prices" as any)
        .select("external_lab_id, work_type_name, price");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: clientPrices = [] } = useQuery({
    queryKey: ["ld_client_prices", "__all__"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ld_client_prices" as any)
        .select("client_id, work_type_id, custom_price, effective_from, effective_to");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Active client-price lookup: (client_id|"*") + work_type_id -> custom_price
  // "Ticked" = currently active based on effective_from/to; ignore expired entries.
  const clientPriceMap = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const active = (clientPrices as any[]).filter((p) => {
      if (!p.work_type_id) return false;
      if (p.effective_from && today < p.effective_from) return false;
      if (p.effective_to && today > p.effective_to) return false;
      return true;
    });
    // Latest effective_from wins if multiple active entries.
    active.sort((a, b) => (b.effective_from || "").localeCompare(a.effective_from || ""));
    const m = new Map<string, number>();
    for (const p of active) {
      const key = `${p.client_id || "*"}::${p.work_type_id}`;
      if (!m.has(key)) m.set(key, Number(p.custom_price) || 0);
    }
    return m;
  }, [clientPrices]);

  const clientPriceFor = (c: any): number | null => {
    if (!c.work_type_id) return null;
    const specific = clientPriceMap.get(`${c.client_id || ""}::${c.work_type_id}`);
    if (specific != null && specific > 0) return specific;
    const global = clientPriceMap.get(`*::${c.work_type_id}`);
    if (global != null && global > 0) return global;
    return null;
  };

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of labPrices) {
      const price = Number(p.price) || 0;
      const wt = p.work_type_name || "";
      m.set(`${p.external_lab_id}::${wt.toLowerCase().trim()}`, price);
      m.set(`${p.external_lab_id}::~${norm(wt)}`, price);
    }
    return m;
  }, [labPrices]);

  const caseUnitPrice = (c: any) => {
    const override = c.external_lab_unit_price;
    const wt = c.work_type_name || "";
    if (override != null && override !== "") return Number(override) || 0;
    return priceMap.get(`${c.external_lab_id}::${wt.toLowerCase().trim()}`)
      ?? priceMap.get(`${c.external_lab_id}::~${norm(wt)}`)
      ?? 0;
  };

  // External lab cost = units * unit price + express charge - external lab discount
  const externalLabCost = (c: any) => {
    const units = Number(c.tooth_number) || 1;
    const unit = caseUnitPrice(c);
    const express = Number(c.external_lab_express_charge) || 0;
    const disc = Number(c.external_lab_discount) || 0;
    return Math.max(units * unit + express - disc, 0);
  };

  // Clinic-side expected income = base price × units − discount.
  // lab_fee on ld_cases is the per-unit base price (matches the "Base (n units × ₦x)" line
  // on the case form), so it must be multiplied by units. Extras like express/courier are
  // intentionally excluded — this shows the base inflow, matching the Per Work Type breakdown.
  const clinicValue = (c: any) => {
    const units = Number(c.tooth_number) || 1;
    const disc = Number(c.discount) || 0;
    return Math.max((Number(c.lab_fee) || 0) * units - disc, 0);
  };

  const saveOverride = async (caseId: string) => {
    try {
      const update: any = {};
      update.external_lab_unit_price = editValue.trim() === "" ? null : Number(editValue) || 0;
      update.external_lab_express_charge = editExpress.trim() === "" ? 0 : Number(editExpress) || 0;
      update.external_lab_discount = editDiscount.trim() === "" ? 0 : Number(editDiscount) || 0;
      const { error } = await supabase.from("ld_cases").update(update).eq("id", caseId);
      if (error) throw error;
      toast.success("Case updated");
      setEditingCaseId(null);
      setEditValue(""); setEditExpress(""); setEditDiscount("");
      qc.invalidateQueries({ queryKey: ["ld_outsource_cases"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const { data: yearPayments = [], isLoading: l2 } = useQuery({
    queryKey: ["ld_outsource_payments", "__all_time__"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ld_external_lab_payments")
        .select("amount, external_lab_id, payment_date");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const isLoading = l1 || l2;

  const grouped = useMemo(() => {
    const labs = new Map<string, { name: string; monthCases: any[]; yearCases: any[]; monthPaid: number; yearPaid: number }>();
    for (const c of yearCases) {
      const id = c.external_lab_id;
      const name = (c as any).ld_external_labs?.name || "Unknown Lab";
      if (!labs.has(id)) labs.set(id, { name, monthCases: [], yearCases: [], monthPaid: 0, yearPaid: 0 });
      const entry = labs.get(id)!;
      entry.yearCases.push(c);
      if (c.received_date >= mStart && c.received_date < mEnd) entry.monthCases.push(c);
    }
    for (const p of yearPayments) {
      const id = p.external_lab_id;
      if (!labs.has(id)) labs.set(id, { name: "Unknown Lab", monthCases: [], yearCases: [], monthPaid: 0, yearPaid: 0 });
      const entry = labs.get(id)!;
      const amt = Number(p.amount) || 0;
      entry.yearPaid += amt;
      if (p.payment_date >= mStart && p.payment_date < mEnd) entry.monthPaid += amt;
    }
    return Array.from(labs.values())
      .map((l) => {
        const monthClinic = l.monthCases.reduce((s, c) => s + clinicValue(c), 0);
        const yearClinic = l.yearCases.reduce((s, c) => s + clinicValue(c), 0);
        const monthLabCost = l.monthCases.reduce((s, c) => s + externalLabCost(c), 0);
        const yearLabCost = l.yearCases.reduce((s, c) => s + externalLabCost(c), 0);
        const monthUnits = l.monthCases.reduce((s, c) => s + (Number(c.tooth_number) || 1), 0);
        const yearUnits = l.yearCases.reduce((s, c) => s + (Number(c.tooth_number) || 1), 0);
        const wtMap = new Map<string, { cases: number; units: number }>();
        for (const c of l.monthCases) {
          const wt = c.work_type_name || "Unspecified";
          const cur = wtMap.get(wt) || { cases: 0, units: 0 };
          cur.cases += 1;
          cur.units += Number(c.tooth_number) || 1;
          wtMap.set(wt, cur);
        }
        return {
          name: l.name,
          monthCases: l.monthCases.length,
          monthUnits,
          monthClinic,
          monthLabCost,
          monthPaid: l.monthPaid,
          yearCases: l.yearCases.length,
          yearUnits,
          yearClinic,
          yearLabCost,
          yearPaid: l.yearPaid,
          monthBalance: Math.max(monthLabCost - l.monthPaid, 0),
          yearBalance: Math.max(yearLabCost - l.yearPaid, 0),
          monthCaseList: l.monthCases,
          yearCaseList: l.yearCases,
          rows: Array.from(wtMap.entries()).map(([wt, v]) => ({ wt, ...v })).sort((a, b) => b.units - a.units),
        };
      })
      .sort((a, b) => b.yearLabCost - a.yearLabCost);
  }, [yearCases, yearPayments, mStart, mEnd, priceMap]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Periodic Outsource Summary <span className="text-muted-foreground font-normal">— {monthLabel}</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="ld-period-month" className="text-xs text-muted-foreground">Month</Label>
          <Input
            id="ld-period-month"
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
          <p className="text-sm text-muted-foreground">No cases outsourced in {yearLabel}.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.name} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-medium">{g.name}</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDrillDown({ labName: g.name, scope: "month", cases: g.monthCaseList })}
                      className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
                      title="Click to view cases"
                    >
                      <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 hover:border-primary transition">
                        {g.monthCases} {g.monthCases === 1 ? "case" : "cases"}
                      </Badge>
                    </button>
                    <Badge>{g.monthUnits} units</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Card 1: Selected Month - External Lab Cost */}
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">External Lab Cost ({monthLabel})</p>
                    <p className="text-sm font-semibold text-primary">{fmt(g.monthLabCost)}</p>
                    <button
                      type="button"
                      onClick={() => setDrillDown({ labName: g.name, scope: "month", cases: g.monthCaseList })}
                      className="text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      {g.monthCases} cases · {g.monthUnits} units
                    </button>
                  </div>
                  {/* Card 1A: Selected Month - Clinic Expected Income */}
                  <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Clinic Expected Income ({monthLabel})</p>
                    <p className="text-sm font-semibold text-emerald-600">{fmt(g.monthClinic)}</p>
                    <p className="text-[11px] text-muted-foreground">Expected from patients</p>
                  </div>
                  {/* Card 2: Fiscal Year - External Lab Cost */}
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">External Lab Cost (FY {yearLabel})</p>
                    <p className="text-sm font-semibold text-primary">{fmt(g.yearLabCost)}</p>
                    <button
                      type="button"
                      onClick={() => setDrillDown({ labName: g.name, scope: "year", cases: g.yearCaseList })}
                      className="text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      {g.yearCases} cases · {g.yearUnits} units
                    </button>
                  </div>
                  {/* Card 2A: Fiscal Year - Clinic Expected Income */}
                  <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Clinic Expected Income (FY {yearLabel})</p>
                    <p className="text-sm font-semibold text-emerald-600">{fmt(g.yearClinic)}</p>
                    <p className="text-[11px] text-muted-foreground">Expected from patients</p>
                  </div>
                  {/* Card 3: Selected Month Outstanding */}
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Outstanding ({monthLabel})</p>
                    <p className={`text-sm font-semibold ${g.monthBalance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {fmt(g.monthBalance)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Paid: {fmt(g.monthPaid)}</p>
                  </div>
                  {/* Card 3A: Fiscal Year Outstanding */}
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Outstanding (FY {yearLabel})</p>
                    <p className={`text-sm font-semibold ${g.yearBalance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {fmt(g.yearBalance)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Total deposits: {fmt(g.yearPaid)}</p>
                  </div>
                </div>

                {g.rows.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2 pt-1">
                    {g.rows.map((r) => (
                      <div key={r.wt} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                        <span className="truncate">{r.wt}</span>
                        <span className="text-muted-foreground whitespace-nowrap ml-2">
                          {r.cases} {r.cases === 1 ? "case" : "cases"} · {r.units} units
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!drillDown} onOpenChange={(o) => !o && setDrillDown(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {drillDown?.labName} — {drillDown?.scope === "month" ? monthLabel : `FY ${yearLabel}`}
            </DialogTitle>
          </DialogHeader>
          {drillDown && drillDown.cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases in this period.</p>
          ) : (
            <div className="divide-y">
              {(drillDown?.cases || []).slice().sort((a, b) => (b.received_date || "").localeCompare(a.received_date || "")).map((c) => {
                const isEditing = editingCaseId === c.id;
                const unit = caseUnitPrice(c);
                const hasOverride = c.external_lab_unit_price != null && c.external_lab_unit_price !== "";
                const express = Number(c.external_lab_express_charge) || 0;
                const disc = Number(c.external_lab_discount) || 0;
                return (
                  <div key={c.id} className="py-2 px-1 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => { navigate(`/lab-dashboard/cases?id=${c.id}`); setDrillDown(null); }}
                      className="min-w-0 text-left flex-1 hover:bg-muted/50 rounded p-1"
                    >
                      <p className="text-sm font-medium truncate">
                        {c.case_number || "—"} · {c.work_type_name || "Unspecified"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.patient_name || "Confidential"} · Received {c.received_date || "—"} · {c.tooth_number || 1} unit{(c.tooth_number || 1) === 1 ? "" : "s"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Unit: {fmt(unit)} {hasOverride && <span className="text-primary">(snapshot)</span>}
                        {express > 0 && <> · Express +{fmt(express)}</>}
                        {disc > 0 && <> · Discount −{fmt(disc)}</>}
                      </p>
                    </button>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-sm font-semibold">{fmt(externalLabCost(c))}</p>
                      {isEditing ? (
                        <div className="flex flex-col items-end gap-1">
                          <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Unit ₦" className="h-7 w-28 text-xs" />
                          <Input type="number" value={editExpress} onChange={(e) => setEditExpress(e.target.value)} placeholder="Express ₦" className="h-7 w-28 text-xs" />
                          <Input type="number" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} placeholder="Discount ₦" className="h-7 w-28 text-xs" />
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveOverride(c.id)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingCaseId(null); setEditValue(""); setEditExpress(""); setEditDiscount(""); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={() => {
                            setEditingCaseId(c.id);
                            setEditValue(hasOverride ? String(c.external_lab_unit_price) : "");
                            setEditExpress(express ? String(express) : "");
                            setEditDiscount(disc ? String(disc) : "");
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit lab pricing
                        </Button>
                      )}
                      {c.status && <Badge variant="outline" className="text-[10px] capitalize block">{c.status}</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setDrillDown(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
