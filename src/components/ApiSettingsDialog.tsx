import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkApiHealth,
  testLlmEndpoint,
  getApiUrl, setApiUrl,
  getHealthPath, setHealthPath,
  getLlmConfig, setLlmConfig,
  type LlmConfig,
} from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

type TestState = "idle" | "loading" | "ok" | "error";

function StatusRow({ state, detail }: { state: TestState; detail: string }) {
  if (state === "idle") return null;
  return (
    <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
      state === "ok"    ? "bg-emerald-500/10 text-emerald-400" :
      state === "error" ? "bg-red-500/10 text-red-400" :
                          "bg-muted/50 text-muted-foreground"
    }`}>
      {state === "loading" && <Loader2 className="mt-px h-3.5 w-3.5 shrink-0 animate-spin" />}
      {state === "ok"      && <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />}
      {state === "error"   && <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />}
      <span className="break-all">{state === "loading" ? "Testing…" : detail}</span>
    </div>
  );
}

export function ApiSettingsDialog({ open, onClose, onSave }: Props) {
  const [apiUrl, setApiUrlState] = useState(() => getApiUrl());
  const [healthPath, setHealthPathState] = useState(() => getHealthPath());
  const [llm, setLlm] = useState<LlmConfig>(() => getLlmConfig());
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const [healthState, setHealthState] = useState<TestState>("idle");
  const [healthDetail, setHealthDetail] = useState("");
  const [llmState, setLlmState] = useState<TestState>("idle");
  const [llmDetail, setLlmDetail] = useState("");

  if (!open) return null;

  const base = apiUrl.trim().replace(/\/$/, "");
  const resolvedPath = (healthPath.trim() || "/health").replace(/^([^/])/, "/$1");

  function resetTestStates() {
    setHealthState("idle");
    setLlmState("idle");
  }

  async function handleTestHealth() {
    setHealthState("loading");
    setHealthDetail("");
    try {
      const h = await checkApiHealth(base, resolvedPath);
      setHealthState("ok");
      setHealthDetail(`status: ${h.status} · model: ${h.model} · llm set: ${h.endpoint_set}`);
    } catch (e) {
      setHealthState("error");
      setHealthDetail(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleTestLlm() {
    setLlmState("loading");
    setLlmDetail("");
    try {
      const r = await testLlmEndpoint(base, llm);
      if (r.ok) {
        setLlmState("ok");
        setLlmDetail(`connected · model: ${r.model}`);
      } else {
        setLlmState("error");
        setLlmDetail(r.error ?? "LLM endpoint returned an error");
      }
    } catch (e) {
      setLlmState("error");
      setLlmDetail(e instanceof Error ? e.message : String(e));
    }
  }

  function handleSave() {
    setApiUrl(apiUrl);
    setHealthPath(healthPath);
    setLlmConfig(llm);
    onSave?.();
    onClose();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(resolvedPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="p-6">
          <h2 className="mb-1 text-base font-semibold text-foreground">API Settings</h2>
          <p className="mb-5 text-xs text-muted-foreground">
            All values saved to your browser — no rebuild or server restart needed.
          </p>

          {/* ── Backend URL ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="api-url" className="text-xs font-medium">Backend URL</Label>
            <Input
              id="api-url"
              type="url"
              placeholder="https://your-compass-api.onrender.com"
              value={apiUrl}
              onChange={(e) => { setApiUrlState(e.target.value); resetTestStates(); }}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              URL of your Render (or other) COMPASS backend service.
            </p>
          </div>

          <div className="my-5 border-t border-border/60" />

          {/* ── LLM config ──────────────────────────────────── */}
          <p className="mb-3 text-xs font-semibold text-foreground">LLM Endpoint</p>
          <p className="mb-3 text-[10px] text-muted-foreground">
            Sent to the backend on every AI request. Overrides the server's env vars.
          </p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="llm-endpoint" className="text-xs font-medium">Endpoint URL</Label>
              <Input
                id="llm-endpoint"
                type="url"
                placeholder="https://your-llm-host/v1/chat/completions"
                value={llm.endpoint}
                onChange={(e) => { setLlm(c => ({ ...c, endpoint: e.target.value })); setLlmState("idle"); }}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="llm-key" className="text-xs font-medium">API Key</Label>
              <div className="relative">
                <Input
                  id="llm-key"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-… (leave blank if not required)"
                  value={llm.api_key}
                  onChange={(e) => { setLlm(c => ({ ...c, api_key: e.target.value })); setLlmState("idle"); }}
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="llm-model" className="text-xs font-medium">Model</Label>
              <Input
                id="llm-model"
                type="text"
                placeholder="gpt-4o"
                value={llm.model}
                onChange={(e) => { setLlm(c => ({ ...c, model: e.target.value })); setLlmState("idle"); }}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Test LLM */}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={handleTestLlm}
            disabled={llmState === "loading"}
          >
            {llmState === "loading"
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Testing LLM…</>
              : "Test LLM endpoint"}
          </Button>
          <StatusRow state={llmState} detail={llmDetail} />

          <div className="my-5 border-t border-border/60" />

          {/* ── Health check (Render) ────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="health-path" className="text-xs font-medium">Health Check Path</Label>
              <span className="text-[10px] text-muted-foreground">Render monitoring</span>
            </div>
            <div className="flex gap-2">
              <Input
                id="health-path"
                type="text"
                placeholder="/health"
                value={healthPath}
                onChange={(e) => { setHealthPathState(e.target.value); setHealthState("idle"); }}
                className="font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleCopy}
                title="Copy path"
                className="shrink-0 rounded-md border border-border px-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Paste this path into Render → Settings → Health Check Path.
            </p>
          </div>

          {/* Test health */}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={handleTestHealth}
            disabled={healthState === "loading"}
          >
            {healthState === "loading"
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Checking…</>
              : "Test health endpoint"}
          </Button>
          <StatusRow state={healthState} detail={healthDetail} />

          {/* ── Actions ─────────────────────────────────────── */}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
