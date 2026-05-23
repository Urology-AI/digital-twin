import { useEffect, useRef, useState } from "react";
import { X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";
import { buildPrintHtml } from "@/lib/compass/printReport";

export function PrintReportModal() {
  const open = useUiStore((s) => s.printReportOpen);
  const setPrintReportOpen = useUiStore((s) => s.setPrintReportOpen);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrintReportOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setPrintReportOpen]);

  // Capture the 3D canvas with the csPCa heatmap overlay active
  useEffect(() => {
    if (!open) {
      setHtml(null);
      return;
    }

    // Save current state so we can restore it after capture
    const { overlay: prevOverlay, heatmapVisible: prevHeatmap } = useUiStore.getState();

    // Force cancer probability heatmap so the snapshot always shows where cancer is
    useUiStore.setState({ overlay: "cancer", heatmapVisible: true });

    // Give React time to flush the state change → ThreeCanvas re-render →
    // useThreeProstate effect → updateZones → Three.js rAF renders new colors
    const timer = setTimeout(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
      const dataUrl = canvas?.toDataURL("image/jpeg", 0.88);

      // Restore the previous overlay state
      useUiStore.setState({ overlay: prevOverlay, heatmapVisible: prevHeatmap });

      setHtml(buildPrintHtml(dataUrl));
    }, 120);

    return () => {
      clearTimeout(timer);
      useUiStore.setState({ overlay: prevOverlay, heatmapVisible: prevHeatmap });
    };
  }, [open]);

  if (!open) return null;

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="COMPASS Print Report"
      onClick={(e) => { if (e.target === e.currentTarget) setPrintReportOpen(false); }}
    >
      <div className="flex h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
        {/* Modal header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
          <span className="text-sm font-semibold tracking-wide text-gray-700">
            COMPASS — Surgical Planning Report
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handlePrint}
              disabled={!html}
              className="h-7 gap-1.5 px-3 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </Button>
            <button
              type="button"
              onClick={() => setPrintReportOpen(false)}
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close report"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!html ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
            <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-xs">Capturing 3D model…</span>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            className="min-h-0 flex-1 border-0 bg-white"
            title="COMPASS Print Report"
          />
        )}
      </div>
    </div>
  );
}
