import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chatWithAssistant,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/api";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

const MAX_TEXT_BYTES = 200_000; // 200 KB per text file
const MAX_IMAGE_BYTES = 5_000_000; // 5 MB per image

function readAsText(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result ?? ""));
    r.onerror = () => rej(r.error);
    r.readAsText(f);
  });
}

function readAsDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result ?? ""));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function captureCanvas(): ChatAttachment | null {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) return null;
  try {
    const data_url = canvas.toDataURL("image/png");
    return {
      name: `compass-view-${new Date().toISOString()}.png`,
      mime: "image/png",
      data_url,
    };
  } catch {
    return null;
  }
}

export function ChatWidget() {
  const open = useUiStore((s) => s.chatOpen);
  const setOpen = useUiStore((s) => s.setChatOpen);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const activeEntry = patients.find((p) => p.id === activeId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const next: ChatAttachment[] = [];
    for (const f of Array.from(list)) {
      try {
        if (f.type.startsWith("image/")) {
          if (f.size > MAX_IMAGE_BYTES) {
            setError(`${f.name} too large (>5 MB)`);
            continue;
          }
          next.push({
            name: f.name,
            mime: f.type,
            data_url: await readAsDataUrl(f),
          });
        } else {
          if (f.size > MAX_TEXT_BYTES) {
            setError(`${f.name} too large (>200 KB for text)`);
            continue;
          }
          next.push({
            name: f.name,
            mime: f.type || "text/plain",
            text: await readAsText(f),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    if (next.length) setAttachments((xs) => [...xs, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addScreenshot() {
    const att = captureCanvas();
    if (!att) {
      setError("Couldn't capture 3D view — is the viewer mounted?");
      return;
    }
    setAttachments((xs) => [...xs, att]);
    setError(null);
  }

  function removeAttachment(i: number) {
    setAttachments((xs) => xs.filter((_, idx) => idx !== i));
  }

  async function send() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || busy) return;
    const userMsg = text || "(see attachments)";
    const next: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(next);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    setBusy(true);
    setError(null);
    try {
      // Always pull the latest store state so edits after opening the chat are included.
      const latest = usePatientStore.getState();
      const latestEntry = latest.patients.find((p) => p.id === latest.activeId);
      const ui = useUiStore.getState();
      const viewer = {
        overlay: ui.overlay,
        heatmap_visible: ui.heatmapVisible,
        labels_visible: ui.labelsVisible,
        lesions_only: ui.lesionsOnly,
        mobile_workspace: ui.mobileWorkspace,
      };
      const clinical = latestEntry
        ? ({
            patient_name: latestEntry.name,
            ...latestEntry.record,
            lesions: latestEntry.lesionRows,
            predictions: latest.predictions,
            viewer,
          } as Record<string, unknown>)
        : ({ viewer } as Record<string, unknown>);
      const { reply } = await chatWithAssistant(next, clinical, sentAttachments);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden bg-card shadow-2xl",
        // Mobile: full-screen overlay below header, above tab bar
        "inset-0 top-14 bottom-0 max-lg:rounded-none max-lg:border-0",
        // Desktop: floating panel in bottom-right corner
        "lg:inset-auto lg:bottom-4 lg:right-4 lg:h-[70vh] lg:max-h-[640px] lg:w-[420px] lg:rounded-xl lg:border lg:border-border",
      )}
      role="dialog"
      aria-label="Chat assistant"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="h-4 w-4 text-primary" />
          COMPASS Assistant
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm app-scroll"
      >
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ask about the current patient, predictions, or prostate cancer
            management. Responses are constrained to NCCN / EAU / AUA
            guidelines.{" "}
            {activeEntry ? `Context: ${activeEntry.name}.` : ""}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap rounded-lg px-3 py-2",
              m.role === "user"
                ? "ml-6 bg-primary/15 text-foreground"
                : "mr-6 bg-muted text-foreground",
            )}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="mr-6 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-2 py-2">
          {attachments.map((a, i) => {
            const isImage = a.mime.startsWith("image/") && a.data_url;
            return (
              <div
                key={i}
                className="group relative flex items-center gap-1.5 rounded-md border border-border bg-muted px-1.5 py-1 text-[10px]"
              >
                {isImage ? (
                  <img
                    src={a.data_url}
                    alt={a.name}
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="h-3 w-3" />
                )}
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="safe-bottom border-t border-border p-2">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Attach files"
              aria-label="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={addScreenshot}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Attach current 3D view"
              aria-label="Attach screenshot"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask a question…"
            className="flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-24"
            style={{ height: "auto", minHeight: "2.25rem" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 96) + "px";
            }}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void send()}
            disabled={busy || (!input.trim() && attachments.length === 0)}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
