import { useState } from "react";
import { BookOpen, ChevronDown, Database, ExternalLink, TriangleAlert } from "lucide-react";
import { EVIDENCE_REGISTRY, SOURCE_LABEL, type EvidenceSource } from "@/lib/compass/planningEvidence";
import { PLANNING_REFERENCES, REFERENCES_VERIFIED, type PlanningReference } from "@/lib/compass/planningReferences";
import { PaperModal } from "@/components/PaperModal";
import { cn } from "@/lib/utils";

const TONE: Record<EvidenceSource, { badge: string; Icon: typeof Database }> = {
  institutional: {
    badge: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    Icon: Database,
  },
  literature: {
    badge: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    Icon: BookOpen,
  },
  provisional: {
    badge: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    Icon: TriangleAlert,
  },
};

const ORDER: EvidenceSource[] = ["institutional", "literature", "provisional"];

/**
 * "Evidence & sources" — every constant group used by the planning / outcome
 * models, grouped by whether it is COMPASS-data-driven, literature-based, or a
 * provisional expert prior.
 */
export function EvidencePanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  // dedupe by label, keep first
  const seen = new Set<string>();
  const rows = EVIDENCE_REGISTRY.filter((r) => {
    if (seen.has(r.label)) return false;
    seen.add(r.label);
    return true;
  }).sort((a, b) => ORDER.indexOf(a.source) - ORDER.indexOf(b.source));

  const counts = ORDER.map((s) => ({ s, n: rows.filter((r) => r.source === s).length }));

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Evidence &amp; sources
        </span>
        <span className="flex items-center gap-2">
          {counts
            .filter((c) => c.n > 0)
            .map((c) => (
              <span
                key={c.s}
                className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", TONE[c.s].badge)}
              >
                {c.n} {SOURCE_LABEL[c.s].split(" ")[0]}
              </span>
            ))}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Every number in the surgical-planning and outcome models is either driven by the COMPASS
            training data or taken from published literature. Items marked{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">provisional</span> are
            expert-prior defaults not yet calibrated on COMPASS data.
          </p>
          {ORDER.map((src) => {
            const group = rows.filter((r) => r.source === src);
            if (group.length === 0) return null;
            const { Icon, badge } = TONE[src];
            return (
              <div key={src}>
                <div className={cn("mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold", badge)}>
                  <Icon className="h-3 w-3" />
                  {SOURCE_LABEL[src]}
                </div>
                <ul className="space-y-1.5">
                  {group.map((r) => (
                    <li key={r.label} className="text-xs">
                      <span className="font-medium text-foreground">{r.label}</span>
                      <span className="block leading-snug text-muted-foreground">{r.citation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <Bibliography />
        </div>
      )}
    </div>
  );
}

function Bibliography() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlanningReference | null>(null);
  const tewari = PLANNING_REFERENCES.filter((r) => r.group === "tewari");
  const external = PLANNING_REFERENCES.filter((r) => r.group === "external");

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold"
      >
        <span>Full references ({PLANNING_REFERENCES.length})</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {!REFERENCES_VERIFIED && (
            <p className="flex gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              Citations compiled from working knowledge — not yet verified against PubMed / DOI.
            </p>
          )}
          {[
            ["Mount Sinai / Tewari group", tewari],
            ["Other landmark references", external],
          ].map(([heading, refs]) => (
            <div key={heading as string}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {heading as string}
              </div>
              <ol className="space-y-1.5">
                {(refs as typeof PLANNING_REFERENCES).map((r) => (
                  <li key={r.key} className="text-[11px] leading-snug">
                    <button type="button" onClick={() => setSelected(r)} className="text-left hover:underline">
                      <span className="text-foreground">{r.authors}</span> {r.title}{" "}
                      <span className="italic text-muted-foreground">{r.source}</span>
                      <ExternalLink className="ml-0.5 inline h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                    <span className="block text-[10px] text-muted-foreground/60">
                      used for: {r.usedFor.join("; ")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      {selected && <PaperModal reference={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
