import { useEffect, useRef } from "react";

interface ReferencePanelProps {
  /** When true (desktop modal mode), wrap in an overlay */
  modal?: boolean;
  onClose?: () => void;
}

export function ReferencePanel({ modal, onClose }: ReferencePanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Attempt autoplay; if blocked (no user gesture), it will stay paused
    v.play().catch(() => {/* autoplay blocked — user can press play */});
    return () => {
      v.pause();
    };
  }, []);

  const inner = (
    <div className="flex h-full w-full flex-col bg-black">
      <video
        ref={videoRef}
        src={`${import.meta.env.BASE_URL}reference.mp4`}
        className="h-full w-full object-contain"
        controls
        playsInline
        muted
      />
    </div>
  );

  if (!modal) return inner;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reference video"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="relative flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-black shadow-2xl">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-black/80 px-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            Reference — 3D Anatomy
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {inner}
        </div>
      </div>
    </div>
  );
}
