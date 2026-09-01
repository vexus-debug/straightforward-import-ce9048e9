import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentStaff, useStaff } from "@/hooks/useStaff";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp, Receipt, Banknote } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

function formatNGN(n: number) {
  return "₦" + (n || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

export default function MyEarningsPage() {
  const { roles } = useAuth();
  const isAssociate = roles.includes("associate_dentist");
  const isAdmin = roles.includes("admin") || roles.includes("accountant");
  const { data: me } = useCurrentStaff();
  const { data: allStaff = [] } = useStaff();

  const associates = allStaff.filter((s: any) => s.staff_type === "associate");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const activeStaffId = isAssociate ? me?.id : (selectedStaffId || associates[0]?.id);
  const activeStaff = allStaff.find((s) => s.id === activeStaffId) as any;

  const today = new Date();
  const [from, setFrom] = useState<string>(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(format(endOfMonth(today), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    enabled: !!activeStaffId,
    queryKey: ["associate-earnings", activeStaffId, from, to],
    queryFn: async () => {
      // Patients owned by this staff
      const { data: patients, error: pErr } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("created_by_staff_id", activeStaffId!);
      if (pErr) throw pErr;
      const patientIds = (patients || []).map((p) => p.id);
      if (patientIds.length === 0) return { payments: [], patients: [], invoices: [], invoiceEarnings: [] };

      const { data: invoices, error: iErr } = await supabase
        .from("invoices")
        .select("id, patient_id, total_amount, amount_paid, status, invoice_number, created_at")
        .in("patient_id", patientIds);
      if (iErr) throw iErr;
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

      // Strategy-based invoice earnings (locked at invoice creation)
      const { data: invoiceEarnings, error: eErr } = await supabase
        .from("associate_invoice_earnings")
        .select("id, invoice_id, strategy, percentage, invoice_amount, earnings_amount, created_at, patient_id")
        .eq("associate_staff_id", activeStaffId!)
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });
      if (eErr) throw eErr;

      return { payments, patients: patients || [], invoices: invoices || [], invoiceEarnings: invoiceEarnings || [] };
    },
  });

  const summary = useMemo(() => {
    const grossPayments = (data?.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    let associateShare = 0;
    let clinicShare = 0;
    if (activeStaff?.compensation_type === "revenue_split") {
      const pct = Number(activeStaff.compensation_percentage || 0);
      associateShare = (grossPayments * pct) / 100;
      clinicShare = grossPayments - associateShare;
    } else if (activeStaff?.compensation_type === "flat_fee") {
      const flat = Number(activeStaff.compensation_flat_amount || 0);
      // Flat: associate keeps everything, clinic gets fixed monthly fee
      clinicShare = flat;
      associateShare = grossPayments - flat;
    }
    return {
      grossPayments,
      associateShare,
      clinicShare,
      patientCount: data?.patients.length || 0,
      paymentCount: data?.payments.length || 0,
    };
  }, [data, activeStaff]);

  if (!isAssociate && !isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Not available for your role.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAssociate ? "My Earnings" : "Associate Earnings"}
        description={isAssociate ? "Your revenue statement for the selected period" : "Per-associate revenue statements"}
      />

      <Card className="glass-card">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-3">
          {!isAssociate && (
            <div className="space-y-1">
              <Label className="text-xs">Associate</Label>
              <Select value={activeStaffId || ""} onValueChange={setSelectedStaffId}>
                <SelectTrigger><SelectValue placeholder="Select associate" /></SelectTrigger>
                <SelectContent>
                  {associates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {activeStaff && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Compensation:</span>
          {activeStaff.compensation_type === "revenue_split" && (
            <Badge variant="secondary">Revenue split — {activeStaff.compensation_percentage}% to associate</Badge>
          )}
          {activeStaff.compensation_type === "flat_fee" && (
            <Badge variant="secondary">Flat chair-rental — {formatNGN(Number(activeStaff.compensation_flat_amount))}/mo to clinic</Badge>
          )}
          {activeStaff.compensation_strategy === "materials_excluded" && (
            <Badge variant="secondary">Revenue split — 30% (machines only, no materials)</Badge>
          )}
          {activeStaff.compensation_strategy === "materials_included" && (
            <Badge variant="secondary">Revenue split — 70% (machines + materials)</Badge>
          )}
          {!activeStaff.compensation_type && !activeStaff.compensation_strategy && (
            <Badge variant="outline">Not configured</Badge>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Banknote} label="Gross Payments" value={formatNGN(summary.grossPayments)} loading={isLoading} />
        <StatCard icon={Wallet} label="Associate Share" value={formatNGN(summary.associateShare)} loading={isLoading} highlight />
        <StatCard icon={TrendingUp} label="Clinic Share" value={formatNGN(summary.clinicShare)} loading={isLoading} />
        <StatCard icon={Receipt} label="Payments" value={String(summary.paymentCount)} loading={isLoading} />
      </div>

      {(data?.invoiceEarnings?.length ?? 0) > 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Invoice earnings (locked at creation)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground text-xs uppercase">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Strategy</th>
                    <th className="py-2 px-2 text-right">Invoice</th>
                    <th className="py-2 px-2 text-right">Your Share</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.invoiceEarnings.map((e: any) => (
                    <tr key={e.id} className="border-t">
                      <td className="py-2 px-2">{format(new Date(e.created_at), "yyyy-MM-dd")}</td>
                      <td className="py-2 px-2">{e.percentage}%</td>
                      <td className="py-2 px-2 text-right">{formatNGN(Number(e.invoice_amount))}</td>
                      <td className="py-2 px-2 text-right font-medium text-secondary">{formatNGN(Number(e.earnings_amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Payments in period</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (data?.payments.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground text-xs uppercase">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Invoice</th>
                    <th className="py-2 px-2">Method</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.payments.map((p) => {
                    const inv = data.invoices.find((i) => i.id === p.invoice_id);
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="py-2 px-2">{p.payment_date}</td>
                        <td className="py-2 px-2 font-mono text-xs">{inv?.invoice_number || "—"}</td>
                        <td className="py-2 px-2 capitalize">{p.payment_method}</td>
                        <td className="py-2 px-2 text-right font-medium">{formatNGN(Number(p.amount))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, loading, highlight }: { icon: any; label: string; value: string; loading?: boolean; highlight?: boolean }) {
  return (
    <Card className={`glass-card ${highlight ? "border-secondary/40" : ""}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${highlight ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>
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
