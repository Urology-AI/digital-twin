import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELD_REFERENCES, REFERENCES } from "@/lib/inflammation/references";

interface InflammationSourcesModalProps {
  onClose: () => void;
}

/** Field id → human label, for the per-domain source table. Mirrors the labels in InflammationWorkspace's field defs. */
const FIELD_LABELS: Record<string, string> = {
  ccl: "Capsular contact length",
  angle: "Contact angle",
  caps: "Capsular integrity",
  epeGr: "Mehralivand EPE grade",
  morph: "Periprostatic abnormality shape",
  adcI: "Interface ADC",
  adcL: "Lesion-core ADC",
  t2Ratio: "T2 signal ratio (interface / contralateral fat)",
  dce: "DCE curve type",
  t1hi: "T1 hyperintensity at capsule",
  vein: "Periprostatic venous plexus",
  rwo: "PPAT chemical-shift water:oil ratio",
  ppatFibrosis: "PPAT T1W radiomic fibrosis",
  ppatGeom: "PPAT geometric remodeling",
  suvL: "Lesion SUVmax",
  suvP: "Periprostatic SUVmax",
  psmaFocalUptake: "Focal periprostatic PSMA uptake",
  mus1: "Micro-US: capsular bulging",
  mus2: "Micro-US: visible breach",
  mus3: "Micro-US: hypoechoic halo",
  mus4: "Micro-US: vesiculo-prostatic angle",
  posC: "Ipsilateral positive cores (incl. ≥1/3 threshold)",
  maxI: "Greatest single-core involvement",
  pni: "Perineural invasion",
  iraniG: "Irani G (stromal infiltrate)",
  iraniA: "Irani A (glandular aggressiveness)",
  gran: "Granulomatous inflammation",
  nCores: "Ipsilateral cores taken",
  priorBx: "Prior biopsy sessions",
  bxMri: "Biopsy → MRI interval",
  bxSurg: "Biopsy → surgery interval",
  priorIntv: "Prior TURP / focal Rx / BCG / prostatitis",
  bmi: "BMI",
  mets: "Metabolic syndrome components",
  crp: "CRP",
  nlr: "Neutrophil–lymphocyte ratio",
  psad: "PSA density",
  nsGrade: "Martini nerve-sparing grade thresholds",
};

const DOMAINS: { title: string; fields: string[] }[] = [
  { title: "MRI — morphology & geometry", fields: ["ccl", "angle", "caps", "epeGr", "morph"] },
  { title: "MRI — quantitative", fields: ["adcI", "adcL", "t2Ratio", "dce", "t1hi", "vein"] },
  { title: "Periprostatic adipose tissue (PPAT)", fields: ["rwo", "ppatFibrosis", "ppatGeom"] },
  { title: "PSMA-PET", fields: ["suvL", "suvP", "psmaFocalUptake"] },
  { title: "Micro-ultrasound", fields: ["mus1", "mus2", "mus3", "mus4"] },
  { title: "Biopsy — oncological", fields: ["posC", "maxI", "pni"] },
  { title: "Biopsy — inflammatory & interval", fields: ["iraniG", "iraniA", "gran", "nCores", "priorBx", "bxMri", "bxSurg", "priorIntv"] },
  { title: "Clinical / metabolic", fields: ["bmi", "mets", "crp", "nlr", "psad"] },
  { title: "Nerve-sparing plane mapping", fields: ["nsGrade"] },
];

const UNCITED_NOTE_FIELDS = ["psaPrior", "psaPriorMonths", "mriIntervalChange"];

function RefBadges({ ns }: { ns: number[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ns.map((n) => (
        <a
          key={n}
          href={`#ppi-ref-${n}`}
          className="rounded border border-border px-1 font-mono text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
        >
          {n}
        </a>
      ))}
    </span>
  );
}

export function InflammationSourcesModal({ onClose }: InflammationSourcesModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Literature sources"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground">Literature sources</h2>
            <p className="text-[11px] text-muted-foreground">
              Every coefficient in this instrument is still an expert prior — these citations establish direction of
              effect, not a fitted weight.
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

        <div className="overflow-y-auto app-scroll px-5 py-4">
          <section className="space-y-4">
            {DOMAINS.map((d) => (
              <div key={d.title}>
                <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{d.title}</h3>
                <div className="space-y-1">
                  {d.fields.map((f) => (
                    <div key={f} className="flex items-center justify-between gap-3 border-b border-dotted border-border py-1 text-xs">
                      <span className="text-foreground">{FIELD_LABELS[f] ?? f}</span>
                      <RefBadges ns={FIELD_REFERENCES[f] ?? []} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                Not in the source literature review
              </h3>
              <p className="text-xs text-muted-foreground">
                {UNCITED_NOTE_FIELDS.map((f) => FIELD_LABELS[f] ?? f).join(", ")} — added as coefficients without a
                specific citation from this reference set; treat their weights as unvalidated placeholders pending a
                dedicated kinetics literature pass.
              </p>
            </div>
          </section>

          <section className="mt-6 border-t border-border pt-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Full bibliography ({REFERENCES.length})
            </h3>
            <ol className="space-y-2">
              {REFERENCES.map((r) => (
                <li key={r.n} id={`ppi-ref-${r.n}`} className="scroll-mt-4 text-xs leading-snug">
                  <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">[{r.n}]</span>
                  <span className="text-foreground">{r.title}.</span>{" "}
                  <span className="italic text-muted-foreground">{r.journal}.</span>{" "}
                  <span className="text-muted-foreground">{r.year}.</span>{" "}
                  <span className="text-muted-foreground">{r.authors}</span>
                  {r.tag && <span className="ml-1.5 rounded bg-muted px-1 text-[10px] text-muted-foreground">{r.tag}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
