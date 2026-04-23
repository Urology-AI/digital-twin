import { useCallback, useEffect, useState } from "react";
import { getLlmUrl, testLlmEndpoint } from "@/lib/api";

export type ApiStatus = "checking" | "connected" | "disconnected";

export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>("checking");

  const recheck = useCallback(async () => {
    if (!getLlmUrl()) {
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

  useEffect(() => { recheck(); }, [recheck]);

  return { status, recheck };
}
