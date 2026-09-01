import { Activity, ArrowRight, BookOpen, Layers, Lock, Stethoscope } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";
import { isDemoMode } from "@/lib/demoMode";
import { isOfflineBuild } from "@/lib/offlineBuild";

const APP_URL = "https://urology-ai.github.io/digital-twin/";

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
  const startTutorial = useUiStore((s) => s.startTutorial);
  // Public preview ("/"): no free workspace — the interactive tool is
  // clinician-only, behind Cloudflare Access at /clinical. "Take the Tour"
  // opens a frozen, read-only preview.
  const demo = isDemoMode();

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
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,174,239,0.20),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(213,0,91,0.16),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.15] dark:opacity-[0.4] [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:36px_36px]"
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
          <div
            className="welcome-fade-up mb-[clamp(1rem,2.5vh,1.5rem)] flex flex-col items-center gap-3"
            style={{ animationDelay: "0ms" }}
          >
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
            className="welcome-fade-up text-center font-black tracking-tight text-foreground"
            style={{
              fontSize: "clamp(2.75rem, 7.5vw, 4.25rem)",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              animationDelay: "60ms",
            }}
          >
            COMPASS
          </h1>
          <p
            className="welcome-fade-up mt-2 text-center font-semibold uppercase tracking-[0.22em] text-primary"
            style={{ fontSize: "clamp(0.75rem, 1.6vw, 1rem)", animationDelay: "120ms" }}
          >
            Prostate cancer · Surgical outcomes
          </p>
          <div
            className="welcome-fade-up mt-3 h-px w-16 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            style={{ animationDelay: "150ms" }}
            aria-hidden
          />
          <p
            className="welcome-fade-up mt-3 text-center font-medium text-foreground/80"
            style={{ fontSize: "clamp(0.8125rem, 1.5vw, 0.9375rem)", letterSpacing: "0.01em", animationDelay: "180ms" }}
          >
            Tewari Lab — Mount Sinai Department of Urology
          </p>
          <p
            className="welcome-fade-up mt-4 max-w-2xl text-center leading-relaxed text-muted-foreground"
            style={{ fontSize: "clamp(0.875rem, 1.7vw, 1.0625rem)", animationDelay: "220ms" }}
          >
            A 3D decision-support platform for preoperative planning in robot-assisted radical
            prostatectomy. Combines clinical data with imaging and genomics to deliver
            patient-specific outcome predictions and side-specific nerve-sparing recommendations.
          </p>

          {/* Impact stats */}
          <div
            className="welcome-fade-up mt-[clamp(1rem,3vh,1.5rem)] flex w-full max-w-md items-stretch justify-center divide-x divide-border/60 rounded-lg border border-border/70 bg-card/60 backdrop-blur"
            style={{ animationDelay: "250ms" }}
          >
            {[
              { value: "5,352", label: "RARP cases" },
              { value: "9", label: "Prediction models" },
              { value: "6", label: "Outcomes tracked" },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2.5">
                <span
                  className="font-black tracking-tight text-primary"
                  style={{ fontSize: "clamp(1.125rem, 2.2vw, 1.375rem)" }}
                >
                  {value}
                </span>
                <span
                  className="text-center font-medium uppercase tracking-wide text-muted-foreground/80"
                  style={{ fontSize: "clamp(0.5625rem, 1vw, 0.625rem)" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Feature highlights */}
          <div
            className="welcome-fade-up mt-[clamp(1.25rem,3.5vh,2rem)] grid w-full grid-cols-1 gap-3.5 sm:grid-cols-3"
            style={{ animationDelay: "280ms" }}
          >
            {FEATURES.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-lg border border-border/70 bg-card/80 p-[clamp(0.875rem,1.75vw,1.125rem)] shadow-sm backdrop-blur transition-colors hover:border-primary/30 hover:bg-card"
              >
                <div
                  className="mb-2.5 inline-flex items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-[0_0_0_1px_rgba(0,174,239,0.08)] transition-shadow group-hover:shadow-[0_0_16px_rgba(0,174,239,0.35)]"
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

          {/* CTAs */}
          <div
            className="welcome-fade-up mt-[clamp(1.25rem,3.5vh,1.75rem)] flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center"
            style={{ animationDelay: "340ms" }}
          >
            <Button
              type="button"
              size="lg"
              autoFocus
              onClick={demo ? () => { window.location.href = "/clinical"; } : dismissWelcome}
              className="gap-2 font-semibold shadow-md shadow-primary/20 transition-transform hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{
                height: "clamp(2.5rem, 5.5vh, 3rem)",
                paddingLeft: "clamp(1.5rem, 3.25vw, 2rem)",
                paddingRight: "clamp(1.5rem, 3.25vw, 2rem)",
                fontSize: "clamp(0.875rem, 1.5vw, 0.9375rem)",
              }}
            >
              {demo ? <Lock className="h-4 w-4" aria-hidden /> : null}
              {demo ? "Clinician sign in" : "Enter Workspace"}
              {demo ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={startTutorial}
              className="gap-2 font-semibold transition-colors hover:border-primary/40 hover:bg-primary/5"
              style={{
                height: "clamp(2.5rem, 5.5vh, 3rem)",
                paddingLeft: "clamp(1.5rem, 3.25vw, 2rem)",
                paddingRight: "clamp(1.5rem, 3.25vw, 2rem)",
                fontSize: "clamp(0.875rem, 1.5vw, 0.9375rem)",
              }}
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              Take the Tour
            </Button>
          </div>
          <p
            className="welcome-fade-up mt-2 text-center text-muted-foreground/60"
            style={{ fontSize: "clamp(0.6875rem, 1.15vw, 0.75rem)", animationDelay: "380ms" }}
          >
            {demo
              ? "The tour opens a preview with a sample case — nothing is saved. The full tool is for Mount Sinai clinicians."
              : "New here? Take the tour first — it's a 2-minute walkthrough."}
          </p>

          {/* QR code — scan to open this app on a mobile device (web only) */}
          {!isOfflineBuild() && (
          <div
            className="welcome-fade-up mt-[clamp(1.25rem,3vh,1.75rem)] flex flex-col items-center gap-2 rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur"
            style={{ animationDelay: "420ms" }}
          >
            <div className="rounded-md bg-white p-2 shadow-sm ring-1 ring-border/60">
              <QRCodeSVG
                value={APP_URL}
                size={88}
                level="M"
                marginSize={0}
                aria-label={`QR code linking to ${APP_URL}`}
              />
            </div>
            <a
              href={APP_URL}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
              style={{ fontSize: "clamp(0.625rem, 1.05vw, 0.6875rem)" }}
            >
              Scan to open · urology-ai.github.io/digital-twin
            </a>
          </div>
          )}

          <p
            className="welcome-fade-up mt-3 text-center text-muted-foreground/60"
            style={{ fontSize: "clamp(0.625rem, 1.05vw, 0.6875rem)", animationDelay: "460ms" }}
          >
            Decision support, not a substitute for clinical judgment.
          </p>
        </div>
      </div>
    </div>
  );
}
