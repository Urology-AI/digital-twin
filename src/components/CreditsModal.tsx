import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreditsModalProps {
  onClose: () => void;
}

const PI = {
  name: "Ashutosh K. Tewari, MD",
  title: "Chair, Urology — Icahn School of Medicine at Mount Sinai",
  roles: ["Original concept & clinical direction"],
};

const MEMBERS = [
  {
    name: "Aditya Dixit",
    affiliation: "Mount Sinai Urology AI",
    roles: ["Software, UI & interface development", "Model enhancements"],
  },
  {
    name: "Daniel Ajabshir",
    affiliation: "Mount Sinai Urology",
    roles: ["Clinical analysis & model development"],
  },
  {
    name: "Neelanchal Gahalot",
    affiliation: "Mount Sinai Urology AI",
    roles: ["Machine learning implementations"],
  },
  {
    name: "Yashaswini Agarwal",
    affiliation: "Mount Sinai Urology",
    roles: ["Data analysis"],
  },
];

export function CreditsModal({ onClose }: CreditsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Credits"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground">Credits</h2>
            <p className="text-[11px] text-muted-foreground">
              Developed at the Icahn School of Medicine at Mount Sinai
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">

          {/* Principal Investigator */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-2">
              Principal Investigator
            </p>
            <p className="text-sm font-bold text-foreground">{PI.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{PI.title}</p>
            <div className="mt-2 space-y-0.5">
              {PI.roles.map((r) => (
                <p key={r} className="text-[11px] text-primary/80">{r}</p>
              ))}
            </div>
          </div>

          {/* Team */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current Lab Members
            </p>
            <div className="space-y-3">
              {MEMBERS.map((m) => (
                <div key={m.name} className="flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                    {m.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground/70">{m.affiliation}</p>
                    <div className="mt-0.5 space-y-px">
                      {m.roles.map((r) => (
                        <p key={r} className="text-[11px] text-muted-foreground">{r}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-3 text-[10px] text-muted-foreground/50 text-center">
            Research use only · IRB STUDY-14-00050 · Mount Sinai Health System
          </div>
        </div>
      </div>
    </div>
  );
}
