import { useEffect, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildClinicalShareUrl, buildPatientShareUrl } from "@/store/patientStore";
import { cn } from "@/lib/utils";

function LinkRow({
  label,
  description,
  url,
  loading,
  error,
}: {
  label: string;
  description: string;
  url: string | null;
  loading: boolean;
  error: string | null;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-9 flex-1 truncate rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
          {loading ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving to cloud…
            </span>
          ) : error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            url ?? "—"
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!url || loading}
          onClick={() => {
            if (!url) return;
            navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className={cn("shrink-0 gap-1.5", copied && "text-emerald-500")}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function ShareLinkModal({ onClose }: { onClose: () => void }) {
  const [clinicalUrl, setClinicalUrl] = useState<string | null>(null);
  const [clinicalError, setClinicalError] = useState<string | null>(null);
  const [patientUrl, setPatientUrl] = useState<string | null>(null);
  const [patientLoading, setPatientLoading] = useState(true);
  const [patientError, setPatientError] = useState<string | null>(null);

  useEffect(() => {
    buildClinicalShareUrl()
      .then((url) => (url ? setClinicalUrl(url) : setClinicalError("No active case to share.")))
      .catch((e) => setClinicalError(e instanceof Error ? e.message : String(e)));

    buildPatientShareUrl()
      .then((url) => (url ? setPatientUrl(url) : setPatientError("No active case to share.")))
      .catch((e) => setPatientError(e instanceof Error ? e.message : String(e)))
      .finally(() => setPatientLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold text-foreground">Share this case</div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5">
          <LinkRow
            label="Clinical link"
            description="Full case, opens in the clinical workspace. Requires Microsoft sign-in."
            url={clinicalUrl}
            loading={false}
            error={clinicalError}
          />
          <LinkRow
            label="Patient link"
            description="Simplified view-only summary. No sign-in required."
            url={patientUrl}
            loading={patientLoading}
            error={patientError}
          />
        </div>
      </div>
    </div>
  );
}
