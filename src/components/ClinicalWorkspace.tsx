import { usePatientStore } from "@/store/patientStore";
import { ZoneInputWizard } from "@/components/ZoneInputWizard";
import { PredictionPanel } from "@/components/PredictionPanel";
import { cn } from "@/lib/utils";

interface ClinicalWorkspaceProps {
  className?: string;
  compact?: boolean;
}

export function ClinicalWorkspace({ className, compact }: ClinicalWorkspaceProps) {
  const loading = usePatientStore((s) => s.loading);

  const stackGap = "flex flex-col gap-5 sm:gap-6";
  const pad = compact ? "px-4 py-5 sm:px-5 sm:py-6" : "p-5 sm:p-6";

  return (
    <div
      className={cn(
        stackGap,
        pad,
        "pb-10 max-lg:pb-12",
        compact && "mx-auto w-full max-w-2xl",
        className,
      )}
    >
      {loading && (
        <div className="rounded-xl border border-dashed border-primary/35 bg-primary/[0.06] px-4 py-8 text-center text-sm text-muted-foreground">
          Loading patients…
        </div>
      )}

      {!compact && (
        <section aria-labelledby="predictions-heading">
          <h2 id="predictions-heading" className="sr-only">Model predictions</h2>
          <PredictionPanel />
        </section>
      )}

      <section aria-labelledby="zone-wizard-heading">
        <h2 id="zone-wizard-heading" className="sr-only">Zone input wizard</h2>
        <ZoneInputWizard />
      </section>
    </div>
  );
}
