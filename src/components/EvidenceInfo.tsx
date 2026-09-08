import { useEffect, useState } from "react";
import { EVIDENCE_REGISTRY, SOURCE_LABEL, type Evidenced } from "@/lib/compass/planningEvidence";
import { referencesFor, type PlanningReference } from "@/lib/compass/planningReferences";
import { PaperModal } from "@/components/PaperModal";
import { cn } from "@/lib/utils";

/** What the modal renders — `entries` and `tags` both normalise to this. */
type Derivation = Pick<Evidenced<unknown>, "label" | "source" | "citation">;

/**
 * "ⓘ" next to a number or a section title: opens a modal with the citation(s)
 * behind it, straight from the planningEvidence entries so what is shown cannot
 * drift from the values the models actually use. The full bibliography stays in
 * the methodology panel → Evidence & sources.
 *
 * One of these per section is the house pattern — not one chip per row. Pass
 * either the evidence `entries` directly, or the `tags` of everything in the
 * section and they are looked up (and de-duplicated) here.
 */
export function EvidenceInfo({
  entries,
  tags,
  title,
  className,
}: {
  entries?: Evidenced<unknown>[];
  /** planningEvidence labels / bibliography tags covered by this section */
  tags?: string[];
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [paper, setPaper] = useState<PlanningReference | null>(null);

  const seen = new Set<string>();
  const derivations: Derivation[] = [
    ...(entries ?? []),
    ...(tags ? EVIDENCE_REGISTRY.filter((e) => tags.includes(e.label)) : []),
  ].filter((e) => !seen.has(e.label) && seen.add(e.label));

  const papers = tags ? referencesFor(...tags) : [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${title} — sources`}
        aria-label={`${title} — sources`}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold leading-none text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
          className,
        )}
      >
        i
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            // The button can sit inside an uppercase/tracked header, and the
            // modal renders in place — reset the inherited type here.
            className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 normal-case tracking-normal shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold">{title} — how it is derived</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg leading-none text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {derivations.map((e) => (
                <div key={e.label} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-semibold text-foreground">{e.label}</span>
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      {SOURCE_LABEL[e.source]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{e.citation}</p>
                </div>
              ))}
            </div>
            {papers.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Papers ({papers.length})
                </div>
                <div className="space-y-0.5">
                  {papers.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setPaper(r)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] leading-snug hover:bg-muted"
                    >
                      <span className="font-semibold text-foreground">{r.authors.split(/[ ,]/)[0]}</span>{" "}
                      <span className="text-muted-foreground">{r.source.match(/\b(19|20)\d{2}\b/)?.[0] ?? ""}</span>
                      <span className="block truncate text-muted-foreground">{r.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 text-[10px] text-muted-foreground">
              Full bibliography: methodology panel (ⓘ) → Sources.
            </p>
          </div>
        </div>
      )}
      {paper && <PaperModal reference={paper} onClose={() => setPaper(null)} />}
    </>
  );
}
