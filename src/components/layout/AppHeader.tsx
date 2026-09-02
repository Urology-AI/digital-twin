import React from "react";
import {
  Activity,
  ClipboardList,
  FlaskConical,
  Info,
  Layers,
  ListChecks,
  Lock,
  LockOpen,
  MessageCircle,
  Moon,
  Redo2,
  Sun,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore, type DesktopTab } from "@/store/uiStore";
import { CasePicker } from "@/components/layout/CasePicker";
import { AccessMenu } from "@/components/layout/AccessMenu";
import { ToolsMenu } from "@/components/layout/ToolsMenu";
import { cn } from "@/lib/utils";
import { useAccessIdentity } from "@/hooks/useAccessIdentity";
import { isDemoMode } from "@/lib/demoMode";
import { useDeviceEnrollment } from "@/hooks/useDeviceEnrollment";
import { isOfflineBuild } from "@/lib/offlineBuild";

const DESKTOP_TABS: { id: DesktopTab; label: string; Icon: React.ElementType }[] = [
  { id: "input",        label: "Input",       Icon: ClipboardList },
  { id: "predictions",  label: "Predictions", Icon: Activity },
  { id: "outcomes",     label: "Factors",     Icon: Layers },
  { id: "plan",         label: "Planning",    Icon: FlaskConical },
];

/**
 * Desktop only: whether this machine is enrolled in Sinai device management.
 * Advisory — the machine reports on itself, so it is display, not a gate
 * (see electron/managed.cjs). Silent until the check comes back, and on
 * builds packaged before it existed.
 */
function ManagedBadge({ chip }: { chip: string }) {
  const enrollment = useDeviceEnrollment();
  if (!enrollment) return null;
  const sinai = enrollment.managed && enrollment.org !== null;
  return (
    <span
      title={`${enrollment.detail}${enrollment.org ? ` Organisation: ${enrollment.org}.` : ""} Informational only.`}
      className={cn(
        chip,
        sinai
          ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {enrollment.managed ? "Managed" : "Unmanaged"}
    </span>
  );
}

/**
 * One word next to the wordmark for which build you are in: Clinical with a
 * signed-in Access session, Local in the offline desktop app, Demo on the
 * public preview, and Restricted on the web with no session. The build
 * version and the update control live in the footer (see BuildStatus).
 */
function StatusBadge({ signedIn, demo }: { signedIn: boolean; demo: boolean }) {
  const chip =
    "hidden shrink-0 cursor-default items-center gap-1 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider sm:inline-flex";

  if (isOfflineBuild()) {
    return (
      <>
        <span
          title="Offline build — everything runs on this device. No login, no cloud, no data leaves the machine."
          className={cn(chip, "bg-amber-500/15 text-amber-600 dark:text-amber-400")}
        >
          Local
        </span>
        <ManagedBadge chip={chip} />
      </>
    );
  }

  if (signedIn) {
    return (
      <span
        title="Signed in through Cloudflare Access"
        className={cn(chip, "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")}
      >
        <Lock className="h-3 w-3" />
        Clinical
      </span>
    );
  }

  if (demo) {
    return (
      <span
        title="Public preview — sample cases only, nothing is saved"
        className={cn(chip, "bg-muted text-muted-foreground")}
      >
        Demo
      </span>
    );
  }

  // No Access session: the open lock is about who you are, not how the page was
  // served — the connection itself is still TLS.
  return (
    <span
      title="Restricted — no Cloudflare Access session, so no patient data loads"
      className={cn(chip, "bg-red-500/15 text-red-600 dark:text-red-400")}
    >
      <LockOpen className="h-3 w-3" />
      Restricted
    </span>
  );
}

export function AppHeader() {
  const accessIdentity = useAccessIdentity();
  const chatOpen = useUiStore((s) => s.chatOpen);
  const setChatOpen = useUiStore((s) => s.setChatOpen);
  const saveStatus = useUiStore((s) => s.saveStatus);

  const dark = useUiStore((s) => s.dark);
  const setDark = useUiStore((s) => s.setDark);
  const desktopTab = useUiStore((s) => s.desktopTab);
  const setDesktopTab = useUiStore((s) => s.setDesktopTab);
  const overview = useUiStore((s) => s.overview);
  const setOverview = useUiStore((s) => s.setOverview);
  const setInfoOpen = useUiStore((s) => s.setInfoOpen);
  const setWelcomeOpen = useUiStore((s) => s.setWelcomeOpen);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const undo = usePatientStore((s) => s.undo);
  const redo = usePatientStore((s) => s.redo);

  const active = patients.find((p) => p.id === activeId);
  const demo = isDemoMode();
  const offline = isOfflineBuild();

  return (
    <header className="z-40 flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-card/95 px-3 backdrop-blur-md sm:px-4 supports-[backdrop-filter]:bg-card/85">
      {/* Brand — click to reopen welcome screen */}
      <button
        type="button"
        onClick={() => setWelcomeOpen(true)}
        className="flex shrink-0 items-center rounded-md text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label="Open welcome screen"
      >
        <span className="text-sm font-black tracking-tight text-foreground sm:text-base">
          COMPASS
        </span>
      </button>

      <StatusBadge signedIn={!!accessIdentity} demo={demo} />

      {/* Divider */}
      <div className="hidden h-5 w-px shrink-0 bg-border/70 sm:block" />

      {/* Case selector — sample cases only in the public preview */}
      <div className="flex min-w-[130px] flex-1 items-center gap-2 sm:min-w-[190px] sm:max-w-[300px]">
        <CasePicker sampleOnly={demo} />
        {!demo && !offline && active?.record._shareId && (
          <span
            title={`Share ID: ${active.record._shareId}`}
            className="hidden shrink-0 cursor-default rounded bg-sky-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-sky-400 sm:inline"
          >
            Shared · {active.record._shareId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Desktop tab switcher */}
      <div className="hidden lg:flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5 mx-auto">
        {DESKTOP_TABS.map(({ id, label, Icon }) => {
          const active = desktopTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setDesktopTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                active
                  ? "bg-card shadow-sm text-foreground ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                  : "text-muted-foreground hover:bg-background/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {/* Right actions */}
      <div className="ml-auto lg:ml-0 flex shrink-0 items-center gap-0.5">
        {/* Overview: every tab collapses to its key points until switched off */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={overview}
          className={cn(
            "h-8 gap-1.5 px-2",
            overview ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:text-foreground",
          )}
          title={overview ? "Show the full detail on every tab" : "Collapse every tab to its key points"}
          onClick={() => setOverview(!overview)}
        >
          <ListChecks className="h-[15px] w-[15px]" />
          <span className="hidden text-xs font-medium lg:inline">Overview</span>
        </Button>

        <div className="mx-1 h-4 w-px shrink-0 bg-border/60" />

        {/* Undo/Redo — editing is disabled in the public preview */}
        {!demo && (
          <>
            <div className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                aria-label="Undo"
                title="Undo last change"
                onClick={() => undo()}
              >
                <Undo2 className="h-[15px] w-[15px]" />
                <span className="hidden text-xs font-medium lg:inline">Undo</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                aria-label="Redo"
                title="Redo last undone change"
                onClick={() => redo()}
              >
                <Redo2 className="h-[15px] w-[15px]" />
                <span className="hidden text-xs font-medium lg:inline">Redo</span>
              </Button>
            </div>

            <div className="mx-1 h-4 w-px shrink-0 bg-border/60" />
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setDark(!dark)}
        >
          {dark ? (
            <Sun className="h-[15px] w-[15px] text-amber-400" />
          ) : (
            <Moon className="h-[15px] w-[15px] text-muted-foreground" />
          )}
          <span className="hidden text-xs font-medium lg:inline">{dark ? "Light" : "Dark"}</span>
        </Button>

        {!demo ? (
          <ToolsMenu />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex h-8 gap-1.5 px-2 text-muted-foreground hover:text-primary"
            aria-label="About COMPASS"
            onClick={() => setInfoOpen(true)}
          >
            <Info className="h-[15px] w-[15px]" />
            <span className="hidden text-xs font-medium lg:inline">About</span>
          </Button>
        )}

        {/* Who's signed in via Cloudflare Access — click for "Sign out"
            (blank locally / on patient links / in the public preview) */}
        {accessIdentity && <AccessMenu identity={accessIdentity} />}

        {/* Clinician sign-in — demo build only */}
        {demo && (
          <a
            href="/clinical"
            className="hidden shrink-0 items-center rounded-md px-2 py-1 text-[11px] font-semibold text-primary hover:underline sm:flex"
          >
            Clinician sign in
          </a>
        )}

        {/* Local save status — hidden in the demo build (nothing is saved) */}
        {!demo && (
        <div
          className="hidden sm:flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground"
          title={saveStatus === "saving" ? "Saving locally…" : "All changes saved locally"}
        >
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              saveStatus === "saving"
                ? "animate-pulse bg-yellow-400"
                : "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.6)]",
            )}
          />
          <span className="hidden text-[10px] font-medium sm:inline">
            {saveStatus === "saving" ? "Saving…" : "Saved locally"}
          </span>
        </div>
        )}

        {/* Chat assistant — clinician tool, hidden in the public preview */}
        {!demo && (
          <button
            type="button"
            className={cn(
              "flex items-center rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60 hover:text-foreground",
              chatOpen ? "text-primary" : "text-muted-foreground",
            )}
            aria-label="Open chat assistant"
            onClick={() => setChatOpen(!chatOpen)}
            title="Ask the assistant"
          >
            <MessageCircle className="h-[15px] w-[15px]" />
          </button>
        )}
      </div>

      {active && (
        <span className="sr-only" aria-live="polite">
          Active case: {active.name}
        </span>
      )}

    </header>
  );
}
