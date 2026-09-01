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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Building2, Send, ArrowLeftRight, Package, BarChart3 } from "lucide-react";
import { LdOutsourceSummary } from "@/components/lab-dashboard/LdOutsourceSummary";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLdExternalLabs, useAddLdExternalLab, useUpdateLdExternalLab, useDeleteLdExternalLab, useLdOutsourcedCases, useAddLdOutsourcedCase, useUpdateLdOutsourcedCase } from "@/hooks/useLdExtendedFeatures";
import { useLdExternalLabPrices, useUpsertLdExternalLabPrice, useDeleteLdExternalLabPrice, type LdExternalLabPrice } from "@/hooks/useLdExternalLabPrices";
import { useLdCases } from "@/hooks/useLabDashboard";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ListChecks } from "lucide-react";

const statusColors: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  "in-progress": "bg-amber-100 text-amber-800",
  returned: "bg-emerald-100 text-emerald-800",
  issue: "bg-destructive/20 text-destructive",
};

export default function LdExternalLabsPage() {
  const { data: labs = [], isLoading } = useLdExternalLabs();
  const { data: outsourcedCases = [] } = useLdOutsourcedCases();
  const { data: cases = [] } = useLdCases();
  const addLab = useAddLdExternalLab();
  const updateLab = useUpdateLdExternalLab();
  const deleteLab = useDeleteLdExternalLab();
  const addOutsourced = useAddLdOutsourcedCase();
  const updateOutsourced = useUpdateLdOutsourcedCase();

  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [outsourceDialogOpen, setOutsourceDialogOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<any>(null);

  // Lab form
  const [formName, setFormName] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formSpecialties, setFormSpecialties] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formNotes, setFormNotes] = useState("");

  // Outsource form
  const [outCaseId, setOutCaseId] = useState("");
  const [outLabId, setOutLabId] = useState("");
  const [outExpectedReturn, setOutExpectedReturn] = useState("");
  const [outCost, setOutCost] = useState(0);
  const [outUnitPriceOverride, setOutUnitPriceOverride] = useState<string>("");
  const [outExpressCharge, setOutExpressCharge] = useState<string>("");
  const [outLabDiscount, setOutLabDiscount] = useState<string>("");
  const [outNotes, setOutNotes] = useState("");

  // Price list panel
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const selectedLab = labs.find(l => l.id === selectedLabId) || null;
  const { data: labPrices = [] } = useLdExternalLabPrices(selectedLabId);
  const upsertPrice = useUpsertLdExternalLabPrice();
  const deletePrice = useDeleteLdExternalLabPrice();
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<LdExternalLabPrice | null>(null);
  const [priceWtName, setPriceWtName] = useState("");
  const [priceAmount, setPriceAmount] = useState<number>(0);
  const [priceNotes, setPriceNotes] = useState("");

  const resetPriceForm = () => {
    setEditingPrice(null);
    setPriceWtName("");
    setPriceAmount(0);
    setPriceNotes("");
  };
  const openAddPrice = () => { resetPriceForm(); setPriceDialogOpen(true); };
  const openEditPrice = (p: LdExternalLabPrice) => {
    setEditingPrice(p);
    setPriceWtName(p.work_type_name);
    setPriceAmount(Number(p.price) || 0);
    setPriceNotes(p.notes || "");
    setPriceDialogOpen(true);
  };
  const handleSavePrice = async () => {
    if (!selectedLabId || !priceWtName.trim()) { toast.error("Work type is required"); return; }
    try {
      await upsertPrice.mutateAsync({
        id: editingPrice?.id,
        external_lab_id: selectedLabId,
        work_type_name: priceWtName.trim(),
        price: Number(priceAmount) || 0,
        notes: priceNotes || null,
      });
      toast.success(editingPrice ? "Price updated" : "Price added");
      setPriceDialogOpen(false);
      resetPriceForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetLabForm = () => {
    setFormName("");
    setFormContactPerson("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormSpecialties("");
    setFormStatus("active");
    setFormNotes("");
    setEditingLab(null);
  };

  const openCreateLabDialog = () => {
    resetLabForm();
    setLabDialogOpen(true);
  };

  const openEditLabDialog = (lab: any) => {
    setEditingLab(lab);
    setFormName(lab.name);
    setFormContactPerson(lab.contact_person || "");
    setFormPhone(lab.phone || "");
    setFormEmail(lab.email || "");
    setFormAddress(lab.address || "");
    setFormSpecialties((lab.specialties || []).join(", "));
    setFormStatus(lab.status);
    setFormNotes(lab.notes || "");
    setLabDialogOpen(true);
  };

  const handleSaveLab = async () => {
    if (!formName) {
      toast.error("Lab name is required");
      return;
    }
    const payload = {
      name: formName,
      contact_person: formContactPerson,
      phone: formPhone,
      email: formEmail,
      address: formAddress,
      specialties: formSpecialties.split(",").map(s => s.trim()).filter(Boolean),
      status: formStatus,
      notes: formNotes,
    };
    try {
      if (editingLab) {
        await updateLab.mutateAsync({ id: editingLab.id, ...payload });
        toast.success("Lab updated");
      } else {
        await addLab.mutateAsync(payload as any);
        toast.success("Lab added");
      }
      setLabDialogOpen(false);
      resetLabForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteLab = async (id: string) => {
    if (!confirm("Delete this external lab?")) return;
    try {
      await deleteLab.mutateAsync(id);
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openOutsourceDialog = () => {
    setOutCaseId("");
    setOutLabId("");
    setOutExpectedReturn("");
    setOutCost(0);
    setOutUnitPriceOverride("");
    setOutExpressCharge("");
    setOutLabDiscount("");
    setOutNotes("");
    setOutsourceDialogOpen(true);
  };

  const handleOutsourceCase = async () => {
    if (!outCaseId || !outLabId) {
      toast.error("Case and external lab are required");
      return;
    }
    try {
      await addOutsourced.mutateAsync({
        case_id: outCaseId,
        external_lab_id: outLabId,
        expected_return_date: outExpectedReturn || null,
        cost: outCost,
        notes: outNotes,
        status: "sent",
      } as any);

      // Snapshot the periodic price from the lab's price list into the case
      // so historical accounting stays accurate even if the price list changes later.
      const caseUpdate: any = {
        external_lab_id: outLabId,
        external_lab_express_charge: outExpressCharge.trim() === "" ? 0 : Number(outExpressCharge) || 0,
        external_lab_discount: outLabDiscount.trim() === "" ? 0 : Number(outLabDiscount) || 0,
      };
      if (outUnitPriceOverride.trim() !== "") {
        caseUpdate.external_lab_unit_price = Number(outUnitPriceOverride) || 0;
      } else {
        // Look up the case work type and fetch the lab's current price for it
        const theCase = cases.find((c: any) => c.id === outCaseId);
        const wt = (theCase?.work_type_name || "").trim();
        if (wt) {
          const { data: priceRows } = await supabase
            .from("ld_external_lab_prices" as any)
            .select("work_type_name, price")
            .eq("external_lab_id", outLabId);
          const norm = (s: string) => (s || "").toLowerCase().trim().replace(/s$/, "");
          const match = (priceRows || []).find((p: any) =>
            (p.work_type_name || "").toLowerCase().trim() === wt.toLowerCase()
              || norm(p.work_type_name) === norm(wt)
          );
          if (match) caseUpdate.external_lab_unit_price = Number((match as any).price) || 0;
        }
      }
      const { error: caseErr } = await supabase
        .from("ld_cases")
        .update(caseUpdate)
        .eq("id", outCaseId);
      if (caseErr) throw caseErr;
      toast.success("Case outsourced");
      setOutsourceDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const markReturned = async (id: string) => {
    try {
      await updateOutsourced.mutateAsync({
        id,
        actual_return_date: format(new Date(), "yyyy-MM-dd"),
        status: "returned",
      });
      toast.success("Marked as returned");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getLabName = (id: string | null) => labs.find(l => l.id === id)?.name || "Unknown";
  const getCaseNumber = (id: string | null) => cases.find(c => c.id === id)?.case_number || "Unknown";

  const pendingCases = cases.filter(c => c.status === "pending" || c.status === "in-progress");

  return (
    <div className="space-y-6">
      <PageHeader
        title="External Labs"
        description="Manage partner labs and outsourced cases"
      >
        <Button onClick={openOutsourceDialog} variant="outline" className="gap-2">
          <Send className="h-4 w-4" /> Outsource Case
        </Button>
        <Button onClick={openCreateLabDialog} className="gap-2">
          <Plus className="h-4 w-4" /> Add Lab
        </Button>
      </PageHeader>

      <Tabs defaultValue="labs">
        <TabsList>
          <TabsTrigger value="labs" className="gap-2"><Building2 className="h-4 w-4" /> Partner Labs</TabsTrigger>
          <TabsTrigger value="outsourced" className="gap-2"><ArrowLeftRight className="h-4 w-4" /> Outsourced Cases</TabsTrigger>
          <TabsTrigger value="summary" className="gap-2"><BarChart3 className="h-4 w-4" /> Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <LdOutsourceSummary />
        </TabsContent>

        <TabsContent value="labs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>External Partner Labs</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : labs.length === 0 ? (
                <p className="text-muted-foreground">No external labs added yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lab Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Specialties</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labs.map((lab, idx) => (
                      <motion.tr
                        key={lab.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => setSelectedLabId(lab.id)}
                        className={`border-b cursor-pointer ${selectedLabId === lab.id ? "bg-muted/50" : ""}`}
                      >
                        <TableCell className="font-medium">{lab.name}</TableCell>
                        <TableCell>{lab.contact_person || "-"}</TableCell>
                        <TableCell>{lab.phone || "-"}</TableCell>
                        <TableCell>{lab.email || "-"}</TableCell>
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
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditLabDialog(lab); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteLab(lab.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Per-lab price list — payable-to-lab pricing, independent of clinic billing */}
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                Lab Price List {selectedLab && <span className="text-muted-foreground font-normal">— {selectedLab.name}</span>}
              </CardTitle>
              {selectedLab && (
                <Button size="sm" onClick={openAddPrice}>
                  <Plus className="h-4 w-4 mr-1" /> Add Price
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!selectedLab ? (
                <p className="text-sm text-muted-foreground">Select a lab above to configure the prices it charges you per work type.</p>
              ) : labPrices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prices set. Add work types with the amount this lab charges you (e.g. Zirconia Crown → ₦30,000).</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Work Type</TableHead>
                      <TableHead className="text-right">Lab Charges</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labPrices.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.work_type_name}</TableCell>
                        <TableCell className="text-right">₦{Number(p.price || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => openEditPrice(p)}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this price?")) deletePrice.mutate(p.id); }}>
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
        </TabsContent>

        <TabsContent value="outsourced" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Outsourced Cases ({outsourcedCases.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {outsourcedCases.length === 0 ? (
                <p className="text-muted-foreground">No outsourced cases yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case #</TableHead>
                      <TableHead>External Lab</TableHead>
                      <TableHead>Sent Date</TableHead>
                      <TableHead>Expected Return</TableHead>
                      <TableHead>Actual Return</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outsourcedCases.map((oc, idx) => (
                      <motion.tr
                        key={oc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border-b"
                      >
                        <TableCell className="font-medium">{getCaseNumber(oc.case_id)}</TableCell>
                        <TableCell>{getLabName(oc.external_lab_id)}</TableCell>
                        <TableCell>{oc.sent_date ? format(new Date(oc.sent_date), "MMM dd, yyyy") : "-"}</TableCell>
                        <TableCell>{oc.expected_return_date ? format(new Date(oc.expected_return_date), "MMM dd, yyyy") : "-"}</TableCell>
                        <TableCell>{oc.actual_return_date ? format(new Date(oc.actual_return_date), "MMM dd, yyyy") : "-"}</TableCell>
                        <TableCell>${oc.cost.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[oc.status] || "bg-muted"}>{oc.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {oc.status !== "returned" && (
                            <Button size="sm" variant="outline" onClick={() => markReturned(oc.id)}>
                              Mark Returned
                            </Button>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Lab Dialog */}
      <Dialog open={labDialogOpen} onOpenChange={setLabDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLab ? "Edit External Lab" : "Add External Lab"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Lab Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Partner Lab Name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={formContactPerson} onChange={e => setFormContactPerson(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Specialties (comma-separated)</Label>
              <Input value={formSpecialties} onChange={e => setFormSpecialties(e.target.value)} placeholder="Zirconia, Implants, Dentures" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLab} disabled={addLab.isPending || updateLab.isPending}>
              {editingLab ? "Save Changes" : "Add Lab"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outsource Case Dialog */}
      <Dialog open={outsourceDialogOpen} onOpenChange={setOutsourceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Outsource Case to External Lab</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Select Case *</Label>
              <Select value={outCaseId} onValueChange={setOutCaseId}>
                <SelectTrigger><SelectValue placeholder="Choose case" /></SelectTrigger>
                <SelectContent>
                  {pendingCases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.case_number} - {c.patient_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>External Lab *</Label>
              <Select value={outLabId} onValueChange={setOutLabId}>
                <SelectTrigger><SelectValue placeholder="Choose lab" /></SelectTrigger>
                <SelectContent>
                  {labs.filter(l => l.status === "active").map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Return</Label>
                <Input type="date" value={outExpectedReturn} onChange={e => setOutExpectedReturn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cost ($)</Label>
                <Input type="number" value={outCost} onChange={e => setOutCost(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit price payable to lab (override)</Label>
              <Input
                type="number"
                placeholder="Leave blank to snapshot from lab's price list"
                value={outUnitPriceOverride}
                onChange={e => setOutUnitPriceOverride(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Snapshot saved to this case. Won't change if the lab's price list is edited later.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Express / Additional Charge (₦)</Label>
                <Input
                  type="number"
                  placeholder="e.g. rush fee"
                  value={outExpressCharge}
                  onChange={e => setOutExpressCharge(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>External Lab Discount (₦)</Label>
                <Input
                  type="number"
                  placeholder="e.g. loyalty"
                  value={outLabDiscount}
                  onChange={e => setOutLabDiscount(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-2">Lab cost = (Unit price × units) + Express − Discount. Clinic billing is unaffected.</p>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={outNotes} onChange={e => setOutNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutsourceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleOutsourceCase} disabled={addOutsourced.isPending}>
              Send to Lab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lab Price Dialog */}
      <Dialog open={priceDialogOpen} onOpenChange={(o) => { setPriceDialogOpen(o); if (!o) resetPriceForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPrice ? "Edit" : "Add"} Lab Price {selectedLab && `— ${selectedLab.name}`}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Work Type *</Label>
              <Select value={priceWtName} onValueChange={setPriceWtName}>
                <SelectTrigger><SelectValue placeholder="Choose a work type used in cases" /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(cases.map((c: any) => (c.work_type_name || "").trim()).filter(Boolean)))
                    .sort()
                    .map((wt) => (
                      <SelectItem key={wt} value={wt}>{wt}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Must match the work type name on cases so pricing links up automatically.</p>
            </div>
            <div className="space-y-2">
              <Label>Amount lab charges you (₦) *</Label>
              <Input type="number" value={priceAmount} onChange={e => setPriceAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={priceNotes} onChange={e => setPriceNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePrice} disabled={upsertPrice.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
