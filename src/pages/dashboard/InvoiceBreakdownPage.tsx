import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Download, FileSpreadsheet, Pencil } from "lucide-react";
import * as XLSX from "xlsx";

const fmt = (v: number) =>
  "₦" + (v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Items 9–14 are all derived from the Balance Bill (item 8).
// 12.5 + 12.5 (6+4+2.5) + 30 + 15 + 15 + 5 + 10 = 100%
const STAFF_PERF_PCT = 12.5; // 9A — Staff / Dentist performance
const BASE_OPS_ROLES = [
  { key: "Manager", pct: 6 },
  { key: "Receptionist", pct: 4 },
  { key: "Assistant", pct: 2.5 },
]; // 9B — Base operations 12.5% allocation
const BASE_OPS_PCT = BASE_OPS_ROLES.reduce((s, r) => s + r.pct, 0); // 12.5
const CATEGORY_TARGETS = {
  clinical_savings: 30,
  expenses: 15,
  investors: 15,
  tithe: 5,
  rent: 10,
};

interface Row {
  invoice_id: string;
  invoice_date: string;
  invoice_number: string;
  patient_id: string;
  patient_name: string;
  total_bill: number;
  external_lab_cost: number;
  dental_sales: number;
  reg_consultation: number;
  associate_share: number;
  balance_bill: number;
  staff_performance: number;
  base_operations: number;
  base_ops_roles: Record<string, number>;
  clinical_savings: number;
  expenses: number;
  investors: number;
  tithe: number;
  rent: number;
  deposit: number;
  balance_payment: number;
}

const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const todayIso = () => new Date().toISOString().slice(0, 10);

function useBreakdown(from: string, to: string) {
  return useQuery<Row[]>({
    queryKey: ["invoice-financial-breakdown", from, to],
    queryFn: async () => {
      const { data: invoices, error: invErr } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total_amount, amount_paid, patient_id")
        .gte("invoice_date", from)
        .lte("invoice_date", to)
        .order("invoice_date", { ascending: false });
      if (invErr) throw invErr;

      const ids = (invoices || []).map((i) => i.id);
      const patientIds = [...new Set((invoices || []).map((i) => i.patient_id))];
      const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
      const safePatIds = patientIds.length ? patientIds : ["00000000-0000-0000-0000-000000000000"];

      const [{ data: items }, { data: assocEarn }, { data: patients }, { data: overrides }] =
        await Promise.all([
          supabase
            .from("invoice_items")
            .select("invoice_id, line_total, description, treatment_id, treatments(category, name)")
            .in("invoice_id", safeIds),
          supabase
            .from("associate_invoice_earnings" as any)
            .select("invoice_id, earnings_amount")
            .in("invoice_id", safeIds),
          supabase.from("patients").select("id, first_name, last_name").in("id", safePatIds),
          supabase
            .from("invoice_breakdown_overrides" as any)
            .select("invoice_id, examination, lab_cost, dental_sales, associate_share")
            .in("invoice_id", safeIds),
        ]);

      const treatmentIds = [
        ...new Set((items || []).map((it: any) => it.treatment_id).filter((t: any) => !!t)),
      ];
      const { data: labCases } = await supabase
        .from("lab_cases")
        .select("treatment_id, net_amount")
        .in("treatment_id", treatmentIds.length ? treatmentIds : ["00000000-0000-0000-0000-000000000000"]);

      const labByTreatment = new Map<string, number>();
      (labCases || []).forEach((lc: any) => {
        labByTreatment.set(lc.treatment_id, (labByTreatment.get(lc.treatment_id) || 0) + Number(lc.net_amount || 0));
      });

      const patientMap = new Map(
        (patients || []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]),
      );
      const overrideMap = new Map<string, any>(
        (overrides || []).map((o: any) => [o.invoice_id, o]),
      );

      const itemsByInvoice = new Map<string, any[]>();
      (items || []).forEach((it: any) => {
        const arr = itemsByInvoice.get(it.invoice_id) || [];
        arr.push(it);
        itemsByInvoice.set(it.invoice_id, arr);
      });

      const assocByInvoice = new Map<string, number>();
      (assocEarn || []).forEach((a: any) => {
        assocByInvoice.set(a.invoice_id, (assocByInvoice.get(a.invoice_id) || 0) + Number(a.earnings_amount || 0));
      });

      return (invoices || []).map((inv: any): Row => {
        const its = itemsByInvoice.get(inv.id) || [];
        let dental = 0;
        let reg = 0;
        let lab = 0;
        its.forEach((it: any) => {
          const total = Number(it.line_total || 0);
          const cat = it.treatments?.category?.toLowerCase() || "";
          const name = (it.treatments?.name || it.description || "").toLowerCase();
          const isConsult =
            name.includes("consult") || name.includes("registration") ||
            name.includes("reg ") || cat === "consultation";
          if (isConsult) reg += total;
          else dental += total;
          if (it.treatment_id && labByTreatment.has(it.treatment_id)) {
            lab += labByTreatment.get(it.treatment_id) || 0;
          }
        });

        const ov = overrideMap.get(inv.id);
        const total = Number(inv.total_amount || 0);
        const paid = Number(inv.amount_paid || 0);
        let associate = assocByInvoice.get(inv.id) || 0;
        if (ov) {
          if (ov.examination !== null && ov.examination !== undefined) reg = Number(ov.examination);
          if (ov.lab_cost !== null && ov.lab_cost !== undefined) lab = Number(ov.lab_cost);
          if (ov.dental_sales !== null && ov.dental_sales !== undefined) dental = Number(ov.dental_sales);
          if (ov.associate_share !== null && ov.associate_share !== undefined) associate = Number(ov.associate_share);
        }

        // Item 8 — Balance Bill = Px Total Bill − (lab + dental + reg + associate share)
        const balanceBill = total - (lab + dental + reg + associate);

        // Items 9–14 are all derived from the Balance Bill.
        const alloc = (pct: number) => (balanceBill * pct) / 100;
        const baseOpsRoles: Record<string, number> = {};
        BASE_OPS_ROLES.forEach((r) => { baseOpsRoles[r.key] = alloc(r.pct); });

        return {
          invoice_id: inv.id,
          invoice_date: inv.invoice_date,
          invoice_number: inv.invoice_number,
          patient_id: inv.patient_id,
          patient_name: patientMap.get(inv.patient_id) || "—",
          total_bill: total,
          external_lab_cost: lab,
          dental_sales: dental,
          reg_consultation: reg,
          associate_share: associate,
          balance_bill: balanceBill,
          staff_performance: alloc(STAFF_PERF_PCT),
          base_operations: alloc(BASE_OPS_PCT),
          base_ops_roles: baseOpsRoles,
          clinical_savings: alloc(CATEGORY_TARGETS.clinical_savings),
          expenses: alloc(CATEGORY_TARGETS.expenses),
          investors: alloc(CATEGORY_TARGETS.investors),
          tithe: alloc(CATEGORY_TARGETS.tithe),
          rent: alloc(CATEGORY_TARGETS.rent),
          deposit: paid,
          balance_payment: total - paid,
        };
      });
    },
  });
}

function usePatientSummary(patientId: string | null) {
  return useQuery({
    queryKey: ["patient-summary", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const [{ data: patient }, { data: prescriptions }, { data: invoices }] =
        await Promise.all([
          supabase.from("patients").select("id, first_name, last_name, phone, email").eq("id", patientId!).maybeSingle(),
          supabase.from("prescriptions").select("id, diagnosis, prescription_date, notes")
            .eq("patient_id", patientId!).order("prescription_date", { ascending: false }).limit(20),
          supabase.from("invoices").select("id, invoice_number, invoice_date, total_amount, amount_paid, status")
            .eq("patient_id", patientId!).order("invoice_date", { ascending: false }).limit(20),
        ]);
      const invIds = (invoices || []).map((i: any) => i.id);
      const [{ data: items }, { data: payments }] = invIds.length
        ? await Promise.all([
            supabase.from("invoice_items").select("description, line_total, treatments(name)").in("invoice_id", invIds),
            supabase.from("payments").select("id, amount, payment_date, payment_method, invoice_id")
              .in("invoice_id", invIds).order("payment_date", { ascending: false }).limit(50),
          ])
        : [{ data: [] as any[] }, { data: [] as any[] }];
      return { patient, prescriptions: prescriptions || [], invoices: invoices || [], payments: payments || [], items: items || [] };
    },
  });
}

function useSaveOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { invoice_id: string; field: "examination" | "lab_cost" | "dental_sales" | "associate_share"; value: number | null }) => {
      const { data: existing } = await supabase
        .from("invoice_breakdown_overrides" as any)
        .select("*").eq("invoice_id", payload.invoice_id).maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("invoice_breakdown_overrides" as any)
          .update({ [payload.field]: payload.value } as any)
          .eq("invoice_id", payload.invoice_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("invoice_breakdown_overrides" as any)
          .insert([{ invoice_id: payload.invoice_id, [payload.field]: payload.value } as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-financial-breakdown"] });
      toast({ title: "Saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

function useSaveInvoiceDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { invoice_id: string; invoice_date: string }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ invoice_date: payload.invoice_date })
        .eq("id", payload.invoice_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-financial-breakdown"] });
      toast({ title: "Invoice date updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}



function EditableCell({
  value, onSave, editable,
}: { value: number; onSave: (v: number | null) => void; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));

  const commit = () => {
    setEditing(false);
    const trimmed = v.trim();
    // Empty input clears (deletes) the override → reverts to computed value
    if (trimmed === "") {
      onSave(null);
      return;
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num !== value) onSave(num);
  };

  if (!editable) return <>{fmt(value)}</>;
  if (!editing) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:underline"
        onClick={() => { setV(String(value)); setEditing(true); }}
      >
        {fmt(value)} <Pencil className="h-3 w-3 opacity-60" />
      </button>
    );
  }
  return (
    <Input
      autoFocus
      type="number"
      step="0.01"
      value={v}
      placeholder="empty = reset"
      className="h-7 w-28 text-right"
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function EditableDateCell({
  value, onSave, editable,
}: { value: string; onSave: (v: string) => void; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);

  const commit = () => {
    setEditing(false);
    if (v && v !== value) onSave(v);
  };

  if (!editable) return <>{value}</>;
  if (!editing) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:underline"
        onClick={() => { setV(value); setEditing(true); }}
      >
        {value} <Pencil className="h-3 w-3 opacity-60" />
      </button>
    );
  }
  return (
    <Input
      autoFocus
      type="date"
      value={v}
      className="h-7 w-36"
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function buildExportRows(rows: Row[]) {
  return rows.map((r) => ({
    "Generated Invoice Date": r.invoice_date,
    "Invoice #": r.invoice_number,
    "Patient Name": r.patient_name,
    "Px Total Bill": r.total_bill,
    "External Lab Cost": r.external_lab_cost,
    "Dental Sales": r.dental_sales,
    "Reg / Consultation": r.reg_consultation,
    "Associate Dentist Share (70:30)": r.associate_share,
    "Balance Bill": r.balance_bill,
    "Staff/Dentist Performance (12.5%)": r.staff_performance,
    "Base Ops — Manager (6%)": r.base_ops_roles["Manager"],
    "Base Ops — Receptionist (4%)": r.base_ops_roles["Receptionist"],
    "Base Ops — Assistant (2.5%)": r.base_ops_roles["Assistant"],
    "Clinical Savings (30%)": r.clinical_savings,
    "Expenses (15%)": r.expenses,
    "Investors (15%)": r.investors,
    "Tithe (5%)": r.tithe,
    "Rent (10%)": r.rent,
    "Deposit": r.deposit,
    "Balance Payment": r.balance_payment,
  }));
}

export default function InvoiceBreakdownPage() {
  const { roles } = useAuth();
  const isAdmin = roles?.includes("admin");
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [patientId, setPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: allRows = [], isLoading } = useBreakdown(from, to);
  const saveOverride = useSaveOverride();
  const saveInvoiceDate = useSaveInvoiceDate();
  const summary = usePatientSummary(patientId);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.patient_name.toLowerCase().includes(q) ||
        r.invoice_number.toLowerCase().includes(q),
    );
  }, [allRows, search]);

  const setMonth = (ym: string) => {
    if (!ym) return;
    const [y, m] = ym.split("-").map(Number);
    const first = `${ym}-01`;
    const last = new Date(y, m, 0).toISOString().slice(0, 10);
    setFrom(first);
    setTo(last);
  };
  const monthValue = from.slice(0, 7) === to.slice(0, 7) ? from.slice(0, 7) : "";

  const totals = useMemo(() => {
    const t = {
      total_bill: 0, external_lab_cost: 0, dental_sales: 0, reg_consultation: 0,
      associate_share: 0, balance_bill: 0, staff_performance: 0, base_operations: 0,
      base_ops_roles: { Manager: 0, Receptionist: 0, Assistant: 0 } as Record<string, number>,
      clinical_savings: 0, expenses: 0, investors: 0, tithe: 0, rent: 0,
      deposit: 0, balance_payment: 0,
    };
    rows.forEach((r) => {
      t.total_bill += r.total_bill;
      t.external_lab_cost += r.external_lab_cost;
      t.dental_sales += r.dental_sales;
      t.reg_consultation += r.reg_consultation;
      t.associate_share += r.associate_share;
      t.balance_bill += r.balance_bill;
      t.staff_performance += r.staff_performance;
      t.base_operations += r.base_operations;
      BASE_OPS_ROLES.forEach((s) => (t.base_ops_roles[s.key] += r.base_ops_roles[s.key] || 0));
      t.clinical_savings += r.clinical_savings;
      t.expenses += r.expenses;
      t.investors += r.investors;
      t.tithe += r.tithe;
      t.rent += r.rent;
      t.deposit += r.deposit;
      t.balance_payment += r.balance_payment;
    });
    return t;
  }, [rows]);

  const exportCSV = () => {
    const data = buildExportRows(rows);
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((r) =>
        headers.map((h) => {
          const v = (r as any)[h];
          const s = v === null || v === undefined ? "" : String(v);
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-breakdown-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = () => {
    const data = buildExportRows(rows);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoice Breakdown");
    XLSX.writeFile(wb, `invoice-breakdown-${from}_to_${to}.xlsx`);
  };

  const numCols = 19; // total leaf columns for colSpan on empty/loading rows

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoice Financial Breakdown"
        description="Per-invoice view of patient billing, lab costs, associate sharing and balance-bill allocations."
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Search patient / invoice</label>
            <Input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[200px]"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Month</label>
            <Input type="month" value={monthValue} onChange={(e) => setMonth(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button size="sm" onClick={exportXLSX} disabled={!rows.length}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Invoices ({rows.length}) — {from} → {to}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {/* Grouped header row — Excel-style sectioning */}
                <TableRow className="bg-muted/70">
                  <TableHead rowSpan={2} className="whitespace-nowrap align-bottom">Generated Invoice Date</TableHead>
                  <TableHead rowSpan={2} className="whitespace-nowrap align-bottom">Patient Name</TableHead>
                  <TableHead rowSpan={2} className="text-right whitespace-nowrap align-bottom">Px Total Bill</TableHead>
                  <TableHead colSpan={4} className="text-center whitespace-nowrap border-l">Deductions</TableHead>
                  <TableHead rowSpan={2} className="text-right whitespace-nowrap align-bottom border-l">Balance Bill<br /><span className="text-[10px] font-normal text-muted-foreground">Total − (Lab+Sales+Reg+Assoc)</span></TableHead>
                  <TableHead colSpan={4} className="text-center whitespace-nowrap border-l">Staff & Base Ops (25% of Balance)</TableHead>
                  <TableHead colSpan={5} className="text-center whitespace-nowrap border-l">Allocations (% of Balance Bill)</TableHead>
                  <TableHead colSpan={2} className="text-center whitespace-nowrap border-l">Payment</TableHead>
                </TableRow>
                <TableRow className="bg-muted/50">
                  {/* Deductions */}
                  <TableHead className="text-right whitespace-nowrap border-l">External Lab Cost</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Dental Sales</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Reg / Consultation</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Associate Share (70:30)</TableHead>
                  {/* Staff & base ops */}
                  <TableHead className="text-right whitespace-nowrap border-l">Staff/Dentist Perf. (12.5%)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Manager (6%)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Receptionist (4%)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Assistant (2.5%)</TableHead>
                  {/* Allocations */}
                  <TableHead className="text-right whitespace-nowrap border-l">Clinical Savings (30%)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Expenses (15%)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Investors (15%)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Tithe (5%)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Rent (10%)</TableHead>
                  {/* Payment */}
                  <TableHead className="text-right whitespace-nowrap border-l">Deposit</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Balance Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={numCols} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={numCols} className="text-center py-8 text-muted-foreground">No invoices in this range</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {rows.map((r) => (
                      <TableRow key={r.invoice_id}>
                        <TableCell className="whitespace-nowrap">
                          <EditableDateCell
                            value={r.invoice_date}
                            editable={!!isAdmin}
                            onSave={(v) => saveInvoiceDate.mutate({ invoice_id: r.invoice_id, invoice_date: v })}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => setPatientId(r.patient_id)}
                          >
                            {r.patient_name}
                          </button>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">{fmt(r.total_bill)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap border-l">
                          <EditableCell
                            value={r.external_lab_cost}
                            editable={!!isAdmin}
                            onSave={(v) => saveOverride.mutate({ invoice_id: r.invoice_id, field: "lab_cost", value: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <EditableCell
                            value={r.dental_sales}
                            editable={!!isAdmin}
                            onSave={(v) => saveOverride.mutate({ invoice_id: r.invoice_id, field: "dental_sales", value: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <EditableCell
                            value={r.reg_consultation}
                            editable={!!isAdmin}
                            onSave={(v) => saveOverride.mutate({ invoice_id: r.invoice_id, field: "examination", value: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <EditableCell
                            value={r.associate_share}
                            editable={!!isAdmin}
                            onSave={(v) => saveOverride.mutate({ invoice_id: r.invoice_id, field: "associate_share", value: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap border-l font-medium">{fmt(r.balance_bill)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap border-l">{fmt(r.staff_performance)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmt(r.base_ops_roles["Manager"])}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmt(r.base_ops_roles["Receptionist"])}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmt(r.base_ops_roles["Assistant"])}</TableCell>
                        <TableCell className="text-right whitespace-nowrap border-l">{fmt(r.clinical_savings)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmt(r.expenses)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmt(r.investors)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmt(r.tithe)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmt(r.rent)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap border-l">{fmt(r.deposit)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmt(r.balance_payment)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell colSpan={2}>TOTALS</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.total_bill)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap border-l">{fmt(totals.external_lab_cost)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.dental_sales)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.reg_consultation)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.associate_share)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap border-l">{fmt(totals.balance_bill)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap border-l">{fmt(totals.staff_performance)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.base_ops_roles["Manager"])}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.base_ops_roles["Receptionist"])}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.base_ops_roles["Assistant"])}</TableCell>
                      <TableCell className="text-right whitespace-nowrap border-l">{fmt(totals.clinical_savings)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.expenses)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.investors)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.tithe)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.rent)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap border-l">{fmt(totals.deposit)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(totals.balance_payment)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!patientId} onOpenChange={(o) => !o && setPatientId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {summary.data?.patient
                ? `${summary.data.patient.first_name} ${summary.data.patient.last_name}`
                : "Patient"}
            </SheetTitle>
            <SheetDescription>
              {summary.data?.patient?.phone || ""} {summary.data?.patient?.email ? ` · ${summary.data.patient.email}` : ""}
            </SheetDescription>
          </SheetHeader>

          {summary.isLoading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading…</p>
          ) : !summary.data ? null : (
            <div className="space-y-6 py-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">Diagnoses</h3>
                {summary.data.prescriptions.length === 0 ? (
                  <p className="text-muted-foreground">No diagnoses recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {summary.data.prescriptions.map((p: any) => (
                      <li key={p.id} className="border-b pb-1">
                        <div className="text-xs text-muted-foreground">{p.prescription_date}</div>
                        <div>{p.diagnosis || "—"}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="font-semibold mb-2">Treatments</h3>
                {summary.data.items.length === 0 ? (
                  <p className="text-muted-foreground">No treatments billed.</p>
                ) : (
                  <ul className="space-y-1">
                    {summary.data.items.map((it: any, i: number) => (
                      <li key={i} className="flex justify-between border-b py-1">
                        <span>{it.treatments?.name || it.description}</span>
                        <span>{fmt(Number(it.line_total || 0))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="font-semibold mb-2">Invoices</h3>
                {summary.data.invoices.length === 0 ? (
                  <p className="text-muted-foreground">No invoices.</p>
                ) : (
                  <ul className="space-y-1">
                    {summary.data.invoices.map((inv: any) => (
                      <li key={inv.id} className="flex justify-between border-b py-1">
                        <span>
                          <span className="font-medium">{inv.invoice_number}</span>{" "}
                          <span className="text-muted-foreground">{inv.invoice_date}</span>
                        </span>
                        <span>
                          {fmt(Number(inv.amount_paid || 0))} / {fmt(Number(inv.total_amount || 0))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="font-semibold mb-2">Deposits / Payments</h3>
                {summary.data.payments.length === 0 ? (
                  <p className="text-muted-foreground">No payments yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {summary.data.payments.map((p: any) => (
                      <li key={p.id} className="flex justify-between border-b py-1">
                        <span>
                          {p.payment_date}{" "}
                          <span className="text-muted-foreground">· {p.payment_method}</span>
                        </span>
                        <span>{fmt(Number(p.amount || 0))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
