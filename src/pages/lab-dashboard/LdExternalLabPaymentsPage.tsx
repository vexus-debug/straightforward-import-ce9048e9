import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, DollarSign, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLdExternalLabs } from "@/hooks/useLdExtendedFeatures";
import { useAuth } from "@/hooks/useAuth";

function useLdExternalLabPayments() {
  return useQuery({
    queryKey: ["ld-external-lab-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ld_external_lab_payments" as any)
        .select("*")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

function useCreateLdExternalLabPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { error } = await supabase.from("ld_external_lab_payments" as any).insert([values as any]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ld-external-lab-payments"] }); toast.success("Payment recorded"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useUpdateLdExternalLabPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await supabase.from("ld_external_lab_payments" as any).update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ld-external-lab-payments"] }); toast.success("Payment updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useDeleteLdExternalLabPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ld_external_lab_payments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ld-external-lab-payments"] }); toast.success("Payment deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

const UNIT_TYPES = [
  { value: "case", label: "Per Case" },
  { value: "tooth", label: "Per Tooth" },
  { value: "appliance", label: "Per Appliance" },
  { value: "other", label: "Other" },
];

export default function LdExternalLabPaymentsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("lab_manager");
  const { data: payments = [], isLoading } = useLdExternalLabPayments();
  const { data: labs = [] } = useLdExternalLabs();
  const createPayment = useCreateLdExternalLabPayment();
  const updatePayment = useUpdateLdExternalLabPayment();
  const deletePayment = useDeleteLdExternalLabPayment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formLabId, setFormLabId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formAmount, setFormAmount] = useState(0);
  const [formUnits, setFormUnits] = useState(1);
  const [formUnitType, setFormUnitType] = useState("case");
  const [formNotes, setFormNotes] = useState("");

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const getLabName = (id: string) => labs.find(l => l.id === id)?.name || "Unknown";

  const resetForm = () => {
    setEditingId(null);
    setFormLabId("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormAmount(0);
    setFormUnits(1);
    setFormUnitType("case");
    setFormNotes("");
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setFormLabId(p.external_lab_id || "");
    setFormDate((p.payment_date || "").split("T")[0] || new Date().toISOString().split("T")[0]);
    setFormAmount(Number(p.amount) || 0);
    setFormUnits(Number(p.units) || 1);
    setFormUnitType(p.unit_type || "case");
    setFormNotes(p.notes || "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formLabId) { toast.error("Select a lab"); return; }
    if (!formDate) { toast.error("Payment date is required"); return; }
    const parsed = new Date(formDate);
    if (isNaN(parsed.getTime())) { toast.error("Enter a valid payment date"); return; }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsed.getTime() > today.getTime()) { toast.error("Payment date cannot be in the future"); return; }
    if (formAmount <= 0) { toast.error("Enter a valid amount"); return; }
    const values = {
      external_lab_id: formLabId,
      payment_date: formDate,
      amount: formAmount,
      units: formUnits,
      unit_type: formUnitType,
      notes: formNotes || null,
    };
    if (editingId) {
      await updatePayment.mutateAsync({ id: editingId, values });
    } else {
      await createPayment.mutateAsync(values);
    }
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">External Lab Payments</h1>
          <p className="text-sm text-muted-foreground">Record payments made to partner labs (admin only)</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Payment History ({payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Lab</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Unit Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p: any, idx: number) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>{format(new Date(p.payment_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{getLabName(p.external_lab_id)}</TableCell>
                    <TableCell>{p.units}</TableCell>
                    <TableCell className="capitalize">{p.unit_type}</TableCell>
                    <TableCell className="text-right font-medium">₦{Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Record"} External Lab Payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>External Lab *</Label>
              <Select value={formLabId} onValueChange={setFormLabId}>
                <SelectTrigger><SelectValue placeholder="Select lab" /></SelectTrigger>
                <SelectContent>
                  {labs.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  required
                  max={new Date().toISOString().split("T")[0]}
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount (₦) *</Label>
                <Input type="number" min={0} value={formAmount} onChange={e => setFormAmount(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Units</Label>
                <Input type="number" min={1} value={formUnits} onChange={e => setFormUnits(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Unit Type</Label>
                <Select value={formUnitType} onValueChange={setFormUnitType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Optional reference notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createPayment.isPending || updatePayment.isPending}>
              {(createPayment.isPending || updatePayment.isPending) ? "Saving..." : editingId ? "Save Changes" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) {
                  await deletePayment.mutateAsync(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
