import { useEffect, useState } from "react";
import { isOfflineBuild } from "@/lib/offlineBuild";

/**
 * Who's currently signed in via Cloudflare Access, if anyone. Access handles
 * this endpoint directly at Cloudflare's edge (not our Worker, not GitHub
 * Pages) — it reads the CF_Authorization session cookie already set at
 * login and returns the identity as JSON. No server code of ours involved.
 *
 * Returns null when there's no Access session — locally in dev (endpoint
 * doesn't exist), on the unauthenticated /patient/* path (Access is
 * configured to bypass it there), or if Access isn't set up on the domain
 * yet. Never throws.
 */
export interface AccessIdentity {
  email: string;
  name?: string;
}

export function useAccessIdentity(): AccessIdentity | null {
  const [identity, setIdentity] = useState<AccessIdentity | null>(null);

  useEffect(() => {
    if (isOfflineBuild()) return; // no sign-in in the offline app
    let cancelled = false;
    fetch("/cdn-cgi/access/get-identity", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.email) return;
        setIdentity({ email: data.email, name: data.name });
      })
      .catch(() => { /* no Access session — expected locally and for patient links */ });
    return () => { cancelled = true; };
  }, []);

  return identity;
}
