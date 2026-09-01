import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

import { usePatients } from "@/hooks/usePatients";
import { useDentists } from "@/hooks/useStaff";
import { useTreatments } from "@/hooks/useTreatments";
import { useCreateLabOrder } from "@/hooks/useLabOrders";
import { useClinicExternalLabs, useClinicLabWorkTypes } from "@/hooks/useClinicExternalLabs";
import { supabase } from "@/integrations/supabase/client";

interface CreateLabOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrderItem {
  work_type_id: string;        // catalogue id (or "" for custom)
  work_type_name: string;
  units: number;
  unit_price: number;
}

const fmt = (v: number) => `₦${Number(v || 0).toLocaleString()}`;

export function CreateLabOrderDialog({ open, onOpenChange }: CreateLabOrderDialogProps) {
  const { data: patients = [] } = usePatients();
  const { data: dentists = [] } = useDentists();
  const { data: treatments = [] } = useTreatments();
  const { data: externalLabs = [] } = useClinicExternalLabs();
  const createLabOrder = useCreateLabOrder();

  const [patientId, setPatientId] = useState("");
  const [treatmentId, setTreatmentId] = useState("");
  const [dentistId, setDentistId] = useState("");
  const [externalLabId, setExternalLabId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);

  // Load catalogue when external lab selected
  const { data: catalogue = [] } = useClinicLabWorkTypes(externalLabId || null);

  // Reset items when lab changes
  useEffect(() => {
    setItems([]);
  }, [externalLabId]);

  const reset = () => {
    setPatientId(""); setTreatmentId(""); setDentistId("");
    setExternalLabId(""); setDueDate(undefined); setNotes(""); setItems([]);
  };

  const addItem = () => {
    if (!externalLabId) {
      toast({ title: "Select an external lab first", variant: "destructive" });
      return;
    }
    setItems([...items, { work_type_id: "", work_type_name: "", units: 1, unit_price: 0 }]);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, patch: Partial<OrderItem>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleSelectCatalogue = (idx: number, workTypeId: string) => {
    const wt = catalogue.find(c => c.id === workTypeId);
    if (!wt) return;
    updateItem(idx, {
      work_type_id: wt.id,
      work_type_name: wt.name,
      unit_price: Number(wt.price) || 0,
    });
  };

  const lineTotal = (it: OrderItem) => (Number(it.units) || 0) * (Number(it.unit_price) || 0);
  const grandTotal = items.reduce((s, it) => s + lineTotal(it), 0);

  const selectedLab = externalLabs.find(l => l.id === externalLabId);

  const handleSubmit = async () => {
    if (!patientId || !treatmentId || !dentistId || !externalLabId || !dueDate) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    if (items.length === 0 || items.some(it => !it.work_type_name.trim())) {
      toast({ title: "Add at least one work type", variant: "destructive" });
      return;
    }

    // Build a summary work-type for the legacy single-string column
    const summaryType = items.length === 1
      ? items[0].work_type_name
      : `${items[0].work_type_name} (+${items.length - 1} more)`;

    createLabOrder.mutate(
      {
        patient_id: patientId,
        treatment_id: treatmentId,
        dentist_id: dentistId,
        lab_work_type: summaryType,
        lab_name: selectedLab?.name || "",
        external_lab_id: externalLabId,
        due_date: format(dueDate, "yyyy-MM-dd"),
        notes,
      } as any,
      {
        onSuccess: async (data: any) => {
          // Insert line items
          if (data?.id) {
            const rows = items.map(it => ({
              lab_order_id: data.id,
              work_type_id: it.work_type_id || null,
              work_type_name: it.work_type_name,
              units: Number(it.units) || 1,
              unit_price: Number(it.unit_price) || 0,
              total_price: lineTotal(it),
            }));
            const { error } = await supabase.from("lab_order_items").insert(rows as any);
            if (error) toast({ title: "Items error", description: error.message, variant: "destructive" });
          }
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Lab Order</DialogTitle>
          <DialogDescription>Submit a dental lab work order with one or more work types.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient + Treatment */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Patient *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Related Treatment *</Label>
              <Select value={treatmentId} onValueChange={setTreatmentId}>
                <SelectTrigger><SelectValue placeholder="Select treatment" /></SelectTrigger>
                <SelectContent>
                  {treatments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* External Lab */}
          <div className="space-y-1.5">
            <Label>External Lab *</Label>
            <Select value={externalLabId} onValueChange={setExternalLabId}>
              <SelectTrigger><SelectValue placeholder="Select external lab" /></SelectTrigger>
              <SelectContent>
                {externalLabs.filter(l => l.status === "active").map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {externalLabs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No labs registered yet. Add them on the <span className="font-medium">External Labs</span> page.
              </p>
            )}
          </div>

          {/* Work Type line items */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Work Types *</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Add Work Type
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                {externalLabId ? "Click \"Add Work Type\" to add one or more items." : "Select an external lab first."}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-md bg-background">
                    <div className="col-span-5 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Work Type</Label>
                      {catalogue.length > 0 ? (
                        <Select
                          value={it.work_type_id}
                          onValueChange={(v) => handleSelectCatalogue(idx, v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Select from catalogue" /></SelectTrigger>
                          <SelectContent>
                            {catalogue.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name} — {fmt(Number(c.price))}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          placeholder="Work type name"
                          value={it.work_type_name}
                          onChange={(e) => updateItem(idx, { work_type_name: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Units</Label>
                      <Input type="number" min={1} value={it.units} onChange={(e) => updateItem(idx, { units: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Unit Price (₦)</Label>
                      <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-1 text-right text-xs font-medium pb-2">{fmt(lineTotal(it))}</div>
                    <div className="col-span-1 flex justify-end pb-1">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(idx)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-right text-sm font-semibold">Total: {fmt(grandTotal)}</p>
              </div>
            )}
          </div>

          {/* Dentist + Due Date */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Dentist *</Label>
              <Select value={dentistId} onValueChange={setDentistId}>
                <SelectTrigger><SelectValue placeholder="Select dentist" /></SelectTrigger>
                <SelectContent>
                  {dentists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex flex-col">
              <Label>Due Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !dueDate && "text-muted-foreground")}>
                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Special Instructions</Label>
            <Textarea placeholder="Shade, material preferences, special notes..." rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-secondary hover:bg-secondary/90" disabled={createLabOrder.isPending}>
            {createLabOrder.isPending ? "Creating..." : "Create Lab Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
