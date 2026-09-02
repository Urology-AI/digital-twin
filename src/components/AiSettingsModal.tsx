import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Settings2, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getLlmMode, isAiParsingEnabled, LLM_OFF, setAiParsingEnabled, setLlmConfig, testLlmEndpoint,
  type LlmMode,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiStatus } from "@/hooks/useApiStatus";

interface Props {
  status: ApiStatus;
  onRecheck: () => void;
  onClose: () => void;
}

export function AiSettingsModal({ status, onRecheck, onClose }: Props) {
  const [mode, setMode] = useState<LlmMode>(() => getLlmMode());
  const [url, setUrl] = useState(() => {
    const raw = localStorage.getItem("compass_llm_url") ?? "";
    return raw === LLM_OFF ? "" : raw;
  });
  const [model, setModel] = useState(() => localStorage.getItem("compass_llm_model") ?? "");
  const [key, setKey] = useState(() => localStorage.getItem("compass_llm_key") ?? "");
  const [aiParse, setAiParse] = useState(() => isAiParsingEnabled());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const savedMode = getLlmMode();
  const savedProvider =
    savedMode === "offline" ? "offline" : savedMode === "custom" ? "custom endpoint" : "Google Gemini";

  const clearTest = () => setTestResult(null);

  async function handleTest() {
    if (mode === "custom" && !url.trim()) {
      setTestResult({ ok: false, error: "Enter your endpoint URL first" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testLlmEndpoint(
        mode === "custom" ? url.trim() : undefined,
        mode === "custom" ? key : undefined,
        mode === "custom" ? model : undefined,
      );
      setTestResult({ ok: r.ok, error: r.error });
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    if (mode === "offline") {
      setLlmConfig({ url: LLM_OFF, model: "", key: "" });
      setAiParsingEnabled(false);
    } else if (mode === "custom") {
      setLlmConfig({ url, model, key });
      setAiParsingEnabled(aiParse);
    } else {
      setLlmConfig({ url: "", model: "", key: "" });
      setAiParsingEnabled(aiParse);
    }
    onRecheck();
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AI Settings"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">AI Settings</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Connection status — reflects the currently saved provider */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            {savedMode === "offline" ? (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            ) : status === "connected" ? (
              <Wifi className="h-5 w-5 text-emerald-400" />
            ) : status === "checking" ? (
              <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {savedMode === "offline"
                  ? "Offline mode — no AI provider"
                  : status === "connected"
                    ? `Connected — ${savedProvider}`
                    : status === "checking"
                      ? "Checking connection…"
                      : `Unreachable — ${savedProvider}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {savedMode === "offline"
                  ? "Predictions run in-browser; AI chat and note parsing are disabled"
                  : status === "connected"
                    ? "AI chat and note parsing are available"
                    : status === "checking"
                      ? "Testing the AI endpoint"
                      : "AI chat unavailable — offline predictions still work"}
              </p>
            </div>
            <span className={cn(
              "h-3 w-3 shrink-0 rounded-full",
              savedMode === "offline"   && "bg-muted-foreground/50",
              savedMode !== "offline" && status === "connected"    && "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]",
              savedMode !== "offline" && status === "disconnected" && "bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.4)]",
              savedMode !== "offline" && status === "checking"     && "animate-pulse bg-yellow-400",
            )} />
          </div>

          {/* Provider choice — 3 tiers */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">AI provider</span>
            <div className="space-y-1.5">
              {([
                { id: "offline", title: "Offline only", sub: "No AI. Predictions run in your browser; chat & note parsing disabled." },
                { id: "hosted", title: "Google Gemini (predefined)", sub: "Hosted proxy — no setup or key needed." },
                { id: "custom", title: "Custom LLM API", sub: "OpenAI / Anthropic / vLLM — your endpoint URL + API key." },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setMode(opt.id); clearTest(); }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition",
                    mode === opt.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <span className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border",
                    mode === opt.id ? "border-primary bg-primary" : "border-muted-foreground/40",
                  )} />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{opt.sub}</span>
                  </span>
                </button>
              ))}
            </div>

            {mode === "custom" && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="space-y-1">
                  <label htmlFor="llm-url" className="text-[11px] font-medium text-muted-foreground">Endpoint URL</label>
                  <input
                    id="llm-url"
                    type="url"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); clearTest(); }}
                    placeholder="https://api.openai.com/v1/chat/completions"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="llm-key" className="text-[11px] font-medium text-muted-foreground">API key</label>
                  <input
                    id="llm-key"
                    type="password"
                    value={key}
                    onChange={(e) => { setKey(e.target.value); clearTest(); }}
                    placeholder="sk-…"
                    autoComplete="off"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="llm-model" className="text-[11px] font-medium text-muted-foreground">Model <span className="text-muted-foreground/60">(optional)</span></label>
                  <input
                    id="llm-model"
                    type="text"
                    value={model}
                    onChange={(e) => { setModel(e.target.value); clearTest(); }}
                    placeholder="gpt-4o-mini"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Key is stored in this browser's localStorage and sent only to the URL above.
                </p>
              </div>
            )}

            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
              Do not enter PHI or patient identifiers anywhere in this tool.
            </p>
          </div>

          {/* AI note parsing — off by default, sends text off-device when on */}
          {mode !== "offline" && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={aiParse}
                onChange={(e) => setAiParse(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  Use AI to parse clinical notes
                </span>
                <span className="block text-xs text-muted-foreground">
                  {aiParse ? (
                    <><span className="font-semibold text-amber-500">On:</span> pasted note text is
                    de-identified in your browser, then sent to{" "}
                    <span className="font-semibold">{mode === "custom" ? "your configured endpoint" : "Google Gemini"}</span>{" "}
                    for field extraction.</>
                  ) : (
                    <><span className="font-semibold text-emerald-500">Off:</span> notes are parsed
                    entirely offline in your browser. No note text leaves this device.</>
                  )}
                </span>
              </span>
            </label>
          </div>
          )}

          {testResult && (
            <div className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              testResult.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300",
            )}>
              {testResult.ok ? "Connection successful." : testResult.error || "Connection failed."}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button" variant="secondary" size="sm" className="flex-1"
              onClick={handleTest} disabled={testing || mode === "offline"}
            >
              {testing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Testing...</> : "Test connection"}
            </Button>
            <Button type="button" size="sm" className="flex-1" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
