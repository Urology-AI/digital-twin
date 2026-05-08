import { Activity, ArrowRight, Layers, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";

/**
 * Mount Sinai brand mark — uses the official asset files in /public.
 * Both variants are rendered; CSS visibility (`block` / `hidden` paired with
 * `dark:hidden` / `dark:block`) selects the correct one for the active theme.
 */
function MountSinaiMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <>
      <img
        src={`${import.meta.env.BASE_URL}logo_light.png`}
        alt="Mount Sinai"
        className={`block dark:hidden ${className ?? ""}`}
        style={style}
      />
      <img
        src={`${import.meta.env.BASE_URL}logo_dark.png`}
        alt="Mount Sinai"
        className={`hidden dark:block ${className ?? ""}`}
        style={style}
      />
    </>
  );
}

const FEATURES = [
  {
    Icon: Stethoscope,
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
      {/* Decorative background gradient — Mount Sinai cyan/magenta accents */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,174,239,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(213,0,91,0.10),transparent_55%)]"
      />

      {/*
        Scrollable-modal pattern:
        - Outer fixed + overflow-y-auto = scroll when content > viewport (browser zoom, short windows)
        - Inner min-h-full + items-center = vertical centering when content fits, top-align when it doesn't
        - Fluid clamp() typography = layout reflows under zoom instead of just inflating
      */}
      <div className="relative flex min-h-full w-full items-center justify-center px-[clamp(0.75rem,3vw,2rem)] py-[clamp(1rem,4vh,3rem)]">
        <div className="z-10 mx-auto flex w-full max-w-3xl flex-col items-center">
          {/* Mount Sinai logo */}
          <div className="mb-[clamp(1rem,2.5vh,1.5rem)] flex flex-col items-center gap-3">
            <MountSinaiMark
              className="h-auto w-auto text-foreground"
              style={{ height: "clamp(3rem, 9vh, 4.75rem)" }}
            />
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[clamp(0.5625rem,1.2vw,0.6875rem)] font-bold uppercase tracking-wider text-amber-500">
                Research Use Only
              </span>
              <span className="text-[clamp(0.5625rem,1.2vw,0.6875rem)] text-muted-foreground/70">
                IRB STUDY-14-00050
              </span>
            </div>
          </div>

          {/* Wordmark + tagline */}
          <h1
            id="welcome-title"
            className="text-center font-black tracking-tight text-foreground"
            style={{ fontSize: "clamp(2.75rem, 7.5vw, 4.25rem)", lineHeight: 1.02, letterSpacing: "-0.02em" }}
          >
            COMPASS
          </h1>
          <p
            className="mt-2 text-center font-semibold uppercase tracking-[0.22em] text-primary"
            style={{ fontSize: "clamp(0.75rem, 1.6vw, 1rem)" }}
          >
            Prostate cancer · Surgical outcomes
          </p>
          <p
            className="mt-2 text-center font-medium text-foreground/80"
            style={{ fontSize: "clamp(0.8125rem, 1.5vw, 0.9375rem)", letterSpacing: "0.01em" }}
          >
            Tewari Lab — Mount Sinai Department of Urology
          </p>
          <p
            className="mt-4 max-w-2xl text-center leading-relaxed text-muted-foreground"
            style={{ fontSize: "clamp(0.875rem, 1.7vw, 1.0625rem)" }}
          >
            A 3D decision-support platform for preoperative planning in robot-assisted radical
            prostatectomy. Combines clinical data with imaging and genomics to deliver
            patient-specific outcome predictions and side-specific nerve-sparing recommendations.
          </p>

          {/* Feature highlights */}
          <div className="mt-[clamp(1.25rem,3.5vh,2rem)] grid w-full grid-cols-1 gap-3.5 sm:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-lg border border-border/70 bg-card/80 p-[clamp(0.875rem,1.75vw,1.125rem)] shadow-sm backdrop-blur"
              >
                <div
                  className="mb-2.5 inline-flex items-center justify-center rounded-md bg-primary/10 text-primary"
                  style={{ width: "clamp(2rem, 3.25vw, 2.25rem)", height: "clamp(2rem, 3.25vw, 2.25rem)" }}
                >
                  <Icon className="h-[55%] w-[55%]" />
                </div>
                <h2
                  className="font-bold text-foreground"
                  style={{ fontSize: "clamp(0.875rem, 1.5vw, 0.9375rem)", letterSpacing: "-0.005em" }}
                >
                  {title}
                </h2>
                <p
                  className="mt-1 leading-snug text-muted-foreground"
                  style={{ fontSize: "clamp(0.75rem, 1.3vw, 0.8125rem)" }}
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
            className="mt-[clamp(1.25rem,3.5vh,1.75rem)] gap-2 font-semibold shadow-md shadow-primary/20"
            style={{
              height: "clamp(2.5rem, 5.5vh, 3rem)",
              paddingLeft: "clamp(1.5rem, 3.25vw, 2rem)",
              paddingRight: "clamp(1.5rem, 3.25vw, 2rem)",
              fontSize: "clamp(0.875rem, 1.5vw, 0.9375rem)",
            }}
          >
            Enter Workspace
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>

          <p
            className="mt-3 text-center text-muted-foreground/60"
            style={{ fontSize: "clamp(0.625rem, 1.05vw, 0.6875rem)" }}
          >
            Decision support, not a substitute for clinical judgment.
          </p>
        </div>
      </div>
    </div>
  );
}
