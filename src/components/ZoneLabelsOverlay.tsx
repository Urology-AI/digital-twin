import { REGION_LABELS, regionDisplays } from "@/lib/compass/regionalEvidence";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { usePatientStore } from "@/store/patientStore";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  "A-RB": "R Ant Base",
  "A-LB": "L Ant Base",
  "A-RM": "R Ant Mid",
  "A-LM": "L Ant Mid",
  "A-RA": "R Ant Apex",
  "A-LA": "L Ant Apex",
  "P-RB-L": "R Base Lat",
  "P-RB-M": "R Base Med",
  "P-LB-M": "L Base Med",
  "P-LB-L": "L Base Lat",
  "P-RM-L": "R Mid Lat",
  "P-RM-M": "R Mid Med",
  "P-LM-M": "L Mid Med",
  "P-LM-L": "L Mid Lat",
  "P-RA": "R Apex",
  "P-LA": "L Apex",
};

/** Same ranges as the side ECE row in the nerve-sparing table. */
function sideCls(p: number) {
  return p < 0.1 ? "text-emerald-400" : p < 0.3 ? "text-amber-400" : "text-red-400";
}

export function ZoneLabelsOverlay() {
  const overlay = useUiStore((s) => s.overlay);
  const labelsVisible = useUiStore((s) => s.labelsVisible);
  const heatmapVisible = useUiStore((s) => s.heatmapVisible);
  const threeZones = usePatientStore((s) => s.threeZones);
  const predictions = usePatientStore((s) => s.predictions);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const entry = patients.find((p) => p.id === activeId);
  const mlobe = entry?.record.prostate.median_lobe_grade ?? 0;
  const [collapsed, setCollapsed] = useState(false);

  if (!heatmapVisible || !labelsVisible) return null;

  // ECE view: same regions and numbers as the nerve-sparing table, findings only.
  if (overlay === "ece") {
    const rows = regionDisplays(predictions?.regional, predictions?.eceL ?? NaN, predictions?.eceR ?? NaN)
      .filter((d) => d.level !== "none")
      .sort((a, b) => (a.level === b.level ? 0 : a.level === "epe" ? -1 : 1));
    return (
      <div className="glass pointer-events-auto absolute right-2 top-[calc(4.5rem+0.5rem)] z-10 w-44 rounded-xl px-3 py-2 shadow-xl lg:top-16">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">ECE findings</div>
        {predictions && Number.isFinite(predictions.eceL) && (
          <div className="mb-1.5 flex justify-between border-b border-foreground/10 pb-1.5 text-[11px] text-muted-foreground">
            <span>Left <b className={sideCls(predictions.eceL)}>{Math.round(predictions.eceL * 100)}%</b></span>
            <span>Right <b className={sideCls(predictions.eceR)}>{Math.round(predictions.eceR * 100)}%</b></span>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No regional findings</p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {rows.map((d) => (
              <li key={`${d.side}-${d.region}`} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground/90">
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full", d.level === "epe" ? "bg-red-500" : "bg-amber-500")} />
                  {d.side === "left" ? "L" : "R"} {REGION_LABELS[d.region].toLowerCase()}
                </span>
                <span className={cn("font-semibold", d.level === "epe" ? "text-red-400" : "text-amber-400")}>{d.level === "epe" ? "EPE" : "Tumor"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const overlayName =
    overlay === "cancer" ? "csPCa"
    : overlay === "svi" ? "SVI"
    : "PSM";

  const items = threeZones
    .map((z) => {
      const val =
        overlay === "cancer" ? z.cancer
        : overlay === "svi" ? z.svi
        : z.psm;
      return { name: LABELS[z.id] ?? z.id, pct: Math.round((val ?? 0) * 100), v: val ?? 0 };
    })
    .filter((x) => x.v > 0.05)
    .sort((a, b) => b.v - a.v);

  return (
    <div className="glass pointer-events-auto absolute right-2 top-[calc(4.5rem+0.5rem)] z-10 w-48 overflow-hidden rounded-xl shadow-xl lg:top-16">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          {overlayName} by zone
        </span>
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3">
          {items.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">No zones above 5%</p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.name} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground/90">{item.name}</span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        item.v < 0.15 ? "text-emerald-400"
                        : item.v < 0.3 ? "text-amber-400"
                        : "text-red-400",
                      )}
                    >
                      {item.pct}% {overlayName}
                    </span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/8">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        item.v < 0.15 ? "bg-emerald-500"
                        : item.v < 0.3 ? "bg-amber-500"
                        : "bg-red-500",
                      )}
                      style={{ width: `${Math.min(100, item.pct)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {mlobe > 0 && (
            <div className="mt-2.5 flex justify-between border-t border-foreground/10 pt-2 text-[10px]">
              <span className="text-muted-foreground">Median lobe</span>
              <span className="font-bold text-amber-400">Grade {mlobe}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
