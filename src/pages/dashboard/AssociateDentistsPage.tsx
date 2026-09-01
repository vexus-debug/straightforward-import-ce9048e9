import { useEffect, useMemo, useState } from "react";
import { format, isAfter, parseISO, differenceInDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert, ShieldX, Pencil, ExternalLink, UserCog } from "lucide-react";
import { useStaff, useUpdateStaff, type StaffMember } from "@/hooks/useStaff";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type IndemnityState = "valid" | "expiring" | "expired" | "missing";

function indemnityState(s: StaffMember): IndemnityState {
  const anyS = s as any;
  if (!anyS.has_indemnity) return "missing";
  const expiry = anyS.indemnity_expiry as string | null;
  if (!expiry) return "missing";
  const date = parseISO(expiry);
  if (!isAfter(date, new Date())) return "expired";
  if (differenceInDays(date, new Date()) <= 30) return "expiring";
  return "valid";
}

function IndemnityBadge({ state }: { state: IndemnityState }) {
  const cfg: Record<IndemnityState, { label: string; cls: string; Icon: any }> = {
    valid: { label: "Indemnity valid", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", Icon: ShieldCheck },
    expiring: { label: "Expires soon", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", Icon: ShieldAlert },
    expired: { label: "Indemnity expired", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20", Icon: ShieldX },
    missing: { label: "No indemnity on file", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20", Icon: ShieldX },
  };
  const { label, cls, Icon } = cfg[state];
  return (
    <Badge variant="outline" className={cn("gap-1.5 text-[11px] font-medium", cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

interface IndemnityForm {
  has_indemnity: boolean;
  indemnity_expiry: string;
  indemnity_certificate_url: string;
  indemnity_provider: string;
  indemnity_policy_number: string;
}

function EditIndemnityDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffMember | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateStaff();
  const initial: IndemnityForm = {
    has_indemnity: (staff as any)?.has_indemnity ?? false,
    indemnity_expiry: (staff as any)?.indemnity_expiry ?? "",
    indemnity_certificate_url: (staff as any)?.indemnity_certificate_url ?? "",
    indemnity_provider: (staff as any)?.indemnity_provider ?? "",
    indemnity_policy_number: (staff as any)?.indemnity_policy_number ?? "",
  };
  const [form, setForm] = useState<IndemnityForm>(initial);

  // re-sync when staff changes
  useEffect(() => setForm(initial), [staff?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!staff) return null;

  const handleSave = () => {
    update.mutate(
      {
        id: staff.id,
        ...(form as any),
        indemnity_expiry: form.has_indemnity && form.indemnity_expiry ? form.indemnity_expiry : null,
        indemnity_certificate_url: form.indemnity_certificate_url || null,
        indemnity_provider: form.indemnity_provider || null,
        indemnity_policy_number: form.indemnity_policy_number || null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Indemnity record — {staff.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
            <div>
              <Label className="text-sm">Has personal certificate of indemnity</Label>
              <p className="text-[11px] text-muted-foreground">Required for legal protection in patient care</p>
            </div>
            <Switch checked={form.has_indemnity} onCheckedChange={(v) => setForm({ ...form, has_indemnity: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Expiry date</Label>
              <Input
                type="date"
                value={form.indemnity_expiry || ""}
                onChange={(e) => setForm({ ...form, indemnity_expiry: e.target.value })}
                disabled={!form.has_indemnity}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Provider / Insurer</Label>
              <Input
                placeholder="e.g. MDU, Dental Protection"
                value={form.indemnity_provider}
                onChange={(e) => setForm({ ...form, indemnity_provider: e.target.value })}
                disabled={!form.has_indemnity}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Policy / Certificate number</Label>
            <Input
              value={form.indemnity_policy_number}
              onChange={(e) => setForm({ ...form, indemnity_policy_number: e.target.value })}
              disabled={!form.has_indemnity}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Certificate URL (uploaded document)</Label>
            <Input
              type="url"
              placeholder="https://…"
              value={form.indemnity_certificate_url}
              onChange={(e) => setForm({ ...form, indemnity_certificate_url: e.target.value })}
              disabled={!form.has_indemnity}
            />
            <p className="text-[11px] text-muted-foreground">Upload the certificate to Storage / Documents and paste the link here.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending} className="bg-secondary hover:bg-secondary/90">
            {update.isPending ? "Saving..." : "Save record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AssociateDentistsPage() {
  const { data: staff = [], isLoading } = useStaff();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const associates = useMemo(
    () => staff.filter((s: any) => s.role === "associate_dentist"),
    [staff]
  );

  const stats = useMemo(() => {
    const counts = { valid: 0, expiring: 0, expired: 0, missing: 0 } as Record<IndemnityState, number>;
    for (const s of associates) counts[indemnityState(s)]++;
    return counts;
  }, [associates]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Associate Dentists"
        description={`${associates.length} registered • Indemnity tracking for legal protection`}
        badge={
          stats.missing + stats.expired > 0 ? (
            <Badge variant="outline" className="border-rose-500/30 text-rose-600 text-[10px]">
              {stats.missing + stats.expired} need attention
            </Badge>
          ) : associates.length > 0 ? (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-[10px]">
              All compliant
            </Badge>
          ) : undefined
        }
      />

      <Card className="glass-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : associates.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title="No associate dentists registered"
              description="Associate dentists must be added in Staff Management with the role 'associate_dentist'. Their patients will then be tagged here."
            />
          ) : (
            <ul className="divide-y divide-border/30">
              {associates.map((s: any, i) => {
                const state = indemnityState(s);
                const expiryLabel = s.indemnity_expiry ? format(parseISO(s.indemnity_expiry), "PP") : "—";
                return (
                  <motion.li
                    key={s.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 ring-1 ring-border/30">
                        <AvatarFallback className="bg-secondary/10 text-secondary text-xs font-semibold">
                          {s.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.email ?? "no email"}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <IndemnityBadge state={state} />
                      <span className="text-muted-foreground">
                        Expires: <span className="text-foreground">{expiryLabel}</span>
                      </span>
                      {s.indemnity_provider && (
                        <span className="text-muted-foreground hidden md:inline">
                          • <span className="text-foreground">{s.indemnity_provider}</span>
                        </span>
                      )}
                      {s.indemnity_certificate_url && (
                        <a
                          href={s.indemnity_certificate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-secondary hover:underline"
                        >
                          Certificate <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(s)}>
                          <Pencil className="mr-1 h-3 w-3" /> Edit
                        </Button>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <EditIndemnityDialog staff={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}

export { indemnityState };
