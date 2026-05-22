import { useEffect, useRef } from "react";
import { X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/uiStore";
import { buildPrintHtml } from "@/lib/compass/printReport";

export function PrintReportModal() {
  const open = useUiStore((s) => s.printReportOpen);
  const setPrintReportOpen = useUiStore((s) => s.setPrintReportOpen);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrintReportOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setPrintReportOpen]);

  if (!open) return null;

  const html = buildPrintHtml();
  if (!html) return null;

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
            <Button size="sm" variant="default" onClick={handlePrint} className="h-7 gap-1.5 px-3 text-xs">
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

        {/* Scrollable iframe — the HTML is self-contained with its own CSS */}
        <iframe
          ref={iframeRef}
          srcDoc={html}
          className="min-h-0 flex-1 border-0 bg-white"
          title="COMPASS Print Report"
        />
      </div>
    </div>
  );
}
