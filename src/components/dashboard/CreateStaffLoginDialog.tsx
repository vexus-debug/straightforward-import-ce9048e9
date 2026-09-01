import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { StaffMember } from "@/hooks/useStaff";
import { Eye, EyeOff, KeyRound } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "dentist", label: "Dentist" },
  { value: "associate_dentist", label: "Associate Dentist" },
  { value: "assistant", label: "Assistant" },
  { value: "hygienist", label: "Hygienist" },
  { value: "receptionist", label: "Receptionist" },
  { value: "accountant", label: "Accountant" },
  { value: "lab_technician", label: "Lab Technician" },
];

interface Props {
  staff: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStaffLoginDialog({ staff, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("dentist");
  const [show, setShow] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (staff) {
      setEmail(staff.email || "");
      setFullName(staff.full_name || "");
      const s: any = staff;
      const mappedRole = s.staff_type === "associate" ? "associate_dentist" : (staff.role || "dentist");
      setRole(ROLE_OPTIONS.find((r) => r.value === mappedRole) ? mappedRole : "dentist");
      setPassword("");
    }
  }, [staff]);

  const handleSubmit = async () => {
    if (!email || !password || !fullName) {
      toast({ title: "Missing fields", description: "Email, password and name are required.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Weak password", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-staff-account", {
        body: {
          action: "create",
          email,
          password,
          fullName,
          role,
          clinicStaffId: staff?.id,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create login");
      toast({ title: "Login created", description: `${email} can now sign in.` });
      qc.invalidateQueries({ queryKey: ["staff"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create login", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const hasLogin = !!(staff as any)?.user_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Create Staff Login</DialogTitle>
          <DialogDescription>
            {hasLogin
              ? "This staff already has a login. Creating again will fail if the email is in use."
              : "Set an email + password. The staff member can immediately sign in with these credentials."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Full Name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@clinic.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Password * (min 6 chars)</Label>
            <div className="relative">
              <Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set initial password" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Share this password with the staff member. They can change it later.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-secondary hover:bg-secondary/90">
            {loading ? "Creating..." : "Create Login"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}