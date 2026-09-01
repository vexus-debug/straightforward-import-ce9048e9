import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, CalendarIcon } from "lucide-react";
import { useCreateClinicalNote } from "@/hooks/useClinicalNotes";
import { useStaff } from "@/hooks/useStaff";
import { toast } from "@/hooks/use-toast";

interface ComplaintsTabProps {
  patientId: string;
  clinicalNotes: any[];
  canEdit: boolean;
  userId?: string;
}

// Encoded into the existing `objective` text field as JSON metadata, so no
// schema migration is required to store the attending dentist & assistant.
type ComplaintMeta = {
  date?: string;
  dentist?: string;
  assistant?: string;
};

const META_PREFIX = "complaint_meta:";
const LEGACY_PREFIX = "complaint_date:";

const parseMeta = (objective?: string | null): ComplaintMeta => {
  if (!objective) return {};
  if (objective.startsWith(META_PREFIX)) {
    try {
      return JSON.parse(objective.slice(META_PREFIX.length)) as ComplaintMeta;
    } catch {
      return {};
    }
  }
  if (objective.startsWith(LEGACY_PREFIX)) {
    return { date: objective.slice(LEGACY_PREFIX.length) };
  }
  return {};
};

export function ComplaintsTab({ patientId, clinicalNotes, canEdit, userId }: ComplaintsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [complaintDate, setComplaintDate] = useState<Date>(new Date());
  const [dentistId, setDentistId] = useState<string>("");
  const [assistantId, setAssistantId] = useState<string>("");
  const createNote = useCreateClinicalNote();
  const { data: staff = [] } = useStaff();

  const dentists = staff.filter((s: any) =>
    ["dentist", "associate_dentist"].includes(s.role) && s.status === "active"
  );
  const assistants = staff.filter((s: any) =>
    ["assistant", "hygienist"].includes(s.role) && s.status === "active"
  );

  const staffNameById = (id: string) => staff.find((s: any) => s.id === id)?.full_name ?? "";

  const complaints = clinicalNotes.filter((n: any) => n.subjective);

  const resetForm = () => {
    setComplaint("");
    setComplaintDate(new Date());
    setDentistId("");
    setAssistantId("");
  };

  const handleSave = () => {
    if (!complaint.trim() || !dentistId || !assistantId) {
      toast({
        title: "Missing information",
        description: "Attending dentist and dental assistant are required.",
        variant: "destructive",
      });
      return;
    }

    const meta: ComplaintMeta = {
      date: format(complaintDate, "yyyy-MM-dd"),
      dentist: staffNameById(dentistId),
      assistant: staffNameById(assistantId),
    };

    createNote.mutate(
      {
        patient_id: patientId,
        subjective: complaint,
        created_by: userId,
        objective: `${META_PREFIX}${JSON.stringify(meta)}`,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          resetForm();
        },
      }
    );
  };

  const formIncomplete = !complaint.trim() || !dentistId || !assistantId;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Patient Complaints</h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add Complaint
          </Button>
        )}
      </div>

      {complaints.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No complaints recorded.</CardContent></Card>
      ) : (
        complaints.map((note: any) => {
          const meta = parseMeta(note.objective);
          const dateLabel = meta.date ?? new Date(note.created_at).toLocaleDateString();
          return (
            <Card key={note.id}>
              <CardContent className="py-4 space-y-2">
                <p className="text-xs text-muted-foreground">{dateLabel}</p>
                <p className="text-sm">{note.subjective}</p>
                {(meta.dentist || meta.assistant) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground border-t">
                    {meta.dentist && <span>Dentist: <span className="text-foreground">{meta.dentist}</span></span>}
                    {meta.assistant && <span>Assistant: <span className="text-foreground">{meta.assistant}</span></span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Patient Complaint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Date of Complaint *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !complaintDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {complaintDate ? format(complaintDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={complaintDate}
                    onSelect={(d) => d && setComplaintDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Attending Dentist *</Label>
              <Select value={dentistId} onValueChange={setDentistId}>
                <SelectTrigger><SelectValue placeholder="Select dentist / associate dentist" /></SelectTrigger>
                <SelectContent>
                  {dentists.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No active dentists</div>
                  ) : (
                    dentists.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name} {s.role === "associate_dentist" ? "(Associate)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Dental Assistant *</Label>
              <Select value={assistantId} onValueChange={setAssistantId}>
                <SelectTrigger><SelectValue placeholder="Select dental assistant" /></SelectTrigger>
                <SelectContent>
                  {assistants.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No active assistants</div>
                  ) : (
                    assistants.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Complaint / Chief Concern *</Label>
              <Textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={4} placeholder="Describe the patient's complaint..." />
            </div>
            <p className="text-[11px] text-muted-foreground">
              All fields are required. The complaint cannot be saved without naming the attending dentist and assistant.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-secondary hover:bg-secondary/90" disabled={createNote.isPending || formIncomplete} onClick={handleSave}>
              {createNote.isPending ? "Saving..." : "Save Complaint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
