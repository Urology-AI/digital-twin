import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { useAccessIdentity } from "@/hooks/useAccessIdentity";

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

/**
 * Root ("/") — the only path Cloudflare Access has no application on, so
 * it must stay genuinely public (no clinical data, no login prompt).
 * Clinicians go to /clinical (gated by Access); patient links are
 * /patient/<id> (separate, also open, handled by PatientView instead).
 *
 * Styled after WelcomeScreen.tsx (logo, badges, QR code) but without the
 * feature cards / tutorial CTA — this page's only job is to route the two
 * audiences that land here.
 */
export function PublicLandingPage() {
  const accessIdentity = useAccessIdentity();

  // A clinician who's already signed in via Cloudflare Access doesn't need
  // to see the public welcome page or click "Clinician sign in" again —
  // send them straight into the app.
  useEffect(() => {
    if (accessIdentity) window.location.href = "/clinical";
  }, [accessIdentity]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-5 bg-background px-4 py-10 text-center">
      <MountSinaiMark className="h-auto w-auto" style={{ height: "3rem" }} />

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-amber-500">
          Research Use Only
        </span>
        <span className="text-[0.6875rem] text-muted-foreground/70">IRB STUDY-14-00050</span>
      </div>

      <div>
        <h1 className="text-4xl font-black tracking-tight text-foreground">COMPASS</h1>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.22em] text-primary">
          Prostate cancer · Surgical outcomes
        </p>
      </div>

      <p className="max-w-md text-sm text-muted-foreground">
        Patients: please use the link shared with you to view your case.
        Clinicians and staff sign in below.
      </p>

      <Button
        type="button"
        size="lg"
        className="font-semibold shadow-md shadow-primary/20"
        onClick={() => { window.location.href = "/clinical"; }}
      >
        Clinician sign in
      </Button>

      <div className="mt-2 flex flex-col items-center gap-2">
        <div className="rounded-md bg-white p-2 shadow-sm ring-1 ring-border/60">
          <QRCodeSVG
            value={APP_URL}
            size={96}
            level="M"
            marginSize={0}
            aria-label={`QR code linking to ${APP_URL}`}
          />
        </div>
        <a
          href={APP_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[0.6875rem] text-muted-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          Scan to open · urology-ai.github.io/digital-twin
        </a>
      </div>
    </div>
  );
}
