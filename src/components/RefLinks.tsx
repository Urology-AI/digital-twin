import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { referencesFor, type PlanningReference } from "@/lib/compass/planningReferences";
import { PaperModal } from "@/components/PaperModal";
import { cn } from "@/lib/utils";

/**
 * Compact "Sources" list for one feature. Give it the `usedFor` tag(s) from
 * planningReferences.ts; it renders the matching papers as chips that open a
 * citation modal (with a link out to the paper).
 */
export function RefLinks({
  tags,
  className,
  label = "Sources",
}: {
  tags: string[];
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState<PlanningReference | null>(null);
  const refs = referencesFor(...tags);
  if (refs.length === 0) return null;
  return (
    <div className={cn("text-[11px] leading-snug", className)}>
      <span className="font-semibold text-muted-foreground">{label}: </span>
      {refs.map((r, i) => {
        const handle = `${r.authors.split(/[ ,]/)[0]} ${r.source.match(/\b(19|20)\d{2}\b/)?.[0] ?? ""}`.trim();
        return (
          <span key={r.key}>
            {i > 0 && <span className="text-muted-foreground/50">, </span>}
            <button
              type="button"
              onClick={() => setOpen(r)}
              title={`${r.authors} ${r.title} ${r.source}`}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {handle}
              <ExternalLink className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}
      {open && <PaperModal reference={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
