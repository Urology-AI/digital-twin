import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkApiHealth,
  fetchServerConfig,
  updateServerConfig,
  testLlmCustom,
  getApiUrl, setApiUrl,
  getHealthPath, setHealthPath,
  getAdminToken, setAdminToken,
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
  // Connection settings (stored in localStorage — not sensitive)
  const [apiUrl, setApiUrlState]       = useState(() => getApiUrl());
  const [healthPath, setHealthPathState] = useState(() => getHealthPath());
  const [adminToken, setAdminTokenState] = useState(() => getAdminToken());
  const [showToken, setShowToken]        = useState(false);

  // LLM config fields — sent to the server via PATCH /api/config, never stored locally
  const [llmEndpoint, setLlmEndpoint] = useState("");
  const [llmModel, setLlmModel]       = useState("");
  // Whether the server already has an endpoint set (loaded from GET /api/config)
  const [serverEndpointSet, setServerEndpointSet] = useState<boolean | null>(null);

  const [healthState, setHealthState] = useState<TestState>("idle");
  const [healthDetail, setHealthDetail] = useState("");
  const [llmState, setLlmState]         = useState<TestState>("idle");
  const [llmDetail, setLlmDetail]       = useState("");
  const [saving, setSaving]             = useState(false);
  const [copied, setCopied]             = useState(false);

  // Load current server config when dialog opens (requires admin token)
  useEffect(() => {
    if (!open) return;
    const token = getAdminToken();
    const base  = getApiUrl();
    if (!token || !base) return;
    fetchServerConfig(base)
      .then((cfg) => {
        setServerEndpointSet(cfg.endpoint_set);
        setLlmModel(cfg.model ?? "");
      })
      .catch(() => { /* token may not be set yet */ });
  }, [open]);

  if (!open) return null;

  const base         = apiUrl.trim().replace(/\/$/, "");
  const resolvedPath = (healthPath.trim() || "/health").replace(/^([^/])/, "/$1");

  async function handleTestHealth() {
    setHealthState("loading");
    setHealthDetail("");
    try {
      const h = await checkApiHealth(base, resolvedPath);
      setHealthState("ok");
      setHealthDetail(`server up · LLM configured: ${h.endpoint_set}`);
    } catch (e) {
      setHealthState("error");
      setHealthDetail(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleTestLlm() {
    setLlmState("loading");
    setLlmDetail("");
    try {
      // POST /api/test — admin-only, uses form values (falls back to server's stored values)
      const r = await testLlmCustom(
        { endpoint: llmEndpoint || undefined, model: llmModel || undefined },
        base,
      );
      if (r.ok) {
        setLlmState("ok");
        setLlmDetail("LLM endpoint reachable");
      } else {
        setLlmState("error");
        setLlmDetail(r.error ?? "LLM endpoint returned an error");
      }
    } catch (e) {
      setLlmState("error");
      setLlmDetail(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Persist connection settings to localStorage
      setApiUrl(apiUrl);
      setHealthPath(healthPath);
      setAdminToken(adminToken);

      // Push LLM config to server (only fields that were filled in)
      const patch: { endpoint?: string; model?: string } = {};
      if (llmEndpoint.trim()) patch.endpoint = llmEndpoint.trim();
      if (llmModel.trim() !== undefined) patch.model = llmModel.trim();
      if (Object.keys(patch).length > 0) {
        await updateServerConfig(patch, base);
        setServerEndpointSet(true);
      }

      onSave?.();
      onClose();
    } catch (e) {
      setLlmState("error");
      setLlmDetail(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
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
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">API Settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connection settings are saved in your browser. The LLM endpoint is stored server-side only.
            </p>
          </div>

          {/* ── Backend URL ───────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="api-url" className="text-xs font-medium">Backend URL</Label>
            <Input
              id="api-url"
              type="url"
              placeholder="https://your-compass-api.onrender.com"
              value={apiUrl}
              onChange={(e) => { setApiUrlState(e.target.value); setHealthState("idle"); }}
              className="font-mono text-xs"
            />
          </div>

          {/* ── Admin token ───────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="admin-token" className="text-xs font-medium">Admin Token</Label>
            <div className="relative">
              <Input
                id="admin-token"
                type={showToken ? "text" : "password"}
                placeholder="Set ADMIN_TOKEN on the server, paste it here"
                value={adminToken}
                onChange={(e) => setAdminTokenState(e.target.value)}
                className="pr-9 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Required to update the LLM endpoint. Not transmitted on AI requests.
            </p>
          </div>

          <div className="border-t border-border/60" />

          {/* ── LLM endpoint (server-side) ────────────────── */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground">LLM Endpoint</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Stored server-side only — never sent back to the browser.
                {serverEndpointSet === true && (
                  <span className="ml-1 text-emerald-400">Server has an endpoint configured.</span>
                )}
                {serverEndpointSet === false && (
                  <span className="ml-1 text-amber-400">No endpoint set on server yet.</span>
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="llm-endpoint" className="text-xs font-medium">
                Endpoint URL {serverEndpointSet && <span className="font-normal text-muted-foreground">(leave blank to keep existing)</span>}
              </Label>
              <Input
                id="llm-endpoint"
                type="url"
                placeholder="http://your-server:8000/v1/chat/completions"
                value={llmEndpoint}
                onChange={(e) => { setLlmEndpoint(e.target.value); setLlmState("idle"); }}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="llm-model" className="text-xs font-medium">
                Model <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="llm-model"
                type="text"
                placeholder="e.g. gemma4"
                value={llmModel}
                onChange={(e) => { setLlmModel(e.target.value); setLlmState("idle"); }}
                className="font-mono text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleTestLlm}
              disabled={llmState === "loading"}
            >
              {llmState === "loading"
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Testing LLM…</>
                : "Test LLM endpoint"}
            </Button>
            <StatusRow state={llmState} detail={llmDetail} />
          </div>

          <div className="border-t border-border/60" />

          {/* ── Health check path (Render) ────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="health-path" className="text-xs font-medium">Health Check Path</Label>
              <span className="text-[10px] text-muted-foreground">Render monitoring</span>
            </div>
            <div className="flex gap-2">
              <Input
                id="health-path"
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
              Paste into Render → Settings → Health Check Path.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleTestHealth}
              disabled={healthState === "loading"}
            >
              {healthState === "loading"
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Checking…</>
                : "Test health endpoint"}
            </Button>
            <StatusRow state={healthState} detail={healthDetail} />
          </div>

          {/* ── Actions ───────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
