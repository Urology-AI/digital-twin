import { useState } from "react";
import { Loader2, Settings2, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiUrl, setApiUrl, testLlmEndpoint } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiStatus } from "@/hooks/useApiStatus";

interface Props {
  status: ApiStatus;
  onRecheck: () => void;
  onClose: () => void;
}

export function AiSettingsModal({ status, onRecheck, onClose }: Props) {
  const [url, setUrl] = useState(getApiUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);

  async function handleTest() {
    const trimmed = url.trim().replace(/\/$/, "");
    if (!trimmed) {
      setTestResult({ ok: false, error: "Enter a backend URL first" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testLlmEndpoint(trimmed);
      setTestResult({ ok: r.ok, error: r.error });
    } catch (e) {
      setTestResult({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    setApiUrl(url.trim());
    onRecheck();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AI Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              AI Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Connection status */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            {status === "connected" ? (
              <Wifi className="h-5 w-5 text-emerald-400" />
            ) : status === "checking" ? (
              <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {status === "connected"
                  ? "Connected"
                  : status === "checking"
                    ? "Checking..."
                    : "Disconnected"}
              </p>
              <p className="text-xs text-muted-foreground">
                {status === "connected"
                  ? "AI backend is reachable and responding"
                  : status === "checking"
                    ? "Testing connection to the backend"
                    : "Cannot reach the AI backend"}
              </p>
            </div>
            <span
              className={cn(
                "h-3 w-3 shrink-0 rounded-full",
                status === "connected" &&
                  "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]",
                status === "disconnected" &&
                  "bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.4)]",
                status === "checking" && "animate-pulse bg-yellow-400",
              )}
            />
          </div>

          {/* Backend URL */}
          <div className="space-y-2">
            <label
              htmlFor="ai-backend-url"
              className="text-xs font-medium text-muted-foreground"
            >
              Backend URL
            </label>
            <input
              id="ai-backend-url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
              placeholder="https://your-backend.onrender.com"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">
              The FastAPI backend that proxies to your LLM endpoint (vLLM,
              OpenAI-compatible, etc.)
            </p>
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300",
              )}
            >
              {testResult.ok
                ? "Connection successful — endpoint is reachable."
                : testResult.error || "Connection failed."}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
