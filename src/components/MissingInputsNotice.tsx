import { REQUIRED_INPUT_MESSAGES } from "@/lib/models/inputContract";
import { usePatientStore } from "@/store/patientStore";

/**
 * Shown in place of predictions when the active case is missing PSA, prostate
 * volume or biopsy grade group (or has an imaging-status conflict). Returns
 * null when nothing is missing, so callers can fall back to their own empty
 * state.
 */
export function MissingInputsNotice({ className = "" }: { className?: string }) {
  const missing = usePatientStore((s) => s.missingRequired);
  if (missing.length === 0) return null;
  return (
    <div className={`mx-auto w-full max-w-2xl rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center ${className}`}>
      <p className="text-sm font-semibold text-foreground">Cannot calculate yet</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {missing.map((m) => (
          <li key={m}>{REQUIRED_INPUT_MESSAGES[m]}</li>
        ))}
      </ul>
    </div>
  );
}
