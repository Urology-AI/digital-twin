import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Info,
  MoreHorizontal,
  Monitor,
  Printer,
  Share2,
  UserRound,
} from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { printReport } from "@/lib/compass/printReport";
import { isOfflineBuild } from "@/lib/offlineBuild";
import { cn } from "@/lib/utils";

/**
 * "More" dropdown for the header's secondary actions — the clinician tools
 * that don't need to be one click away (case log, patient summary, overview
 * mode, share, print, about). Keeps the top bar from overflowing on smaller
 * screens. Only rendered outside demo mode (AppHeader gates it).
 */
export function ToolsMenu() {
  const setInfoOpen = useUiStore((s) => s.setInfoOpen);
  const setCaseLogOpen = useUiStore((s) => s.setCaseLogOpen);
  const setShareOpen = useUiStore((s) => s.setShareOpen);
  const setPatientView = useUiStore((s) => s.setPatientView);
  const presenterView = useUiStore((s) => s.presenterView);
  const setPresenterView = useUiStore((s) => s.setPresenterView);

  const offline = isOfflineBuild();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ right: number; top: number }>({ right: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ right: window.innerWidth - r.right, top: r.bottom + 4 });
    setOpen((v) => !v);
  };

  const run = (fn: () => void) => () => { fn(); setOpen(false); };

  const items: { label: string; Icon: React.ElementType; onClick: () => void; active?: boolean }[] = [
    { label: "Case log", Icon: BookOpen, onClick: run(() => setCaseLogOpen(true)) },
    { label: "Patient summary", Icon: UserRound, onClick: run(() => setPatientView(true)) },
    {
      label: presenterView ? "Exit overview mode" : "Overview mode",
      Icon: Monitor,
      onClick: run(() => setPresenterView(!presenterView)),
      active: presenterView,
    },
    ...(!offline ? [{ label: "Share case", Icon: Share2, onClick: run(() => setShareOpen(true)) }] : []),
    { label: "Print report", Icon: Printer, onClick: run(() => printReport()) },
    { label: "About COMPASS", Icon: Info, onClick: run(() => setInfoOpen(true)) },
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
          open && "bg-muted/60 text-foreground",
        )}
        aria-label="More tools"
        title="More tools"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-[15px] w-[15px]" />
        <span className="hidden text-xs font-medium lg:inline">More</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ right: pos.right, top: pos.top }}
            className="fixed z-[70] w-52 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl"
            role="menu"
          >
            {items.map(({ label, Icon, onClick, active }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={onClick}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                  active && "text-violet-400",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
