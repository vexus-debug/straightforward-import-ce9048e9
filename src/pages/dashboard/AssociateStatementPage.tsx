import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { Banknote, Wallet, TrendingDown, Download, Receipt, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/EmptyState";

const fmtNGN = (v: number) => "₦" + (v || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 });

function exportCSV(rows: any[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function AssociateStatementPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("accountant");
  const { data: staff = [] } = useStaff();

  const associates = useMemo(
    () => staff.filter((s: any) => s.role === "associate_dentist"),
    [staff]
  );

  const today = new Date();
  const [associateId, setAssociateId] = useState<string>("");
  const [from, setFrom] = useState<string>(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(format(endOfMonth(today), "yyyy-MM-dd"));

  const activeAssociate = associates.find((a: any) => a.id === associateId) as any;

  const { data, isLoading } = useQuery({
    enabled: !!associateId,
    queryKey: ["associate-statement", associateId, from, to],
    queryFn: async () => {
      // Patients registered by this associate
      const { data: patients, error: pErr } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("created_by_staff_id", associateId);
      if (pErr) throw pErr;
      const patientIds = (patients || []).map((p) => p.id);
      if (patientIds.length === 0) return { patients: [], invoices: [], payments: [] };

      // Invoices in the period for those patients
      const { data: invoices, error: iErr } = await supabase
        .from("invoices")
        .select("id, invoice_number, patient_id, invoice_date, total_amount, amount_paid, status")
        .in("patient_id", patientIds)
        .gte("invoice_date", from)
        .lte("invoice_date", to)
        .order("invoice_date", { ascending: false });
      if (iErr) throw iErr;

      // Payments in the period attached to those invoices
      const invoiceIds = (invoices || []).map((i) => i.id);
      let payments: any[] = [];
      if (invoiceIds.length) {
        const { data: pays, error: payErr } = await supabase
          .from("payments")
          .select("id, invoice_id, amount, payment_date, payment_method")
          .in("invoice_id", invoiceIds)
          .gte("payment_date", from)
          .lte("payment_date", to)
          .order("payment_date", { ascending: false });
        if (payErr) throw payErr;
        payments = pays || [];
      }
      return { patients: patients || [], invoices: invoices || [], payments };
    },
  });

  const summary = useMemo(() => {
    const invoices = data?.invoices || [];
    const payments = data?.payments || [];
    const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const outstanding = invoices.reduce(
      (s, i) => s + Math.max(Number(i.total_amount || 0) - Number(i.amount_paid || 0), 0),
      0
    );

    // Auto split using the associate's compensation rule on the staff record
    let associateShare = 0;
    let clinicShare = 0;
    let splitLabel = "Not configured";
    if (activeAssociate?.compensation_type === "revenue_split") {
      const pct = Number(activeAssociate.compensation_percentage || 0);
      associateShare = (totalPaid * pct) / 100;
      clinicShare = totalPaid - associateShare;
      splitLabel = `Revenue split — ${pct}% to associate`;
    } else if (activeAssociate?.compensation_type === "flat_fee") {
      const flat = Number(activeAssociate.compensation_flat_amount || 0);
      clinicShare = flat;
      associateShare = totalPaid - flat;
      splitLabel = `Flat chair-rental — ${fmtNGN(flat)}/mo to clinic`;
    }

    return {
      totalBilled,
      totalPaid,
      outstanding,
      associateShare,
      clinicShare,
      splitLabel,
      patientCount: data?.patients.length || 0,
      invoiceCount: invoices.length,
      paymentCount: payments.length,
    };
  }, [data, activeAssociate]);

  const patientName = (id: string) => {
    const p = data?.patients.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  };

  const handleExport = () => {
    if (!data || !activeAssociate) return;
    const rows = data.invoices.map((i) => ({
      Associate: activeAssociate.full_name,
      Invoice: i.invoice_number,
      Patient: patientName(i.patient_id),
      Date: i.invoice_date,
      Total: i.total_amount,
      Paid: i.amount_paid,
      Balance: Math.max(Number(i.total_amount) - Number(i.amount_paid), 0),
      Status: i.status,
    }));
    exportCSV(rows, `associate-statement-${activeAssociate.full_name.replace(/\s+/g, "-")}-${from}_${to}.csv`);
  };

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Not available for your role.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Associate Dentist Statement"
        description="Periodic revenue-share statement: paid bills, outstanding bills and payments per associate"
      />

      <Card className="glass-card">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Associate Dentist</Label>
            <Select value={associateId} onValueChange={setAssociateId}>
              <SelectTrigger>
                <SelectValue placeholder="Type or select an associate dentist" />
              </SelectTrigger>
              <SelectContent>
                {associates.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No associate dentists registered</div>
                ) : (
                  associates.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From Date *</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To Date *</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {!associateId ? (
        <EmptyState
          icon={Users}
          title="Select an associate to generate a statement"
          description="Choose an associate dentist above to see their paid bills, outstanding bills and payments for the selected period."
        />
      ) : (
        <>
          {activeAssociate && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Compensation:</span>
              <Badge variant="secondary">{summary.splitLabel}</Badge>
            </div>
          )}

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Banknote} label="Total Billed" value={fmtNGN(summary.totalBilled)} loading={isLoading} />
            <StatCard icon={Receipt} label="Total Paid" value={fmtNGN(summary.totalPaid)} loading={isLoading} tone="emerald" />
            <StatCard icon={TrendingDown} label="Outstanding" value={fmtNGN(summary.outstanding)} loading={isLoading} tone="rose" />
            <StatCard icon={Wallet} label="Associate Share" value={fmtNGN(summary.associateShare)} loading={isLoading} tone="primary" />
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Invoices in period</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!data?.invoices.length}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (data?.invoices.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No invoices for this associate in the selected period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground text-xs uppercase border-b border-border/30">
                        <th className="py-2 px-2">Invoice</th>
                        <th className="py-2 px-2">Patient</th>
                        <th className="py-2 px-2">Date</th>
                        <th className="py-2 px-2 text-right">Amount</th>
                        <th className="py-2 px-2 text-right">Paid</th>
                        <th className="py-2 px-2 text-right">Balance</th>
                        <th className="py-2 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.invoices.map((inv) => {
                        const balance = Math.max(Number(inv.total_amount) - Number(inv.amount_paid), 0);
                        return (
                          <motion.tr
                            key={inv.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border-b border-border/20 last:border-0"
                          >
                            <td className="py-2 px-2 font-mono text-xs">{inv.invoice_number}</td>
                            <td className="py-2 px-2">{patientName(inv.patient_id)}</td>
                            <td className="py-2 px-2 text-muted-foreground">{inv.invoice_date}</td>
                            <td className="py-2 px-2 text-right">{fmtNGN(Number(inv.total_amount))}</td>
                            <td className="py-2 px-2 text-right text-emerald-600">{fmtNGN(Number(inv.amount_paid))}</td>
                            <td className={`py-2 px-2 text-right font-medium ${balance > 0 ? "text-destructive" : ""}`}>{fmtNGN(balance)}</td>
                            <td className="py-2 px-2 text-center">
                              <Badge variant="outline" className="text-[10px] capitalize">{inv.status}</Badge>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="text-xs font-medium border-t border-border/30">
                        <td className="py-2 px-2" colSpan={3}>Totals</td>
                        <td className="py-2 px-2 text-right">{fmtNGN(summary.totalBilled)}</td>
                        <td className="py-2 px-2 text-right text-emerald-600">{fmtNGN(summary.totalPaid)}</td>
                        <td className="py-2 px-2 text-right text-destructive">{fmtNGN(summary.outstanding)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3"><CardTitle className="text-base">Payments in period</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (data?.payments.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground text-xs uppercase border-b border-border/30">
                        <th className="py-2 px-2">Date</th>
                        <th className="py-2 px-2">Invoice</th>
                        <th className="py-2 px-2">Patient</th>
                        <th className="py-2 px-2">Method</th>
                        <th className="py-2 px-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.payments.map((p) => {
                        const inv = data!.invoices.find((i) => i.id === p.invoice_id);
                        return (
                          <tr key={p.id} className="border-b border-border/20 last:border-0">
                            <td className="py-2 px-2">{p.payment_date}</td>
                            <td className="py-2 px-2 font-mono text-xs">{inv?.invoice_number || "—"}</td>
                            <td className="py-2 px-2">{inv ? patientName(inv.patient_id) : "—"}</td>
                            <td className="py-2 px-2 capitalize">{p.payment_method}</td>
                            <td className="py-2 px-2 text-right font-medium">{fmtNGN(Number(p.amount))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard icon={Wallet} label="Associate Share" value={fmtNGN(summary.associateShare)} tone="primary" />
            <StatCard icon={Banknote} label="Clinic Share" value={fmtNGN(summary.clinicShare)} tone="muted" />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, loading, tone = "muted",
}: { icon: any; label: string; value: string; loading?: boolean; tone?: "muted" | "primary" | "emerald" | "rose" }) {
  const toneCls = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-secondary/15 text-secondary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
  }[tone];

  return (
    <Card className={`glass-card ${tone === "primary" ? "border-secondary/40" : ""}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-5 w-24 mt-1" /> : <p className="text-lg font-semibold truncate">{value}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
