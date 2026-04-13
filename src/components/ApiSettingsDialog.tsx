import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkApiHealth, getApiUrl, setApiUrl } from "@/lib/api";

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
  const [testState, setTestState]   = useState<TestState>("idle");
  const [testDetail, setTestDetail] = useState("");
  const [saving, setSaving]         = useState(false);

  if (!open) return null;

  const base = apiUrl.trim().replace(/\/$/, "");

  async function handleTest() {
    setTestState("loading");
    setTestDetail("");
    try {
      const h = await checkApiHealth(base);
      setTestState("ok");
      setTestDetail(`Backend reachable · LLM configured: ${h.endpoint_set}`);
    } catch (e) {
      setTestState("error");
      setTestDetail(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSave() {
    setSaving(true);
    setApiUrl(apiUrl);
    onSave?.();
    onClose();
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">API Settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Point the app at your backend. The LLM endpoint is configured on the backend server.
            </p>
          </div>

          {/* ── Backend URL ───────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="api-url" className="text-xs font-medium">Backend URL</Label>
            <Input
              id="api-url"
              type="url"
              placeholder="http://your-backend:8000"
              value={apiUrl}
              onChange={(e) => { setApiUrlState(e.target.value); setTestState("idle"); }}
              className="font-mono text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleTest}
            disabled={testState === "loading" || !base}
          >
            {testState === "loading"
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Checking…</>
              : "Test backend health"}
          </Button>
          <StatusRow state={testState} detail={testDetail} />

          {/* ── Actions ───────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !base}>
              {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
