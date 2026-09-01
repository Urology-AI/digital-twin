import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { referencesFor, type PlanningReference } from "@/lib/compass/planningReferences";
import { PaperModal } from "@/components/PaperModal";
import { cn } from "@/lib/utils";

/**
 * Compact "Sources" affordance for one feature. Give it the `usedFor` tag(s)
 * from planningReferences.ts; it renders a single quiet chip that opens a small
 * list of the matching papers — each row opens a citation modal with a link out.
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
  const [listOpen, setListOpen] = useState(false);
  const [paper, setPaper] = useState<PlanningReference | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refs = referencesFor(...tags);

  useEffect(() => {
    if (!listOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setListOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [listOpen]);

  if (refs.length === 0) return null;

  const handleOf = (r: PlanningReference) =>
    `${r.authors.split(/[ ,]/)[0]} ${r.source.match(/\b(19|20)\d{2}\b/)?.[0] ?? ""}`.trim();

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setListOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-1.5 py-0.5",
          "text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          listOpen && "bg-muted text-foreground",
        )}
      >
        <BookOpen className="h-2.5 w-2.5" />
        {label} · {refs.length}
      </button>

      {listOpen && (
        <div className="absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-1 shadow-md">
          {refs.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setPaper(r);
                setListOpen(false);
              }}
              className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] leading-snug hover:bg-muted"
            >
              <span className="font-semibold text-foreground">{handleOf(r)}</span>
              <span className="block truncate text-muted-foreground">{r.title}</span>
            </button>
          ))}
        </div>
      )}

      {paper && <PaperModal reference={paper} onClose={() => setPaper(null)} />}
    </div>
  );
}
