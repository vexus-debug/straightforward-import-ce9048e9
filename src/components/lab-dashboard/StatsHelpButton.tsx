import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle } from "lucide-react";

export interface HelpSection {
  title: string;
  what: string; // What this widget shows
  how: string;  // How it's calculated
  read?: string; // How to read / interpret it
}

interface StatsHelpButtonProps {
  pageTitle: string;
  intro?: string;
  sections: HelpSection[];
  label?: string;
}

export function StatsHelpButton({ pageTitle, intro, sections, label = "Help" }: StatsHelpButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <HelpCircle className="h-4 w-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="h-5 w-5 text-primary" />
              {pageTitle} — How it works
            </DialogTitle>
            {intro && <DialogDescription className="text-sm leading-relaxed">{intro}</DialogDescription>}
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] px-6 py-4">
            <div className="space-y-5">
              {sections.map((s, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                    <h3 className="font-semibold text-sm">{s.title}</h3>
                  </div>
                  <div className="pl-8 space-y-2 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What it shows</p>
                      <p className="text-foreground/90 leading-relaxed">{s.what}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How it's calculated</p>
                      <p className="text-foreground/90 leading-relaxed whitespace-pre-line">{s.how}</p>
                    </div>
                    {s.read && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to read it</p>
                        <p className="text-foreground/90 leading-relaxed">{s.read}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
