import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateStaff } from "@/hooks/useStaff";

const inHouseRoles = ["dentist", "associate_dentist", "assistant", "hygienist", "receptionist", "accountant", "lab_technician"];

interface AddStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStaffDialog({ open, onOpenChange }: AddStaffDialogProps) {
  const createStaff = useCreateStaff();
  const [form, setForm] = useState({
    full_name: "",
    role: "dentist",
    phone: "",
    email: "",
    specialty: "",
    staff_type: "in_house" as "in_house" | "associate",
    compensation_type: "" as "" | "revenue_split" | "flat_fee",
    compensation_percentage: "" as string,
    compensation_flat_amount: "" as string,
    compensation_strategy: "" as "" | "materials_excluded" | "materials_included",
  });

  const handleSubmit = async () => {
    if (!form.full_name.trim()) return;
    const payload: any = {
      full_name: form.full_name,
      role: form.role,
      phone: form.phone,
      email: form.email,
      specialty: form.specialty,
      staff_type: form.staff_type,
    };
    if (form.staff_type === "associate" && form.compensation_type) {
      payload.compensation_type = form.compensation_type;
      if (form.compensation_type === "revenue_split" && form.compensation_percentage) {
        payload.compensation_percentage = parseFloat(form.compensation_percentage);
      }
      if (form.compensation_type === "flat_fee" && form.compensation_flat_amount) {
        payload.compensation_flat_amount = parseFloat(form.compensation_flat_amount);
      }
    }
    if (form.role === "associate_dentist" && form.compensation_strategy) {
      payload.compensation_strategy = form.compensation_strategy;
    }
    await createStaff.mutateAsync(payload);
    onOpenChange(false);
    setForm({ full_name: "", role: "dentist", phone: "", email: "", specialty: "", staff_type: "in_house", compensation_type: "", compensation_percentage: "", compensation_flat_amount: "", compensation_strategy: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Full Name *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Staff Type</Label>
            <Select value={form.staff_type} onValueChange={(v) => setForm({ ...form, staff_type: v as "in_house" | "associate" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_house">In-house</SelectItem>
                <SelectItem value="associate">Associate Dentist</SelectItem>
              </SelectContent>
            </Select>
            {form.staff_type === "associate" && (
              <p className="text-[11px] text-muted-foreground mt-1">External dentist using clinic facilities. Sees only their own patients.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {inHouseRoles.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Specialty</Label>
              <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          {form.staff_type === "associate" && (
            <div className="rounded-lg border p-3 space-y-3">
              <Label className="text-xs font-semibold">Compensation</Label>
              <Select value={form.compensation_type} onValueChange={(v) => setForm({ ...form, compensation_type: v as "revenue_split" | "flat_fee" })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue_split">Revenue Split (%)</SelectItem>
                  <SelectItem value="flat_fee">Flat Chair-Rental (monthly)</SelectItem>
                </SelectContent>
              </Select>
              {form.compensation_type === "revenue_split" && (
                <div className="space-y-1">
                  <Label className="text-xs">Associate's % of revenue</Label>
                  <Input type="number" min="0" max="100" placeholder="e.g. 60" value={form.compensation_percentage} onChange={(e) => setForm({ ...form, compensation_percentage: e.target.value })} />
                </div>
              )}
              {form.compensation_type === "flat_fee" && (
                <div className="space-y-1">
                  <Label className="text-xs">Monthly chair-rental amount</Label>
                  <Input type="number" min="0" placeholder="e.g. 200000" value={form.compensation_flat_amount} onChange={(e) => setForm({ ...form, compensation_flat_amount: e.target.value })} />
                </div>
              )}
            </div>
          )}
          {form.role === "associate_dentist" && (
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs font-semibold">Revenue Split Strategy (optional)</Label>
              <p className="text-[11px] text-muted-foreground">
                Sets the % of each invoice this associate earns from their own patients.
              </p>
              <Select
                value={form.compensation_strategy || "none"}
                onValueChange={(v) => setForm({ ...form, compensation_strategy: v === "none" ? "" : v as "materials_excluded" | "materials_included" })}
              >
                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="materials_excluded">30% — Uses our machines only (no materials)</SelectItem>
                  <SelectItem value="materials_included">70% — Uses our machines AND materials</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-secondary hover:bg-secondary/90" disabled={createStaff.isPending}>
            {createStaff.isPending ? "Adding..." : "Add Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
