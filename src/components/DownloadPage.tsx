import { useEffect, useState } from "react";
import { Apple, Download, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * /clinical/download — the offline desktop app.
 *
 * Sits under /clinical so Cloudflare Access gates it: the installers are for
 * Mount Sinai staff, not the public web. The releases repo is private, so the
 * binaries are not linked from GitHub — the Worker streams them (and reports
 * the current version) through /api/updates/*, the same feed the installed app
 * auto-updates from.
 */
const BUILDS = [
  {
    id: "mac",
    label: "macOS",
    file: (v: string) => `COMPASS-Digital-Twin-${v}-arm64.dmg`,
    note: "macOS 12 or later, Apple Silicon (M1 and newer). Signed and notarized by Apple.",
    match: () => /Mac/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent),
  },
  {
    id: "win",
    label: "Windows",
    file: (v: string) => `COMPASS-Digital-Twin-${v}-x64.exe`,
    note: "Windows 10 or later, 64-bit. Code-signed installer, per-user install.",
    match: () => /Win/i.test(navigator.platform) || /Windows/i.test(navigator.userAgent),
  },
] as const;

function MountSinaiMark() {
  return (
    <>
      <img src={`${import.meta.env.BASE_URL}logo_light.png`} alt="Mount Sinai" className="block w-44 dark:hidden" />
      <img src={`${import.meta.env.BASE_URL}logo_dark.png`} alt="Mount Sinai" className="hidden w-44 dark:block" />
    </>
  );
}

export function DownloadPage() {
  const [version, setVersion] = useState<string | null>(null);
  const [releasedAt, setReleasedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/updates/latest.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`feed returned ${res.status}`);
        const data = (await res.json()) as { version?: string; releasedAt?: string };
        if (cancelled) return;
        if (!data.version) throw new Error("no version in feed");
        setVersion(data.version);
        setReleasedAt(data.releasedAt ?? null);
      } catch {
        if (!cancelled) setError("Could not reach the release feed. Try again in a moment.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen overflow-y-auto bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,174,239,0.20),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(213,0,91,0.16),transparent_55%)]"
      />
      <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-14">
        <div className="flex flex-col gap-4">
          <MountSinaiMark />
          <h1 className="text-3xl font-semibold tracking-tight">COMPASS Digital Twin — desktop app</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The offline build for Mac and Windows. Every prediction model, the 3D viewer and the
            case library run entirely on the machine — no network calls, no patient data leaves
            the device. Cloud features (chat, note parsing, sync and share links) are compiled out.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur">
          {error ? (
            <p className="text-sm text-amber-500">{error}</p>
          ) : !version ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking for the latest build…
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {BUILDS.map((b) => {
                const mine = (() => { try { return b.match(); } catch { return false; } })();
                return (
                  <div key={b.id} className="flex flex-col gap-2">
                    <Button asChild size="lg" variant={mine ? "default" : "outline"} className="w-full sm:w-auto">
                      <a href={`/api/updates/${b.file(version)}`} download>
                        <Download className="mr-2 h-4 w-4" />
                        Download for {b.label} — v{version}
                      </a>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {b.id === "mac" && <Apple className="mr-1 inline h-3 w-3" />}
                      {b.note} The app updates itself after install.
                    </p>
                  </div>
                );
              })}
              {releasedAt && (
                <p className="text-[11px] text-muted-foreground/70">
                  Released {new Date(releasedAt).toLocaleDateString()}.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <h2 className="text-sm font-semibold text-foreground">Installing</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Mac</strong> — open the <code>.dmg</code> and drag
              COMPASS Digital Twin into Applications.
            </li>
            <li>
              <strong className="text-foreground">Windows</strong> — run the <code>.exe</code>; it
              installs for the current user, no admin rights needed.
            </li>
          </ul>
          <p>
            There is no sign-in: the app works with no network. On first launch it checks whether
            the machine is Mount Sinai–managed and says so on screen.
          </p>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            For Mount Sinai clinical and research staff. Research tool only — not a medical
            device, not FDA cleared, and no substitute for clinical judgment. Use is governed by
            IRB STUDY-14-00050.
          </span>
        </p>
      </div>
    </div>
  );
}
