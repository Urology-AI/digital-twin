import { ExternalLink } from "lucide-react";
import { refLink, type PlanningReference } from "@/lib/compass/planningReferences";

/**
 * Modal popup showing one reference's citation with a link out to an exact-
 * title search. We tried embedding the paper itself (PubMed, then Europe PMC)
 * in an iframe here; both refuse to render cross-origin — PubMed's result page
 * requires first-party cookies, Europe PMC sends a frame-blocking header. No
 * literature index we found is embeddable, so this stays a citation card
 * rather than a broken blank frame.
 */
export function PaperModal({
  reference,
  onClose,
}: {
  reference: PlanningReference;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {reference.group === "tewari" ? "Mount Sinai / Tewari group" : "Reference"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <h3 className="text-sm font-semibold leading-snug">{reference.title}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground">{reference.authors}</p>
        <p className="mt-0.5 text-xs italic text-muted-foreground">{reference.source}</p>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground/80">
          used for: {reference.usedFor.join("; ")}
        </p>
        <a
          href={refLink(reference)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Open on Europe PMC
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
