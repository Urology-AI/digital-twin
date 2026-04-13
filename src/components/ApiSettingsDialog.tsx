import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkApiHealth,
  testLlmEndpoint,
  getApiUrl,
  setApiUrl,
  getHealthPath,
  setHealthPath,
} from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

type TestState = "idle" | "loading" | "ok" | "error";

function StatusBadge({ state, detail }: { state: TestState; detail: string }) {
  if (state === "idle") return null;
  return (
    <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
      state === "ok"      ? "bg-emerald-500/10 text-emerald-400" :
      state === "error"   ? "bg-red-500/10 text-red-400" :
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
  const [url, setUrl] = useState(() => getApiUrl());
  const [healthPath, setHealthPathState] = useState(() => getHealthPath());
  const [copied, setCopied] = useState(false);

  const [healthState, setHealthState] = useState<TestState>("idle");
  const [healthDetail, setHealthDetail] = useState("");

  const [llmState, setLlmState] = useState<TestState>("idle");
  const [llmDetail, setLlmDetail] = useState("");

  if (!open) return null;

  const base = url.trim().replace(/\/$/, "");
  const resolvedPath = (healthPath.trim() || "/health").replace(/^([^/])/, "/$1");

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
      const r = await testLlmEndpoint(base);
      if (r.ok) {
        setLlmState("ok");
        setLlmDetail(`model: ${r.model} · endpoint reachable`);
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
    setApiUrl(url);
    setHealthPath(healthPath);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="mb-1 text-base font-semibold text-foreground">API Settings</h2>
        <p className="mb-5 text-xs text-muted-foreground">
          Saved to your browser — no rebuild needed.
        </p>

        {/* Backend URL */}
        <div className="space-y-1.5">
          <Label htmlFor="api-url" className="text-xs font-medium">Backend URL</Label>
          <Input
            id="api-url"
            type="url"
            placeholder="https://your-api-host.com"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setHealthState("idle"); setLlmState("idle"); }}
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Leave blank for same-origin.
          </p>
        </div>

        {/* Divider */}
        <div className="my-5 border-t border-border/60" />

        {/* Health check section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="health-path" className="text-xs font-medium">Health Check Path</Label>
            <span className="text-[10px] text-muted-foreground">for Render monitoring</span>
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
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full"
            onClick={handleTestHealth}
            disabled={healthState === "loading"}
          >
            {healthState === "loading"
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Checking…</>
              : "Test health endpoint"}
          </Button>
          <StatusBadge state={healthState} detail={healthDetail} />
        </div>

        {/* Divider */}
        <div className="my-5 border-t border-border/60" />

        {/* LLM endpoint test section */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium">LLM Endpoint Test</p>
          <p className="text-[10px] text-muted-foreground">
            Sends a ping from the backend to its configured LLM endpoint to verify the AI connection is working.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full"
            onClick={handleTestLlm}
            disabled={llmState === "loading"}
          >
            {llmState === "loading"
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Testing LLM…</>
              : "Test LLM endpoint"}
          </Button>
          <StatusBadge state={llmState} detail={llmDetail} />
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}
