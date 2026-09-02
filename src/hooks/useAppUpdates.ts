import { useCallback, useEffect, useState } from "react";
import { isOfflineBuild } from "@/lib/offlineBuild";

/**
 * Update state for the running build, shared by the header badge and the info
 * panel footer so both say the same thing.
 *
 * Desktop (packaged app): electron-updater drives it through window.desktop —
 * `refresh` restarts into a downloaded update, or re-checks the feed when there
 * is nothing waiting.
 * Web: the same Worker feed reports the current released version; a long-lived
 * tab otherwise sits on stale code until someone happens to reload, so
 * `refresh` there is a reload. Silent on the offline build.
 */
export interface AppUpdateState {
  /** human-readable status, or null when there is nothing to say */
  status: string | null;
  /** a newer version is available (web) or downloaded (desktop) */
  ready: boolean;
  /** version of the waiting update, once one is known */
  latest: string | null;
  /** a check is in flight */
  checking: boolean;
  /** an update is downloading (desktop only) */
  downloading: boolean;
  /** desktop: restart into the update (or re-check); web: reload */
  refresh: () => void;
  desktop: boolean;
}

export function useAppUpdates(): AppUpdateState {
  const [status, setStatus] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [latest, setLatest] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const desktop = typeof window !== "undefined" ? window.desktop : undefined;

  useEffect(() => {
    if (desktop || isOfflineBuild()) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/updates/latest.json", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (!cancelled && version && version !== __APP_VERSION__) {
          setStatus(`v${version} available — refresh to update`);
          setLatest(version);
          setReady(true);
        }
      } catch {
        /* offline, or the feed is unreachable — nothing useful to say */
      }
    };
    void check();
    const id = window.setInterval(check, 30 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    return desktop.onUpdateEvent((e) => {
      setReady(e.type === "downloaded");
      setChecking(e.type === "checking");
      setDownloading(e.type === "available");
      if (e.version) setLatest(e.version);
      setStatus(
        e.type === "checking" ? "Checking…"
        : e.type === "available" ? `Downloading ${e.version}…`
        : e.type === "downloaded" ? `Update ${e.version} ready — restart to apply`
        : e.type === "none" ? "Up to date"
        : e.type === "error" ? `Update check failed${e.message ? `: ${e.message}` : ""}` : null,
      );
    });
  }, [desktop]);

  const refresh = useCallback(() => {
    if (!desktop) {
      window.location.reload();
      return;
    }
    // installUpdate is absent in builds packaged before it existed — those
    // still get the updater's own restart dialog.
    if (ready && desktop.installUpdate) {
      void desktop.installUpdate();
      return;
    }
    setStatus("Checking…");
    setChecking(true);
    void desktop.checkForUpdates();
  }, [desktop, ready]);

  return { status, ready, latest, checking, downloading, refresh, desktop: !!desktop };
}
