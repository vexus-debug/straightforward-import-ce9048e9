import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Building2, ListChecks } from "lucide-react";
import {
  useClinicExternalLabs,
  useUpsertClinicExternalLab,
  useDeleteClinicExternalLab,
  useClinicLabWorkTypes,
  useUpsertClinicLabWorkType,
  useDeleteClinicLabWorkType,
  type ClinicExternalLab,
  type ClinicLabWorkType,
} from "@/hooks/useClinicExternalLabs";
import { LabOutsourceSummary } from "@/components/dashboard/LabOutsourceSummary";
import { toast } from "@/hooks/use-toast";

const fmt = (v: number) => `₦${Number(v || 0).toLocaleString()}`;

export default function ClinicExternalLabsPage() {
  const { data: labs = [], isLoading } = useClinicExternalLabs();
  const upsertLab = useUpsertClinicExternalLab();
  const deleteLab = useDeleteClinicExternalLab();

  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<ClinicExternalLab | null>(null);

  // Lab form
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");

  // Work types panel
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const { data: workTypes = [] } = useClinicLabWorkTypes(activeLabId);
  const upsertWT = useUpsertClinicLabWorkType();
  const deleteWT = useDeleteClinicLabWorkType();

  const [wtDialogOpen, setWtDialogOpen] = useState(false);
  const [editingWT, setEditingWT] = useState<ClinicLabWorkType | null>(null);
  const [wtName, setWtName] = useState("");
  const [wtPrice, setWtPrice] = useState<number>(0);
  const [wtNotes, setWtNotes] = useState("");

  const resetLabForm = () => {
    setEditingLab(null);
    setName(""); setContactPerson(""); setPhone(""); setEmail("");
    setAddress(""); setSpecialties(""); setStatus("active"); setNotes("");
  };

  const openCreateLab = () => { resetLabForm(); setLabDialogOpen(true); };
  const openEditLab = (lab: ClinicExternalLab) => {
    setEditingLab(lab);
    setName(lab.name);
    setContactPerson(lab.contact_person || "");
    setPhone(lab.phone || "");
    setEmail(lab.email || "");
    setAddress(lab.address || "");
    setSpecialties((lab.specialties || []).join(", "));
    setStatus(lab.status);
    setNotes(lab.notes || "");
    setLabDialogOpen(true);
  };

  const handleSaveLab = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    // Read directly from the form so browser autofill values (which don't fire onChange) are captured
    const form = e?.currentTarget;
    const fd = form ? new FormData(form) : null;
    const v = (k: string, fallback: string) =>
      (fd?.get(k)?.toString() ?? fallback).trim();

    const nameVal = v("name", name);
    if (!nameVal) {
      toast({ title: "Lab name required", description: "Please enter a lab name.", variant: "destructive" });
      return;
    }

    try {
      await upsertLab.mutateAsync({
        id: editingLab?.id,
        name: nameVal,
        contact_person: v("contact_person", contactPerson) || null,
        phone: v("phone", phone) || null,
        email: v("email", email) || null,
        address: v("address", address) || null,
        specialties: v("specialties", specialties).split(",").map(s => s.trim()).filter(Boolean),
        status: v("status", status) || "active",
        notes: v("notes", notes) || null,
      } as any);
      setLabDialogOpen(false);
      resetLabForm();
    } catch (err) {
      console.error("[ClinicExternalLabs] Save failed:", err);
    }
  };

  const handleDeleteLab = async (id: string) => {
    if (!confirm("Delete this external lab? Its work-type catalogue will also be removed.")) return;
    await deleteLab.mutateAsync(id);
    if (activeLabId === id) setActiveLabId(null);
  };

  const resetWTForm = () => {
    setEditingWT(null);
    setWtName(""); setWtPrice(0); setWtNotes("");
  };
  const openAddWT = () => { resetWTForm(); setWtDialogOpen(true); };
  const openEditWT = (wt: ClinicLabWorkType) => {
    setEditingWT(wt);
    setWtName(wt.name);
    setWtPrice(Number(wt.price) || 0);
    setWtNotes(wt.notes || "");
    setWtDialogOpen(true);
  };
  const handleSaveWT = async () => {
    if (!activeLabId || !wtName.trim()) return;
    await upsertWT.mutateAsync({
      id: editingWT?.id,
      external_lab_id: activeLabId,
      name: wtName.trim(),
      price: Number(wtPrice) || 0,
      notes: wtNotes || null,
    } as any);
    setWtDialogOpen(false);
    resetWTForm();
  };

  const activeLab = labs.find(l => l.id === activeLabId) || null;

  return (
    <div className="space-y-6">
      <PageHeader title="External Labs" description="Register partner labs and their work-type catalogue & prices">
        <Button onClick={openCreateLab} className="gap-2"><Plus className="h-4 w-4" /> Add Lab</Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partner Labs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : labs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No external labs added yet. Click "Add Lab" to register one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Specialties</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labs.map((lab) => (
                  <TableRow
                    key={lab.id}
                    className={`cursor-pointer ${activeLabId === lab.id ? "bg-muted/50" : ""}`}
                    onClick={() => setActiveLabId(lab.id)}
                  >
                    <TableCell className="font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {lab.name}
                    </TableCell>
                    <TableCell>{lab.contact_person || "—"}</TableCell>
                    <TableCell>{lab.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(lab.specialties || []).slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lab.status === "active" ? "default" : "secondary"}>{lab.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditLab(lab); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteLab(lab.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LabOutsourceSummary />

      {/* Work-type catalogue for selected lab */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Work Type Catalogue {activeLab && <span className="text-muted-foreground font-normal">— {activeLab.name}</span>}
          </CardTitle>
          {activeLab && (
            <Button size="sm" onClick={openAddWT}><Plus className="h-4 w-4 mr-1" /> Add Work Type</Button>
          )}
        </CardHeader>
        <CardContent>
          {!activeLab ? (
            <p className="text-sm text-muted-foreground">Select a lab above to manage its work-type catalogue and prices.</p>
          ) : workTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work types yet. Click "Add Work Type" to define one with its price.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Type</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workTypes.map((wt) => (
                  <TableRow key={wt.id}>
                    <TableCell className="font-medium">{wt.name}</TableCell>
                    <TableCell className="text-right">{fmt(Number(wt.price))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{wt.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEditWT(wt)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this work type?")) deleteWT.mutate(wt.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Lab Dialog */}
      <Dialog open={labDialogOpen} onOpenChange={setLabDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLab ? "Edit External Lab" : "Add External Lab"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLab}>
            <div className="grid gap-4 py-2">
              <div className="space-y-2"><Label>Lab Name *</Label><Input name="name" value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Contact Person</Label><Input name="contact_person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input name="phone" value={phone} onChange={e => setPhone(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Address</Label><Input name="address" value={address} onChange={e => setAddress(e.target.value)} /></div>
              <div className="space-y-2"><Label>Specialties (comma-separated)</Label><Input name="specialties" value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="Zirconia, Implants, Dentures" /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <input type="hidden" name="status" value={status} />
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea name="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLabDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={upsertLab.isPending}>{editingLab ? "Save Changes" : "Add Lab"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Work Type Dialog */}
      <Dialog open={wtDialogOpen} onOpenChange={setWtDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWT ? "Edit Work Type" : "Add Work Type"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Name *</Label><Input value={wtName} onChange={e => setWtName(e.target.value)} placeholder="e.g. Zirconia Crown" /></div>
            <div className="space-y-2"><Label>Price (₦) *</Label><Input type="number" step="0.01" value={wtPrice} onChange={e => setWtPrice(Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={wtNotes} onChange={e => setWtNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWtDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWT} disabled={upsertWT.isPending}>{editingWT ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
