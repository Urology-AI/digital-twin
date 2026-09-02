import { Lock, LockOpen } from "lucide-react";
import { useAccessIdentity } from "@/hooks/useAccessIdentity";
import { useDeviceEnrollment } from "@/hooks/useDeviceEnrollment";
import { isDemoMode } from "@/lib/demoMode";
import { isOfflineBuild } from "@/lib/offlineBuild";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex shrink-0 cursor-default items-center gap-1 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider";

/**
 * Every status chip, in the footer.
 *
 * Web: which session you are in — Clinical with a signed-in Access session,
 * Demo on the public preview, Restricted with no session.
 * Offline app: which build this is, and whether the machine is enrolled in
 * device management (advisory — the machine reports on itself, so it is
 * display, never a gate; see electron/managed.cjs).
 *
 * These sat next to the wordmark until the header bar was needed for the case
 * controls. None of them changes while you work, so the footer is the honest
 * home for them.
 */
export function StatusChips() {
  const accessIdentity = useAccessIdentity();
  const enrollment = useDeviceEnrollment();

  if (isOfflineBuild()) {
    return (
      <>
        <span
          title="Offline build — everything runs on this device. No login, no cloud, no data leaves the machine."
          className={cn(chip, "bg-muted text-muted-foreground")}
        >
          Local
        </span>
        {enrollment && (
          <span
            title={`${enrollment.detail}${enrollment.org ? ` Organisation: ${enrollment.org}.` : ""} Informational only.`}
            className={cn(chip, "bg-muted text-muted-foreground")}
          >
            {enrollment.managed ? "Managed" : "Unmanaged"}
          </span>
        )}
      </>
    );
  }

  if (accessIdentity) {
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

  if (isDemoMode()) {
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
