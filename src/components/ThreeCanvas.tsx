import { useRef } from "react";
import { useThreeProstate } from "@/hooks/useThreeProstate";
import {
  medianLobeFromRecord,
  prostateDimsFromRecord,
  volumeScaleFromRecord,
} from "@/lib/compass/dimensions";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";

export function ThreeCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const threeZones = usePatientStore((s) => s.threeZones);
  const patients = usePatientStore((s) => s.patients);
  const activeId = usePatientStore((s) => s.activeId);
  const entry = patients.find((p) => p.id === activeId);
  const overlay = useUiStore((s) => s.overlay);
  const heatmapVisible = useUiStore((s) => s.heatmapVisible);
  const lesionsOnly = useUiStore((s) => s.lesionsOnly);

  const dims = entry ? prostateDimsFromRecord(entry.record) : { ap: 1, tr: 1.15, cc: 0.82 };
  const volScale = entry ? volumeScaleFromRecord(entry.record) : 1;
  const mlobe = entry ? medianLobeFromRecord(entry.record) : 0;

  const glbLoading = useThreeProstate(
    ref,
    threeZones,
    overlay,
    dims,
    mlobe,
    volScale,
    heatmapVisible,
    lesionsOnly,
  );

  return (
    <div className="relative h-full min-h-[320px] w-full">
      <div
        ref={ref}
        className="h-full w-full"
        style={{ background: "radial-gradient(ellipse at 50% 35%, #1a2540 0%, #0d1220 55%, #080b14 100%)" }}
        role="img"
        aria-label="3D prostate digital twin"
      />
      {glbLoading && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
          <svg className="h-8 w-8 animate-spin text-white/60" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-xs font-medium text-white/50">Loading 3D model…</span>
        </div>
      )}
    </div>
  );
}
