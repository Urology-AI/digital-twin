import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, UserRound } from "lucide-react";
import type { AccessIdentity } from "@/hooks/useAccessIdentity";

/**
 * The signed-in clinician's name (from Cloudflare Access). Click to open a
 * menu with "Sign out", which hits Access's own logout endpoint on this
 * host — it clears the CF_Authorization cookie and bounces back to the
 * Access login screen.
 */
export function AccessMenu({ identity }: { identity: AccessIdentity }) {
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

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:flex"
        title={`Signed in as ${identity.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserRound className="h-3.5 w-3.5" />
        <span className="max-w-[140px] truncate text-[11px] font-medium">
          {identity.name || identity.email}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ right: pos.right, top: pos.top }}
            className="fixed z-[70] w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
            role="menu"
          >
            <div className="border-b border-border px-3 py-2">
              <div className="text-[11px] font-semibold text-foreground">
                {identity.name || "Signed in"}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">{identity.email}</div>
            </div>
            <a
              href="/cdn-cgi/access/logout"
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              role="menuitem"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </a>
          </div>,
          document.body,
        )}
    </>
  );
}
