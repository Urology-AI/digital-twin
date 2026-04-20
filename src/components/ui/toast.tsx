import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "info" | "success" | "error" | "loading";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** auto-dismiss in ms; 0 = sticky (useful for "loading"). Default 3500. */
  duration?: number;
}

interface ToastCtx {
  show: (t: Omit<Toast, "id">) => number;
  update: (id: number, patch: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const show = useCallback<ToastCtx["show"]>((t) => {
    const id = Date.now() + Math.random();
    setToasts((xs) => [...xs, { id, duration: 3500, ...t }]);
    return id;
  }, []);

  const update = useCallback<ToastCtx["update"]>((id, patch) => {
    setToasts((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  return (
    <Ctx.Provider value={{ show, update, dismiss }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast.duration) return;
    const id = window.setTimeout(onDismiss, toast.duration);
    return () => window.clearTimeout(id);
  }, [toast.duration, onDismiss]);

  const Icon =
    toast.kind === "success"
      ? CheckCircle2
      : toast.kind === "error"
        ? XCircle
        : toast.kind === "loading"
          ? Loader2
          : Info;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex min-w-[240px] max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur",
        toast.kind === "success" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        toast.kind === "error" &&
          "border-red-500/30 bg-red-500/10 text-red-300",
        toast.kind === "loading" &&
          "border-border bg-card/90 text-muted-foreground",
        toast.kind === "info" && "border-border bg-card/90 text-foreground",
      )}
    >
      <Icon
        className={cn(
          "mt-px h-3.5 w-3.5 shrink-0",
          toast.kind === "loading" && "animate-spin",
        )}
      />
      <span className="break-words">{toast.message}</span>
    </div>
  );
}
