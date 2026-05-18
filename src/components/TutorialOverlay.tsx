import { type ElementType, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Box,
  Brain,
  ClipboardList,
  Layers,
  Microscope,
  Stethoscope,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

interface Step {
  icon: ElementType;
  title: string;
  body: string;
  hint?: string;
  /** data-tutorial value of the element to spotlight. null = no spotlight. */
  target: string | null;
}

const STEPS: Step[] = [
  {
    icon: Stethoscope,
    title: "Welcome to COMPASS",
    body: "COMPASS is a preoperative decision-support tool for robot-assisted radical prostatectomy (RARP). It combines clinical data, MRI, micro-ultrasound, and PSMA PET to predict surgical outcomes and recommend nerve-sparing strategies per side.",
    hint: "This tour walks you through every section in about 2 minutes.",
    target: null,
  },
  {
    icon: User,
    title: "Select or Import a Patient",
    body: "Use the patient dropdown in the header to switch between cases. Pre-loaded sample patients are included. To add your own, click Import JSON and upload a file matching the prostate-3d-input-v1 schema.",
    hint: "The patient selector is highlighted above.",
    target: "patient-select",
  },
  {
    icon: ClipboardList,
    title: "Enter Clinical Data",
    body: "Start with the required fields: PSA, prostate volume, biopsy grade group (1–5), number of positive cores, and maximum core involvement (%). PSAD calculates automatically. Add Decipher score, SHIM, and IPSS when available.",
    hint: "Fill in the Demographics & Labs form shown here.",
    target: "clinical-form",
  },
  {
    icon: Microscope,
    title: "Add Imaging Findings by Zone",
    body: "Click any zone square on the prostate grid to enter MRI (PI-RADS, EPE, abutment), micro-ultrasound (PRI-MUS, ECE), or PSMA PET (SUVmax, EPE/SVI/LN) findings. Zone colors update instantly as risk is computed.",
    hint: "Click any zone square to open its imaging panel.",
    target: "zone-grid",
  },
  {
    icon: Activity,
    title: "Read the Risk Predictions",
    body: "Six outcome probabilities — ECE, SVI, grade upgrade, LNI, BCR, and PSM — with 90% confidence intervals. Green = low risk (<15%), amber = moderate (15–30%), red = elevated (>30%). Tap the Explain button for a plain-language interpretation.",
    hint: "The six prediction cards are highlighted here.",
    target: "prediction-panel",
  },
  {
    icon: Box,
    title: "Explore the 3D Viewer",
    body: "The 3D prostate is built from the patient's measured dimensions. Zone colors reflect ECE risk. Drag to rotate, pinch or scroll to zoom. Use the overlay selector to switch between cancer, ECE, or SVI heatmaps.",
    hint: "Drag to rotate the model shown here.",
    target: "three-canvas",
  },
  {
    icon: Brain,
    title: "Nerve-Sparing Recommendation",
    body: "COMPASS recommends a nerve-sparing grade per side — Grade 1 (full preservation), Grade 2 (partial), or Grade 3 (wide excision). The surgical consequence chain shows predicted PSM rate at that grade and BCR risk if margin-negative vs positive.",
    hint: "The NS grade table and consequence chain are highlighted.",
    target: "ns-grades",
  },
  {
    icon: Layers,
    title: "Functional Outcomes",
    body: "The Outcomes tab shows continence and erectile recovery curves by nerve-sparing grade, letting you counsel the patient on the trade-off between oncologic safety and functional preservation. Modifiable factors appear on the left.",
    hint: "Explore both panels on this tab.",
    target: "outcomes",
  },
];

const TOTAL = STEPS.length;

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 8; // px of breathing room around the spotlight

function useSpotlight(target: string | null) {
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    if (!target) { setRect(null); return; }
    const el = document.querySelector(`[data-tutorial="${target}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
    });
  }, [target]);

  // Re-measure on step change, resize, and scroll
  useEffect(() => {
    if (!target) { setRect(null); return; }

    // Scroll target into view first, then measure after the scroll settles
    const el = document.querySelector(`[data-tutorial="${target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }

    // Measure after a short delay to let the scroll and any tab transitions settle
    const tid = setTimeout(() => {
      measure();
      // Keep re-measuring for a second in case layout is still settling
      let count = 0;
      const interval = setInterval(() => {
        measure();
        if (++count >= 5) clearInterval(interval);
      }, 80);
    }, 120);

    const onResize = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    return () => {
      clearTimeout(tid);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, measure]);

  return rect;
}

export function TutorialOverlay() {
  const step = useUiStore((s) => s.tutorialStep);
  const next = useUiStore((s) => s.nextTutorialStep);
  const prev = useUiStore((s) => s.prevTutorialStep);
  const end  = useUiStore((s) => s.endTutorial);

  const currentStep = step !== null ? STEPS[step] : null;
  const rect = useSpotlight(currentStep?.target ?? null);

  // Close on Escape
  useEffect(() => {
    if (step === null) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") end(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, end]);

  if (step === null || !currentStep) return null;

  const { icon: Icon, title, body, hint } = currentStep;
  const isLast = step === TOTAL - 1;

  return (
    <>
      {/* ── Spotlight overlay ────────────────────────────────────────────── */}
      {/*
        Uses the box-shadow trick: a fixed div the same size as the target,
        with an enormous inset box-shadow that darkens everything outside it.
        pointer-events:none so the user can still interact with the highlighted element.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[55] rounded-lg transition-all duration-300"
        style={
          rect
            ? {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                border: "2px solid hsl(var(--primary))",
                borderRadius: "10px",
              }
            : {
                // No target — just dim the whole screen
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                boxShadow: "none",
                background: "rgba(0,0,0,0.40)",
              }
        }
      />

      {/* ── Step card ────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`Tutorial step ${step + 1} of ${TOTAL}: ${title}`}
        className={cn(
          "fixed z-[56] w-[calc(100vw-2rem)] max-w-sm",
          "bottom-6 right-4 sm:right-6",
          "rounded-xl border border-border bg-card shadow-2xl shadow-black/40",
          "flex flex-col gap-0 overflow-hidden",
        )}
      >
        {/* Progress bar */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
          />
        </div>

        <div className="p-4 sm:p-5">
          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {step + 1} of {TOTAL}
                </p>
                <h2 className="text-sm font-bold leading-tight text-foreground">{title}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={end}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close tutorial"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>

          {/* Hint */}
          {hint && (
            <p className="mt-2.5 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              {hint}
            </p>
          )}

          {/* Nav */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={prev}
              disabled={step === 0}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === step ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
                  )}
                />
              ))}
            </div>

            <Button
              type="button"
              size="sm"
              onClick={isLast ? end : next}
              className="gap-1.5"
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
