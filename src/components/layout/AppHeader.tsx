import React from "react";
import {
  Activity,
  BookOpen,
  ClipboardList,
  FlaskConical,
  Info,
  Layers,
  MessageCircle,
  Moon,
  Printer,
  Redo2,
  Share2,
  Sun,
  Undo2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore, type DesktopTab } from "@/store/uiStore";
import { printReport } from "@/lib/compass/printReport";
import { cn } from "@/lib/utils";
import { useAccessIdentity } from "@/hooks/useAccessIdentity";

const DESKTOP_TABS: { id: DesktopTab; label: string; Icon: React.ElementType }[] = [
  { id: "input",        label: "Input",       Icon: ClipboardList },
  { id: "predictions",  label: "Predictions", Icon: Activity },
  { id: "outcomes",     label: "Outcomes",    Icon: Layers },
  { id: "inflammation", label: "Inflammation", Icon: FlaskConical },
];

export function AppHeader() {
  const accessIdentity = useAccessIdentity();
  const chatOpen = useUiStore((s) => s.chatOpen);
  const setChatOpen = useUiStore((s) => s.setChatOpen);
  const saveStatus = useUiStore((s) => s.saveStatus);
  const setShareOpen = useUiStore((s) => s.setShareOpen);

  const dark = useUiStore((s) => s.dark);
  const setDark = useUiStore((s) => s.setDark);
  const desktopTab = useUiStore((s) => s.desktopTab);
  const setDesktopTab = useUiStore((s) => s.setDesktopTab);
  const setInfoOpen = useUiStore((s) => s.setInfoOpen);
  const setWelcomeOpen = useUiStore((s) => s.setWelcomeOpen);
  const setCaseLogOpen = useUiStore((s) => s.setCaseLogOpen);
  const setPatientView = useUiStore((s) => s.setPatientView);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const loading = usePatientStore((s) => s.loading);
  const setActive = usePatientStore((s) => s.setActive);
  const undo = usePatientStore((s) => s.undo);
  const redo = usePatientStore((s) => s.redo);

  const active = patients.find((p) => p.id === activeId);

  return (
    <header className="z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-md sm:px-4 supports-[backdrop-filter]:bg-card/85">
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

      {/* Divider */}
      <div className="hidden h-5 w-px shrink-0 bg-border/70 sm:block" />

      {/* Patient selector */}
      <div className="flex min-w-[110px] flex-1 items-center gap-2 sm:min-w-[160px] sm:max-w-[260px]">
        <label htmlFor="nav-patient" className="sr-only">Active patient</label>
        <select
          id="nav-patient"
          data-tutorial="patient-select"
          className={cn(
            "h-8 min-w-0 flex-1 cursor-pointer truncate rounded-lg border border-input/80 bg-muted/50 px-2.5 text-xs font-medium text-foreground shadow-none transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            "hover:bg-muted/80 sm:text-sm",
            (loading || patients.length === 0) && "opacity-60",
          )}
          value={activeId ?? ""}
          disabled={loading}
          onChange={(e) => setActive(e.target.value)}
        >
          {loading ? (
            <option value="">Loading cases…</option>
          ) : patients.length === 0 ? (
            <option value="">No patients loaded</option>
          ) : (
            patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>
        {active?.record._shareId && (
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
        {/* Undo/Redo */}
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            aria-label="Undo"
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
            onClick={() => redo()}
          >
            <Redo2 className="h-[15px] w-[15px]" />
            <span className="hidden text-xs font-medium lg:inline">Redo</span>
          </Button>
        </div>

        <div className="mx-1 h-4 w-px shrink-0 bg-border/60" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setDark(!dark)}
        >
          {dark ? (
            <Sun className="h-[15px] w-[15px] text-amber-400" />
          ) : (
            <Moon className="h-[15px] w-[15px] text-muted-foreground" />
          )}
          <span className="hidden text-xs font-medium lg:inline">{dark ? "Light" : "Dark"}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-emerald-500 hover:text-emerald-400"
          aria-label="Prospective case log"
          onClick={() => setCaseLogOpen(true)}
        >
          <BookOpen className="h-[15px] w-[15px]" />
          <span className="hidden text-xs font-medium lg:inline">Case log</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-blue-400 hover:text-blue-300"
          aria-label="Switch to patient view"
          title="Patient view"
          onClick={() => setPatientView(true)}
        >
          <UserRound className="h-[15px] w-[15px]" />
          <span className="hidden text-xs font-medium lg:inline">Patient view</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          aria-label="Share case"
          title="Share case"
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="h-[15px] w-[15px]" />
          <span className="hidden text-xs font-medium lg:inline">Share</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          aria-label="Print report"
          onClick={() => printReport()}
        >
          <Printer className="h-[15px] w-[15px]" />
          <span className="hidden text-xs font-medium lg:inline">Print</span>
        </Button>

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

        {/* Who's signed in via Cloudflare Access, if anyone (blank locally / on patient links) */}
        {accessIdentity && (
          <div
            className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground sm:flex"
            title={`Signed in as ${accessIdentity.email}`}
          >
            <UserRound className="h-3.5 w-3.5" />
            <span className="max-w-[140px] truncate text-[11px] font-medium">
              {accessIdentity.name || accessIdentity.email}
            </span>
          </div>
        )}

        {/* Local save status */}
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
            {saveStatus === "saving" ? "Saving" : "Saved"}
          </span>
        </div>

        {/* Chat assistant */}
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
      </div>

      {active && (
        <span className="sr-only" aria-live="polite">
          Active case: {active.name}
        </span>
      )}

    </header>
  );
}
