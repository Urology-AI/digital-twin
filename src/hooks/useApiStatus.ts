import { useCallback, useEffect, useState } from "react";
import { getApiUrl, testLlmEndpoint } from "@/lib/api";

export type ApiStatus = "checking" | "connected" | "disconnected";

export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>("checking");

  const recheck = useCallback(async () => {
    if (!getApiUrl()) {
      // No URL configured — can't check
      setStatus("disconnected");
      return;
    }
    setStatus("checking");
    try {
      const r = await testLlmEndpoint();
      setStatus(r.ok ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    }
  }, []);

  // Check once on mount
  useEffect(() => { recheck(); }, [recheck]);

  return { status, recheck };
}
