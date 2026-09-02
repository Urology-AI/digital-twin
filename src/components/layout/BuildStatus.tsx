import { RefreshCw } from "lucide-react";
import { useAppUpdates } from "@/hooks/useAppUpdates";
import { cn } from "@/lib/utils";

/**
 * Footer-left build line: the running version and the update control (which
 * build it is shows as a word in the header). Only the desktop app installs —
 * on the web the icon reloads the tab into a newer build when the feed reports
 * one, and is otherwise absent.
 */
export function BuildStatus() {
  const { status, ready, latest, checking, downloading, refresh, desktop } = useAppUpdates();
  const busy = checking || downloading;

  const label = ready
    ? `v${latest ?? "new"} ready · update now`
    : downloading
      ? `downloading v${latest ?? "…"}`
      : checking
        ? "checking…"
        : null;

  return (
    <span className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
      <span className="tabular-nums" title="Build version">v{__APP_VERSION__}</span>
      {(desktop || ready) && (
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          title={status ?? (desktop ? "Check for updates" : "Reload into the new build")}
          aria-label={ready ? "Apply update" : "Check for updates"}
          className={cn(
            "flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted/70 hover:text-foreground",
            ready && "text-sky-500 dark:text-sky-400",
          )}
        >
          <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} />
          {label}
        </button>
      )}
    </span>
  );
}
