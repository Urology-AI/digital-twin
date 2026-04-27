import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/patientStore";
import { emptyLesion, type LesionRow } from "@/types/lesion";
import type { ThreeZoneRuntime } from "@/types/prediction";
import { cn } from "@/lib/utils";

// ── Zone definitions ──────────────────────────────────────────────────────────
// Grid orientation: Base (top/superior) → Mid → Apex (bottom/inferior), matching 3D model.
// Columns (posterior): R-Lat | R-Med | L-Med | L-Lat (surgical view from behind — patient R on viewer R)

interface ZoneDef {
  id: string;
  label: string;
  shortLabel: string;
  side: "L" | "R";
  level: "Base" | "Mid" | "Apex";
  pos: string;
}

const POST_ZONES: ZoneDef[] = [
  { id: "P-RB-L", label: "R Base Lat",  shortLabel: "B-RL", side: "R", level: "Base", pos: "Posterolateral" },
  { id: "P-RB-M", label: "R Base Med",  shortLabel: "B-RM", side: "R", level: "Base", pos: "Posterior" },
  { id: "P-LB-M", label: "L Base Med",  shortLabel: "B-LM", side: "L", level: "Base", pos: "Posterior" },
  { id: "P-LB-L", label: "L Base Lat",  shortLabel: "B-LL", side: "L", level: "Base", pos: "Posterolateral" },
  { id: "P-RM-L", label: "R Mid Lat",   shortLabel: "M-RL", side: "R", level: "Mid",  pos: "Posterolateral" },
  { id: "P-RM-M", label: "R Mid Med",   shortLabel: "M-RM", side: "R", level: "Mid",  pos: "Posterior" },
  { id: "P-LM-M", label: "L Mid Med",   shortLabel: "M-LM", side: "L", level: "Mid",  pos: "Posterior" },
  { id: "P-LM-L", label: "L Mid Lat",   shortLabel: "M-LL", side: "L", level: "Mid",  pos: "Posterolateral" },
];

const ANT_ZONES: ZoneDef[] = [
  { id: "A-RB", label: "R Base Ant", shortLabel: "B-R", side: "R", level: "Base", pos: "Anterior" },
  { id: "A-LB", label: "L Base Ant", shortLabel: "B-L", side: "L", level: "Base", pos: "Anterior" },
  { id: "A-RM", label: "R Mid Ant",  shortLabel: "M-R", side: "R", level: "Mid",  pos: "Anterior" },
  { id: "A-LM", label: "L Mid Ant",  shortLabel: "M-L", side: "L", level: "Mid",  pos: "Anterior" },
  { id: "A-RA", label: "R Apex", shortLabel: "A-R", side: "R", level: "Apex", pos: "Anterior" },
  { id: "A-LA", label: "L Apex", shortLabel: "A-L", side: "L", level: "Apex", pos: "Anterior" },
];

const ALL_ZONES: ZoneDef[] = [...POST_ZONES, ...ANT_ZONES];

// ── Per-zone modality data ────────────────────────────────────────────────────
interface ZoneModality {
  // MRI
  pirads?: number;
  mriSize?: number;    // lesion size in mm — aggregated to patient-level max for ECE model
  mriAbut?: number;    // abutment score 0–4 — aggregated to patient-level max
  mriAdc?: number;     // ADC µm²/s — aggregated to patient-level min
  mriEpe?: boolean;    // EPE flag — boosts zone ECE; aggregated to patient-level
  mriSvi?: boolean;    // SVI flag — patient-level staging

  // MUS / ExactVu
  primus?: number;
  musEce?: boolean;    // ECE on micro-US — boosts zone ECE; aggregated to patient-level
  musAbut?: boolean;   // Abutment on micro-US (binary Yes/No per ExactVu scale)

  // PSMA PET
  suv?: number;
  psmaEpe?: boolean;   // EPE on PSMA PET
  psmaSvi?: boolean;   // SVI on PSMA PET
  psmaLn?: boolean;    // LN+ on PSMA PET (patient-level, shown per-zone)

  // Biopsy
  gg?: number;
  corePct?: number;
  linearMm?: number;   // max linear core length mm — used per zone in model
  cribriform?: boolean;
  idc?: boolean;
  pni?: boolean;
}
type ZoneDataMap = Record<string, ZoneModality>;

// ── Conversion helpers ────────────────────────────────────────────────────────
function rowsToZoneData(rows: LesionRow[]): ZoneDataMap {
  const map: ZoneDataMap = {};
  for (const row of rows) {
    const zone = ALL_ZONES.find(
      (z) =>
        z.side === row.side &&
        z.level === row.level &&
        (z.pos === row.zone ||
          (z.pos === "Posterior" && (row.zone === "Medial" || row.zone === "Posterior")) ||
          (z.pos === "Posterolateral" && (row.zone === "Posterolateral" || row.zone === "Lateral")) ||
          (z.pos === "Anterior" && row.zone === "Anterior")),
    );
    if (!zone) continue;
    const d: ZoneModality = map[zone.id] ?? {};

    if (row.source === "MRI") {
      const p = parseInt(row.score, 10);
      if (p > 0) d.pirads = Math.max(d.pirads ?? 0, p) || undefined;
      if (row.mriSize > 0) d.mriSize = Math.max(d.mriSize ?? 0, row.mriSize) || undefined;
      if (row.mriAbutment >= 0) d.mriAbut = Math.max(d.mriAbut ?? -1, row.mriAbutment);
      if (row.mriAdc > 0) {
        d.mriAdc = d.mriAdc ? Math.min(d.mriAdc, row.mriAdc) : row.mriAdc;
      }
      if (row.epe) d.mriEpe = true;
      if (row.svi) d.mriSvi = true;
    } else if (row.source === "PSMA") {
      const s = row.suv ?? parseFloat(row.score);
      if (s > 0) d.suv = Math.max(d.suv ?? 0, s) || undefined;
      if (row.epe) d.psmaEpe = true;
      if (row.svi) d.psmaSvi = true;
      if (row.psmaLn) d.psmaLn = true;
    } else if (row.source === "MUS" || row.source === "ExactVu") {
      const p = row.primus ?? parseInt(row.score, 10);
      if (p > 0) d.primus = Math.max(d.primus ?? 0, p) || undefined;
      if (row.epe) d.musEce = true;
      if (row.mriAbutment === 1) d.musAbut = true;
    } else if (row.source === "Bx") {
      const g = parseInt(row.score, 10);
      if (g > 0) d.gg = Math.max(d.gg ?? 0, g) || undefined;
      if (row.corePct > 0) d.corePct = Math.max(d.corePct ?? 0, row.corePct) || undefined;
      if (row.linear > 0) d.linearMm = Math.max(d.linearMm ?? 0, row.linear) || undefined;
      if (row.cribriform) d.cribriform = true;
      if (row.idc) d.idc = true;
      if (row.pni) d.pni = true;
    }
    map[zone.id] = d;
  }
  return map;
}

function zoneDataToRows(zoneData: ZoneDataMap): LesionRow[] {
  const rows: LesionRow[] = [];
  for (const zone of ALL_ZONES) {
    const d = zoneData[zone.id];
    if (!d) continue;

    if (d.pirads && d.pirads > 0) {
      rows.push({
        ...emptyLesion(`${zone.id}-mri`),
        source: "MRI",
        side: zone.side,
        level: zone.level,
        zone: zone.pos,
        score: String(d.pirads),
        pirads: d.pirads,
        mriSize: d.mriSize ?? 0,
        mriAbutment: d.mriAbut ?? -1,
        mriAdc: d.mriAdc ?? 0,
        epe: d.mriEpe ?? false,
        svi: d.mriSvi ?? false,
      });
    }
    if (d.suv && d.suv > 0) {
      rows.push({
        ...emptyLesion(`${zone.id}-psma`),
        source: "PSMA",
        side: zone.side,
        level: zone.level,
        zone: zone.pos,
        score: String(d.suv),
        suv: d.suv,
        epe: d.psmaEpe ?? false,
        svi: d.psmaSvi ?? false,
        psmaLn: d.psmaLn ?? false,
      });
    }
    if (d.primus && d.primus > 0) {
      rows.push({
        ...emptyLesion(`${zone.id}-mus`),
        source: "MUS",
        side: zone.side,
        level: zone.level,
        zone: zone.pos,
        score: String(d.primus),
        primus: d.primus,
        epe: d.musEce ?? false,
        mriAbutment: d.musAbut ? 1 : 0,
      });
    }
    if (d.gg && d.gg > 0) {
      rows.push({
        ...emptyLesion(`${zone.id}-bx`),
        source: "Bx",
        side: zone.side,
        level: zone.level,
        zone: zone.pos,
        score: String(d.gg),
        corePct: d.corePct ?? 0,
        linear: d.linearMm ?? 0,
        cribriform: d.cribriform ?? false,
        idc: d.idc ?? false,
        pni: d.pni ?? false,
      });
    }
  }
  return rows;
}

function hasData(d?: ZoneModality): boolean {
  if (!d) return false;
  return !!(
    (d.pirads && d.pirads > 0) ||
    (d.suv && d.suv > 0) ||
    (d.primus && d.primus > 0) ||
    (d.gg && d.gg > 0)
  );
}

function riskBorder(cancer: number, selected: boolean, filled: boolean): string {
  if (selected) return "border-primary ring-1 ring-primary/50 bg-primary/10";
  // Only show risk colours when the wizard actually has data for this zone.
  // Zones with no wizard input stay neutral even if the biopsy-fallback
  // has computed a non-zero cancer probability from aggregate side data.
  if (!filled) return "border-border/40 bg-muted/10 text-muted-foreground/40 hover:border-border/70 hover:bg-muted/20";
  if (cancer >= 0.5) return "border-red-500/70 bg-red-500/15 text-foreground";
  if (cancer >= 0.3) return "border-orange-500/60 bg-orange-500/12 text-foreground";
  if (cancer >= 0.15) return "border-yellow-500/50 bg-yellow-500/10 text-foreground";
  if (cancer > 0.04) return "border-emerald-500/40 bg-emerald-500/8 text-foreground";
  return "border-border/40 bg-muted/20 text-muted-foreground/60";
}

function riskBarColor(cancer: number): string {
  if (cancer >= 0.5) return "bg-red-500";
  if (cancer >= 0.3) return "bg-orange-500";
  if (cancer >= 0.15) return "bg-yellow-400";
  if (cancer > 0.04) return "bg-emerald-500";
  return "bg-slate-600/50";
}

// ── Chip selector ─────────────────────────────────────────────────────────────
function ChipSelector({
  value,
  options,
  onChange,
  label,
  width = "w-16",
}: {
  value: number | undefined;
  options: { v: number; l: string }[];
  onChange: (v: number | undefined) => void;
  label: string;
  width?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", width)}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(value === o.v ? undefined : o.v)}
            className={cn(
              "flex h-7 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-xs font-semibold transition-colors",
              value === o.v
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
            title={o.l}
          >
            {o.v}
          </button>
        ))}
        {value !== undefined && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex h-7 w-6 items-center justify-center rounded text-xs text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground"
            title="Clear"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ── Zone cell ─────────────────────────────────────────────────────────────────
function ZoneCell({
  zone,
  data,
  cancer,
  selected,
  onClick,
  tall = false,
}: {
  zone: ZoneDef;
  data?: ZoneModality;
  cancer: number;
  selected: boolean;
  onClick: () => void;
  tall?: boolean;
}) {
  const filled = hasData(data);
  const pct = Math.round(cancer * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-between rounded-md border p-1.5 transition-all w-full",
        tall ? "min-h-[68px]" : "min-h-[52px]",
        riskBorder(cancer, selected, filled),
      )}
    >
      {/* Short label — always bright so it's readable on any background */}
      <span className="text-[10px] font-semibold leading-tight text-center text-foreground/90">
        {zone.label}
      </span>

      {/* Modality indicator dots */}
      <div className="flex gap-0.5 mt-0.5">
        {data?.pirads && data.pirads > 0 ? (
          <span className="inline-flex h-[13px] w-[13px] items-center justify-center rounded-sm bg-blue-500 text-[8px] font-bold text-white">M</span>
        ) : null}
        {data?.primus && data.primus > 0 ? (
          <span className="inline-flex h-[13px] w-[13px] items-center justify-center rounded-sm bg-teal-500 text-[8px] font-bold text-white">U</span>
        ) : null}
        {data?.suv && data.suv > 0 ? (
          <span className="inline-flex h-[13px] w-[13px] items-center justify-center rounded-sm bg-purple-500 text-[8px] font-bold text-white">P</span>
        ) : null}
        {data?.gg && data.gg > 0 ? (
          <span className="inline-flex h-[13px] w-[13px] items-center justify-center rounded-sm bg-amber-600 text-[8px] font-bold text-white">B</span>
        ) : null}
      </div>

      {/* Risk % badge */}
      {filled && (
        <span className={cn(
          "text-[9px] font-bold tabular-nums mt-0.5",
          cancer >= 0.5 ? "text-red-400" :
          cancer >= 0.3 ? "text-orange-400" :
          cancer >= 0.15 ? "text-yellow-400" :
          "text-emerald-400",
        )}>
          {pct}%
        </span>
      )}

      {/* Risk bar at bottom */}
      {filled && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-md overflow-hidden">
          <div
            className={cn("h-full", riskBarColor(cancer))}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </button>
  );
}

// ── Zone detail panel ─────────────────────────────────────────────────────────
function ZoneDetail({
  zone,
  data,
  onUpdate,
  onClear,
  onClose,
}: {
  zone: ZoneDef;
  data: ZoneModality;
  onUpdate: (patch: Partial<ZoneModality>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const PIRADS_OPTS = [
    { v: 1, l: "1 – Very low" },
    { v: 2, l: "2 – Low" },
    { v: 3, l: "3 – Intermediate" },
    { v: 4, l: "4 – High" },
    { v: 5, l: "5 – Very high" },
  ];
  const MUS_OPTS = [
    { v: 1, l: "1 – Normal" },
    { v: 2, l: "2 – Low suspicion" },
    { v: 3, l: "3 – Suspicious" },
    { v: 4, l: "4 – High suspicion" },
    { v: 5, l: "5 – Very high suspicion" },
  ];
  const GG_OPTS = [
    { v: 1, l: "Grade Group 1" },
    { v: 2, l: "Grade Group 2" },
    { v: 3, l: "Grade Group 3" },
    { v: 4, l: "Grade Group 4" },
    { v: 5, l: "Grade Group 5" },
  ];
  const ABUT_OPTS = [
    { v: -1, l: "— Not assessed" },
    { v: 0,  l: "0 — No contact" },
    { v: 1,  l: "1 — Abuts capsule" },
    { v: 2,  l: "2 — Broad (>1 cm)" },
    { v: 3,  l: "3 — Irreg / EPE?" },
    { v: 4,  l: "4 — Definite bulge" },
  ];

  const hasMri = (data.pirads ?? 0) > 0;
  const hasBx  = (data.gg ?? 0) > 0;

  return (
    <div className="rounded-xl border border-primary/30 bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">{zone.label}</span>
          {hasData(data) && (
            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
              {zone.side} · {zone.level} · {zone.pos}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasData(data) && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-medium text-destructive/70 hover:text-destructive"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted/40 hover:text-foreground text-sm"
          >
            ×
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">

        {/* ── MRI ── */}
        <div className="space-y-2.5 rounded-lg border border-blue-500/25 bg-blue-500/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-blue-500 text-[8px] font-bold text-white">M</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">MRI</span>
          </div>

          <ChipSelector
            label="PI-RADS"
            value={data.pirads}
            options={PIRADS_OPTS}
            onChange={(v) => onUpdate({ pirads: v })}
          />

          {hasMri && (
            <>
              {/* Size + ADC */}
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Size</span>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  placeholder="mm"
                  className="h-7 w-20 px-2 text-xs"
                  value={data.mriSize ?? ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onUpdate({ mriSize: isNaN(v) ? undefined : v });
                  }}
                />
                <span className="text-[10px] text-muted-foreground">mm</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ADC</span>
                <Input
                  type="number"
                  step="10"
                  min={0}
                  placeholder="µm²/s"
                  className="h-7 w-24 px-2 text-xs"
                  value={data.mriAdc ?? ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onUpdate({ mriAdc: isNaN(v) ? undefined : v });
                  }}
                />
                <span className="text-[10px] text-muted-foreground">µm²/s</span>
              </div>

              {/* Abutment — dropdown with abbreviated labels */}
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Abut
                </span>
                <select
                  className="h-8 flex-1 rounded border border-input/80 bg-background px-2 text-xs text-foreground shadow-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring/50 dark:border-input/60"
                  value={data.mriAbut ?? -1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    onUpdate({ mriAbut: v === -1 ? undefined : v });
                  }}
                >
                  {ABUT_OPTS.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </div>

              {/* EPE + SVI flags */}
              <div className="flex items-center gap-4 pl-[4.5rem]">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded accent-primary"
                    checked={data.mriEpe ?? false}
                    onChange={(e) => onUpdate({ mriEpe: e.target.checked })}
                  />
                  EPE
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded accent-primary"
                    checked={data.mriSvi ?? false}
                    onChange={(e) => onUpdate({ mriSvi: e.target.checked })}
                  />
                  SVI
                </label>
              </div>
            </>
          )}
        </div>

        {/* ── MUS ── */}
        <div className="space-y-2.5 rounded-lg border border-teal-500/25 bg-teal-500/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-teal-500 text-[8px] font-bold text-white">U</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Micro-US</span>
          </div>

          <ChipSelector
            label="PRI-MUS"
            value={data.primus}
            options={MUS_OPTS}
            onChange={(v) => onUpdate({ primus: v })}
          />

          {(data.primus ?? 0) > 0 && (
            <div className="flex flex-col gap-1 pl-[4.5rem]">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded accent-primary"
                  checked={data.musEce ?? false}
                  onChange={(e) => onUpdate({ musEce: e.target.checked })}
                />
                ECE on MUS
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded accent-primary"
                  checked={data.musAbut ?? false}
                  onChange={(e) => onUpdate({ musAbut: e.target.checked })}
                />
                Abutment
              </label>
            </div>
          )}
        </div>

        {/* ── PSMA ── */}
        <div className="space-y-2.5 rounded-lg border border-purple-500/25 bg-purple-500/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-purple-500 text-[8px] font-bold text-white">P</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">PSMA PET</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SUVmax</span>
            <Input
              type="number"
              step="0.1"
              min={0}
              placeholder="e.g. 12.4"
              className="h-7 w-24 px-2 text-xs"
              value={data.suv ?? ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onUpdate({ suv: isNaN(v) ? undefined : v });
              }}
            />
          </div>

          {(data.suv ?? 0) > 0 && (
            <div className="flex items-center gap-4 pl-[4.5rem]">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded accent-primary"
                  checked={data.psmaEpe ?? false}
                  onChange={(e) => onUpdate({ psmaEpe: e.target.checked })}
                />
                EPE
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded accent-primary"
                  checked={data.psmaSvi ?? false}
                  onChange={(e) => onUpdate({ psmaSvi: e.target.checked })}
                />
                SVI
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded accent-primary"
                  checked={data.psmaLn ?? false}
                  onChange={(e) => onUpdate({ psmaLn: e.target.checked })}
                />
                LN+
              </label>
            </div>
          )}
        </div>

        {/* ── Biopsy ── */}
        <div className="space-y-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-600 text-[8px] font-bold text-white">B</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Biopsy</span>
          </div>

          <ChipSelector
            label="Grade Grp"
            value={data.gg}
            options={GG_OPTS}
            onChange={(v) => onUpdate({ gg: v })}
          />

          {hasBx && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Core %</span>
                <Input
                  type="number"
                  step="1"
                  min={0}
                  max={100}
                  placeholder="0–100"
                  className="h-7 w-20 px-2 text-xs"
                  value={data.corePct ?? ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onUpdate({ corePct: isNaN(v) ? undefined : v });
                  }}
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Linear</span>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  placeholder="mm"
                  className="h-7 w-20 px-2 text-xs"
                  value={data.linearMm ?? ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onUpdate({ linearMm: isNaN(v) ? undefined : v });
                  }}
                />
                <span className="text-[10px] text-muted-foreground">mm</span>
              </div>

              <div className="flex items-center gap-4 pl-[4.5rem]">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary"
                    checked={data.cribriform ?? false}
                    onChange={(e) => onUpdate({ cribriform: e.target.checked })} />
                  Cribriform
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary"
                    checked={data.idc ?? false}
                    onChange={(e) => onUpdate({ idc: e.target.checked })} />
                  IDC
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary"
                    checked={data.pni ?? false}
                    onChange={(e) => onUpdate({ pni: e.target.checked })} />
                  PNI
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Demographics ──────────────────────────────────────────────────────
function Step1({
  age, setAge,
  psa, setPsa,
  vol, setVol,
  decipher, setDecipher,
  shim, setShim,
  ipss, setIpss,
  onNext,
}: {
  age: string; setAge: (v: string) => void;
  psa: string; setPsa: (v: string) => void;
  vol: string; setVol: (v: string) => void;
  decipher: string; setDecipher: (v: string) => void;
  shim: string; setShim: (v: string) => void;
  ipss: string; setIpss: (v: string) => void;
  onNext: () => void;
}) {
  const psaNum = parseFloat(psa);
  const volNum = parseFloat(vol);
  const psad = volNum > 0 && !isNaN(psaNum) ? (psaNum / volNum).toFixed(3) : "—";

  const psaWarn = !isNaN(psaNum) && psaNum > 0 && (psaNum > 100 || psaNum < 0.1);
  const volWarn = !isNaN(volNum) && volNum > 0 && (volNum < 10 || volNum > 250);

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Enter the three key baseline parameters. PSAD auto-calculates and
        calibrates density-dependent risk models.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground" htmlFor="wiz-age">
            Age <span className="font-normal text-muted-foreground">(years)</span>
          </label>
          <Input
            id="wiz-age"
            type="number"
            min={18}
            max={120}
            inputMode="numeric"
            placeholder="e.g. 65"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground" htmlFor="wiz-psa">
            PSA <span className="font-normal text-muted-foreground">(ng/mL)</span>
          </label>
          <Input
            id="wiz-psa"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="e.g. 6.5"
            value={psa}
            onChange={(e) => setPsa(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground" htmlFor="wiz-vol">
            Volume <span className="font-normal text-muted-foreground">(cc)</span>
          </label>
          <Input
            id="wiz-vol"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="e.g. 45"
            value={vol}
            onChange={(e) => setVol(e.target.value)}
          />
        </div>
      </div>

      {/* Validation warnings */}
      {(psaWarn || volWarn) && (
        <div className="space-y-1">
          {psaNum > 100 && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-500">
              <span className="font-bold">⚠</span> PSA {psaNum} ng/mL is very high — confirm entry is correct
            </div>
          )}
          {psaNum > 0 && psaNum < 0.1 && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-500">
              <span className="font-bold">⚠</span> PSA &lt; 0.1 ng/mL — verify this is not a post-treatment value
            </div>
          )}
          {volNum > 0 && volNum < 10 && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-500">
              <span className="font-bold">⚠</span> Volume {volNum} cc is physiologically very small — verify entry
            </div>
          )}
          {volNum > 250 && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-500">
              <span className="font-bold">⚠</span> Volume {volNum} cc is very large — verify entry
            </div>
          )}
        </div>
      )}

      {/* PSAD */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">
          PSAD <span className="font-normal text-muted-foreground">(ng/mL/cc)</span>
        </label>
        <Input
          type="text"
          readOnly
          value={psad === "—" ? "" : psad}
          placeholder="—"
          className="bg-muted/30 text-muted-foreground cursor-default"
        />
      </div>


      {/* Decipher / SHIM / IPSS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground" htmlFor="wiz-dec">
            Decipher <span className="font-normal text-muted-foreground">(0–1)</span>
          </label>
          <Input id="wiz-dec" type="text" inputMode="decimal" placeholder="e.g. 0.52" className="h-8 text-xs"
            value={decipher} onChange={(e) => setDecipher(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground" htmlFor="wiz-shim">
            SHIM <span className="font-normal text-muted-foreground">(0–25)</span>
          </label>
          <Input id="wiz-shim" type="number" min={0} max={25} inputMode="numeric" placeholder="e.g. 21" className="h-8 text-xs"
            value={shim} onChange={(e) => setShim(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground" htmlFor="wiz-ipss">
            IPSS <span className="font-normal text-muted-foreground">(0–35)</span>
          </label>
          <Input id="wiz-ipss" type="number" min={0} max={35} inputMode="numeric" placeholder="e.g. 8" className="h-8 text-xs"
            value={ipss} onChange={(e) => setIpss(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button type="button" size="sm" onClick={onNext} disabled={!psa || !vol}>
          Next: Lesion Locations →
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Zone grid ─────────────────────────────────────────────────────────
// Orientation: Base (top/superior) → Mid → Apex (bottom/inferior)
// Posterior columns (surgical view from behind): R-Lat | R-Med | L-Med | L-Lat

function Step2({
  zoneData,
  threeZones,
  selectedZone,
  setSelectedZone,
  updateZone,
  clearZone,
  onBack,
  onNext,
}: {
  zoneData: ZoneDataMap;
  threeZones: ThreeZoneRuntime[];
  selectedZone: string | null;
  setSelectedZone: (id: string | null) => void;
  updateZone: (id: string, patch: Partial<ZoneModality>) => void;
  clearZone: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const getCancer = (id: string) => threeZones.find((z) => z.id === id)?.cancer ?? 0.02;
  const selDef = selectedZone ? ALL_ZONES.find((z) => z.id === selectedZone) : null;

  const toggle = (id: string) => setSelectedZone(selectedZone === id ? null : id);

  // ─── Posterior grid rows (Base → Mid → Apex) ────────────────────────────
  // Each row: [R-Lat, R-Med, L-Med, L-Lat]
  // Apex row: P-RA spans cols 1-2, P-LA spans cols 3-4
  const postRows: Array<{
    level: string;
    cells: Array<{ id: string; colSpan?: number } | null>;
  }> = [
    {
      level: "BASE",
      cells: [
        { id: "P-RB-L" },
        { id: "P-RB-M" },
        { id: "P-LB-M" },
        { id: "P-LB-L" },
      ],
    },
    {
      level: "MID",
      cells: [
        { id: "P-RM-L" },
        { id: "P-RM-M" },
        { id: "P-LM-M" },
        { id: "P-LM-L" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/70">
        <span className="font-medium text-muted-foreground">Click zone to enter findings — 3D updates live</span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-blue-500 text-[7px] font-bold text-white">M</span> MRI
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-teal-500 text-[7px] font-bold text-white">U</span> MUS
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-purple-500 text-[7px] font-bold text-white">P</span> PSMA
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-amber-600 text-[7px] font-bold text-white">B</span> Bx
        </span>
      </div>

      {/* ── Posterior grid ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-muted/10 p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Posterior Zones
          </h4>
          <span className="text-[9px] text-muted-foreground/50">
            Surgical view from behind — patient R on right
          </span>
        </div>

        {/* Column headers */}
        <div className="mb-1 grid gap-1.5" style={{ gridTemplateColumns: "3rem repeat(4, 1fr)" }}>
          <div />
          <div className="text-center text-[9px] font-bold text-foreground/70">R Lat</div>
          <div className="text-center text-[9px] font-bold text-foreground/70">R Med</div>
          <div className="text-center text-[9px] font-bold text-foreground/70">L Med</div>
          <div className="text-center text-[9px] font-bold text-foreground/70">L Lat</div>
        </div>

        {/* Rows: Base → Mid → Apex */}
        <div className="space-y-1.5">
          {postRows.map((row) => (
            <div key={row.level} className="grid items-stretch gap-1.5" style={{ gridTemplateColumns: "3rem repeat(4, 1fr)" }}>
              {/* Level label */}
              <div className="flex items-center justify-end pr-1">
                <span className="text-[9px] font-bold text-foreground/60">{row.level}</span>
              </div>
              {/* Cells */}
              {row.cells.map((cell, _ci) => {
                if (cell === null) return null; // merged
                if (cell.colSpan && cell.colSpan > 1) {
                  const z = ALL_ZONES.find((zd) => zd.id === cell.id)!;
                  return (
                    <div
                      key={cell.id}
                      style={{ gridColumn: `span ${cell.colSpan}` }}
                    >
                      <ZoneCell
                        zone={z}
                        data={zoneData[cell.id]}
                        cancer={getCancer(cell.id)}
                        selected={selectedZone === cell.id}
                        onClick={() => toggle(cell.id)}
                        tall
                      />
                    </div>
                  );
                }
                const z = ALL_ZONES.find((zd) => zd.id === cell.id)!;
                return (
                  <ZoneCell
                    key={cell.id}
                    zone={z}
                    data={zoneData[cell.id]}
                    cancer={getCancer(cell.id)}
                    selected={selectedZone === cell.id}
                    onClick={() => toggle(cell.id)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Anterior grid ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-muted/10 p-3">
        <h4 className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Anterior Zones
        </h4>

        {/* Column headers */}
        <div className="mb-1 grid gap-1.5" style={{ gridTemplateColumns: "3rem 1fr 1fr" }}>
          <div />
          <div className="text-center text-[9px] font-bold text-foreground/70">R</div>
          <div className="text-center text-[9px] font-bold text-foreground/70">L</div>
        </div>

        {/* Rows: Base → Mid → Apex */}
        {(["Base", "Mid", "Apex"] as const).map((level) => {
          const rId = ANT_ZONES.find((z) => z.side === "R" && z.level === level)!.id;
          const lId = ANT_ZONES.find((z) => z.side === "L" && z.level === level)!.id;
          const rz = ANT_ZONES.find((z) => z.id === rId)!;
          const lz = ANT_ZONES.find((z) => z.id === lId)!;
          return (
            <div key={level} className="mb-1.5 grid items-stretch gap-1.5" style={{ gridTemplateColumns: "3rem 1fr 1fr" }}>
              <div className="flex items-center justify-end pr-1">
                <span className="text-[9px] font-bold text-foreground/60">{level.toUpperCase()}</span>
              </div>
              <ZoneCell
                zone={rz}
                data={zoneData[rId]}
                cancer={getCancer(rId)}
                selected={selectedZone === rId}
                onClick={() => toggle(rId)}
              />
              <ZoneCell
                zone={lz}
                data={zoneData[lId]}
                cancer={getCancer(lId)}
                selected={selectedZone === lId}
                onClick={() => toggle(lId)}
              />
            </div>
          );
        })}
      </div>

      {/* ── Zone detail panel ──────────────────────────────────────────── */}
      {selDef && (
        <ZoneDetail
          zone={selDef}
          data={zoneData[selDef.id] ?? {}}
          onUpdate={(patch) => updateZone(selDef.id, patch)}
          onClear={() => clearZone(selDef.id)}
          onClose={() => setSelectedZone(null)}
        />
      )}

      <div className="flex justify-between pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Demographics
        </Button>
        <Button type="button" size="sm" onClick={onNext}>
          Apply &amp; Update Model
        </Button>
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export function ZoneInputWizard() {
  const patients       = usePatientStore((s) => s.patients);
  const activeId       = usePatientStore((s) => s.activeId);
  const threeZones     = usePatientStore((s) => s.threeZones);
  const updateLesionRows   = usePatientStore((s) => s.updateLesionRows);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const pushHistory    = usePatientStore((s) => s.pushHistory);

  const entry = patients.find((p) => p.id === activeId);

  const [step, setStep]               = useState(1);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Step 1
  const [age, setAge] = useState("");
  const [psa, setPsa] = useState("");
  const [vol, setVol] = useState("");

  // Step 2
  const [zoneData, setZoneData] = useState<ZoneDataMap>({});

  // Genomic + functional (shown in Step 1)
  const [decipher, setDecipher] = useState("");
  const [shim, setShim] = useState("");
  const [ipss, setIpss] = useState("");

  // Initialise from patient record
  useEffect(() => {
    if (!entry) return;
    const rec = entry.record;
    // Treat 0 / null / undefined as blank so fields start empty on a new case
    const ageVal = rec.patient.age;
    const psaVal = rec.patient.psa;
    const volVal = rec.prostate.volume_cc;
    setAge(ageVal != null && ageVal > 0 ? String(ageVal) : "");
    setPsa(psaVal != null && psaVal > 0 ? String(psaVal) : "");
    setVol(volVal != null && volVal > 0 ? String(volVal) : "");
    setZoneData(rowsToZoneData(entry.lesionRows));

    setDecipher(
      rec.biopsy.decipher_score !== null && rec.biopsy.decipher_score !== undefined
        ? String(rec.biopsy.decipher_score)
        : "",
    );
    setShim(String(rec.patient.shim ?? ""));
    setIpss(String(rec.patient.ipss ?? ""));
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  const updateZone = useCallback(
    (zoneId: string, patch: Partial<ZoneModality>) => {
      setZoneData((prev) => {
        const next = { ...prev, [zoneId]: { ...(prev[zoneId] ?? {}), ...patch } };
        updateLesionRows(zoneDataToRows(next));
        return next;
      });
    },
    [updateLesionRows],
  );

  const clearZone = useCallback(
    (zoneId: string) => {
      setZoneData((prev) => {
        const next = { ...prev };
        delete next[zoneId];
        updateLesionRows(zoneDataToRows(next));
        return next;
      });
      setSelectedZone(null);
    },
    [updateLesionRows],
  );

  const applyAll = (currentZoneData = zoneData) => {
    const dec = parseFloat(decipher);
    const zones = Object.values(currentZoneData);
    updateClinicalForm({
      age: parseInt(age) || undefined,
      psa: parseFloat(psa) || 0,
      vol: parseFloat(vol) || 45,
      mri_epe:  zones.some((d) => d.mriEpe)  ? 1 : 0,
      mri_svi:  zones.some((d) => d.mriSvi)  ? 1 : 0,
      mus_ece:  zones.some((d) => d.musEce)  ? 1 : 0,
      mus_svi:  0,
      psma_epe: zones.some((d) => d.psmaEpe) ? 1 : 0,
      psma_svi: zones.some((d) => d.psmaSvi) ? 1 : 0,
      psma_ln:  zones.some((d) => d.psmaLn)  ? 1 : 0,
      dec: decipher === "" || isNaN(dec) ? null : dec,
      shim: parseInt(shim) || undefined,
      ipss: parseInt(ipss) || undefined,
      cribriform_bx: zones.some((d) => d.cribriform) ? 1 : 0,
      idc_bx:        zones.some((d) => d.idc)        ? 1 : 0,
      pni_bx:        zones.some((d) => d.pni)        ? 1 : 0,
      maxcore: Math.max(0, ...zones.map((d) => d.corePct ?? 0)),
      linear_mm: Math.max(0, ...zones.map((d) => d.linearMm ?? 0)) || undefined,
    });
    pushHistory();
  };

  if (!entry) return null;

  const totalFilled = ALL_ZONES.filter((z) => hasData(zoneData[z.id])).length;

  const STEPS = [
    { n: 1, label: "Demographics" },
    { n: 2, label: "Zone Locations", badge: totalFilled > 0 ? totalFilled : undefined },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Step tab bar */}
      <div className="flex border-b border-border bg-muted/20">
        {STEPS.map((st) => (
          <button
            key={st.n}
            type="button"
            onClick={() => {
              if (st.n > step && step === 1) applyAll();
              setStep(st.n);
              setSelectedZone(null);
            }}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 py-2.5 px-2 text-[11px] font-semibold transition-colors border-b-2",
              step === st.n
                ? "border-primary bg-primary/5 text-primary"
                : step > st.n
                  ? "border-primary/30 text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  : "border-transparent text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/10",
            )}
          >
            <span
              className={cn(
                "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                step === st.n ? "bg-primary text-primary-foreground" :
                step > st.n  ? "bg-primary/40 text-primary-foreground" :
                               "bg-muted text-muted-foreground",
              )}
            >
              {step > st.n ? "✓" : st.n}
            </span>
            <span className="hidden sm:inline">{st.label}</span>
            {st.badge !== undefined && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                {st.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4">
        {step === 1 && (
          <Step1
            age={age} setAge={setAge}
            psa={psa} setPsa={setPsa}
            vol={vol} setVol={setVol}
            decipher={decipher} setDecipher={setDecipher}
            shim={shim} setShim={setShim}
            ipss={ipss} setIpss={setIpss}
            onNext={() => { applyAll(); setStep(2); }}
          />
        )}
        {step === 2 && (
          <Step2
            zoneData={zoneData}
            threeZones={threeZones}
            selectedZone={selectedZone}
            setSelectedZone={setSelectedZone}
            updateZone={updateZone}
            clearZone={clearZone}
            onBack={() => setStep(1)}
            onNext={() => applyAll()}
          />
        )}
      </div>
    </div>
  );
}
