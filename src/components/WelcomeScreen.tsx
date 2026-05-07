import { Activity, ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";

/** Stylized prostate (bilobed walnut shape with median sulcus) — used as the brand mark. */
function ProstateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M12 4.2c-1.4-.9-3.6-.9-5.4.2-2.3 1.4-3.6 3.9-3.6 6.5 0 2.6 1.1 5.1 3.1 6.9 1.6 1.5 3.7 2.4 5.9 2.4s4.3-.9 5.9-2.4c2-1.8 3.1-4.3 3.1-6.9 0-2.6-1.3-5.1-3.6-6.5-1.8-1.1-4-1.1-5.4-.2z"
        fill="currentColor"
        fillOpacity="0.92"
      />
      <path
        d="M12 5.5v14"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M9.5 17.5c.8.6 1.7.9 2.5.9s1.7-.3 2.5-.9"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const FEATURES = [
  {
    Icon: ProstateIcon,
    title: "3D Anatomical Viewer",
    body: "Patient-specific prostate built from measured dimensions, with lesion-aware zone-level risk overlays.",
  },
  {
    Icon: Activity,
    title: "Nine Prediction Models",
    body: "ECE, SVI, grade upgrade, LNI, BCR, PSM — patient and side-specific — trained on 5,352 RARP cases.",
  },
  {
    Icon: Layers,
    title: "Multi-Modal Imaging",
    body: "Combines MRI, micro-ultrasound, and PSMA PET findings with the optional Decipher genomic classifier.",
  },
] as const;

export function WelcomeScreen() {
  const dismissWelcome = useUiStore((s) => s.dismissWelcome);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      {/* Decorative background gradient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent dark:from-primary/15"
      />

      {/*
        Scrollable-modal pattern:
        - Outer fixed + overflow-y-auto = scroll when content > viewport (browser zoom, short windows)
        - Inner min-h-full + items-center = vertical centering when content fits, top-align when it doesn't
        - Fluid clamp() typography = layout reflows under zoom instead of just inflating
      */}
      <div className="relative flex min-h-full w-full items-center justify-center px-[clamp(0.75rem,3vw,2rem)] py-[clamp(1rem,4vh,3rem)]">
        <div className="z-10 mx-auto flex w-full max-w-3xl flex-col items-center">
          {/* Brand mark */}
          <div className="mb-[clamp(0.75rem,2vh,1.25rem)] flex flex-col items-center gap-2">
            <div
              className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-md shadow-primary/25 ring-1 ring-primary/40"
              style={{ width: "clamp(2.5rem, 7vh, 3.25rem)", height: "clamp(2.5rem, 7vh, 3.25rem)" }}
            >
              <ProstateIcon className="h-[60%] w-[60%] text-primary-foreground" />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background">
                <Activity className="h-2.5 w-2.5 text-white" aria-hidden />
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[clamp(0.5rem,1.2vw,0.625rem)] font-bold uppercase tracking-wider text-amber-500">
                Research Use Only
              </span>
              <span className="text-[clamp(0.5rem,1.2vw,0.625rem)] text-muted-foreground/70">
                IRB STUDY-14-00050 · Mount Sinai
              </span>
            </div>
          </div>

          {/* Wordmark + tagline */}
          <h1
            id="welcome-title"
            className="text-center font-black tracking-tight text-foreground"
            style={{ fontSize: "clamp(2rem, 6vw, 3.25rem)", lineHeight: 1.05 }}
          >
            COMPASS
          </h1>
          <p
            className="mt-1.5 text-center font-medium uppercase tracking-[0.2em] text-primary"
            style={{ fontSize: "clamp(0.625rem, 1.4vw, 0.875rem)" }}
          >
            Prostate cancer · Surgical outcomes
          </p>
          <p
            className="mt-3 max-w-2xl text-center leading-relaxed text-muted-foreground"
            style={{ fontSize: "clamp(0.75rem, 1.6vw, 1rem)" }}
          >
            A 3D decision-support platform for preoperative planning in robot-assisted radical
            prostatectomy. Combines clinical data with imaging and genomics to deliver
            patient-specific outcome predictions and side-specific nerve-sparing recommendations.
          </p>

          {/* Feature highlights */}
          <div className="mt-[clamp(1rem,3vh,1.75rem)] grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-lg border border-border/70 bg-card/80 p-[clamp(0.625rem,1.5vw,0.875rem)] shadow-sm backdrop-blur"
              >
                <div
                  className="mb-2 inline-flex items-center justify-center rounded-md bg-primary/10 text-primary"
                  style={{ width: "clamp(1.75rem, 3vw, 2rem)", height: "clamp(1.75rem, 3vw, 2rem)" }}
                >
                  <Icon className="h-[55%] w-[55%]" />
                </div>
                <h2
                  className="font-bold text-foreground"
                  style={{ fontSize: "clamp(0.75rem, 1.4vw, 0.8125rem)" }}
                >
                  {title}
                </h2>
                <p
                  className="mt-1 leading-snug text-muted-foreground"
                  style={{ fontSize: "clamp(0.625rem, 1.2vw, 0.6875rem)" }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            type="button"
            size="lg"
            onClick={dismissWelcome}
            className="mt-[clamp(1rem,3vh,1.5rem)] gap-2 font-semibold shadow-md shadow-primary/20"
            style={{
              height: "clamp(2.25rem, 5vh, 2.75rem)",
              paddingLeft: "clamp(1.25rem, 3vw, 1.75rem)",
              paddingRight: "clamp(1.25rem, 3vw, 1.75rem)",
              fontSize: "clamp(0.8125rem, 1.4vw, 0.875rem)",
            }}
          >
            Enter Workspace
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>

          <p
            className="mt-3 text-center text-muted-foreground/60"
            style={{ fontSize: "clamp(0.5625rem, 1vw, 0.625rem)" }}
          >
            Decision support, not a substitute for clinical judgment.
          </p>
        </div>
      </div>
    </div>
  );
}
