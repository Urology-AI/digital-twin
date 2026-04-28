import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/patientStore";
import { emptyLesion, type LesionRow } from "@/types/lesion";
import type { PfmtLevel, Pde5Regimen, AlcoholLevel, SmokingStatus, ExerciseLevel } from "@/lib/compass/functionalOutcomes";
import { cn } from "@/lib/utils";

// ── Zone definitions ──────────────────────────────────────────────────────────
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
  { id: "A-RA", label: "R Apex",     shortLabel: "A-R", side: "R", level: "Apex", pos: "Anterior" },
  { id: "A-LA", label: "L Apex",     shortLabel: "A-L", side: "L", level: "Apex", pos: "Anterior" },
];

const ALL_ZONES: ZoneDef[] = [...POST_ZONES, ...ANT_ZONES];

// ── Per-zone modality data ────────────────────────────────────────────────────
interface ZoneModality {
  pirads?: number;
  mriSize?: number;
  mriAbut?: number;
  mriAdc?: number;
  mriEpe?: boolean;
  mriSvi?: boolean;
  primus?: number;
  musEce?: boolean;
  musAbut?: boolean;
  suv?: number;
  psmaEpe?: boolean;
  psmaSvi?: boolean;
  psmaLn?: boolean;
  gg?: number;
  corePct?: number;
  linearMm?: number;
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
      if (row.mriAdc > 0) d.mriAdc = d.mriAdc ? Math.min(d.mriAdc, row.mriAdc) : row.mriAdc;
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
      rows.push({ ...emptyLesion(`${zone.id}-mri`), source: "MRI", side: zone.side, level: zone.level, zone: zone.pos, score: String(d.pirads), pirads: d.pirads, mriSize: d.mriSize ?? 0, mriAbutment: d.mriAbut ?? -1, mriAdc: d.mriAdc ?? 0, epe: d.mriEpe ?? false, svi: d.mriSvi ?? false });
    }
    if (d.suv && d.suv > 0) {
      rows.push({ ...emptyLesion(`${zone.id}-psma`), source: "PSMA", side: zone.side, level: zone.level, zone: zone.pos, score: String(d.suv), suv: d.suv, epe: d.psmaEpe ?? false, svi: d.psmaSvi ?? false, psmaLn: d.psmaLn ?? false });
    }
    if (d.primus && d.primus > 0) {
      rows.push({ ...emptyLesion(`${zone.id}-mus`), source: "MUS", side: zone.side, level: zone.level, zone: zone.pos, score: String(d.primus), primus: d.primus, epe: d.musEce ?? false, mriAbutment: d.musAbut ? 1 : 0 });
    }
    if (d.gg && d.gg > 0) {
      rows.push({ ...emptyLesion(`${zone.id}-bx`), source: "Bx", side: zone.side, level: zone.level, zone: zone.pos, score: String(d.gg), corePct: d.corePct ?? 0, linear: d.linearMm ?? 0, cribriform: d.cribriform ?? false, idc: d.idc ?? false, pni: d.pni ?? false });
    }
  }
  return rows;
}

function hasData(d?: ZoneModality): boolean {
  if (!d) return false;
  return !!((d.pirads && d.pirads > 0) || (d.suv && d.suv > 0) || (d.primus && d.primus > 0) || (d.gg && d.gg > 0));
}

function riskBorder(cancer: number, selected: boolean, filled: boolean): string {
  if (selected) return "border-primary ring-1 ring-primary/50 bg-primary/10";
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
function ChipSelector({ value, options, onChange, label, width = "w-20" }: {
  value: number | undefined;
  options: { v: number; l: string }[];
  onChange: (v: number | undefined) => void;
  label: string;
  width?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground", width)}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(value === o.v ? undefined : o.v)}
            className={cn("flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-sm font-semibold transition-colors",
              value === o.v ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground")}
            title={o.l}>{o.v}</button>
        ))}
        {value !== undefined && (
          <button type="button" onClick={() => onChange(undefined)}
            className="flex h-8 w-7 items-center justify-center rounded text-sm text-muted-foreground/50 hover:bg-muted/40"
            title="Clear">×</button>
        )}
      </div>
    </div>
  );
}

// ── Zone cell (taller for squarer proportion) ─────────────────────────────────
function ZoneCell({ zone, data, cancer, selected, onClick }: {
  zone: ZoneDef; data?: ZoneModality; cancer: number; selected: boolean; onClick: () => void;
}) {
  const filled = hasData(data);
  const pct = Math.round(cancer * 100);
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-between rounded-md border p-2 transition-all w-full min-h-[80px]",
        riskBorder(cancer, selected, filled),
      )}>
      <span className="text-[11px] font-semibold leading-tight text-center text-foreground/90">{zone.label}</span>
      <div className="flex gap-0.5 mt-1">
        {data?.pirads && data.pirads > 0 ? <span className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-sm bg-blue-500 text-[8px] font-bold text-white">M</span> : null}
        {data?.primus && data.primus > 0 ? <span className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-sm bg-teal-500 text-[8px] font-bold text-white">U</span> : null}
        {data?.suv && data.suv > 0 ? <span className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-sm bg-purple-500 text-[8px] font-bold text-white">P</span> : null}
        {data?.gg && data.gg > 0 ? <span className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-sm bg-amber-600 text-[8px] font-bold text-white">B</span> : null}
      </div>
      {filled && (
        <span className={cn("text-[10px] font-bold tabular-nums mt-0.5",
          cancer >= 0.5 ? "text-red-400" : cancer >= 0.3 ? "text-orange-400" : cancer >= 0.15 ? "text-yellow-400" : "text-emerald-400")}>
          {pct}%
        </span>
      )}
      {filled && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-md overflow-hidden">
          <div className={cn("h-full", riskBarColor(cancer))} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </button>
  );
}

// ── Zone detail panel ─────────────────────────────────────────────────────────
function ZoneDetail({ zone, data, onUpdate, onClear, onClose }: {
  zone: ZoneDef; data: ZoneModality;
  onUpdate: (patch: Partial<ZoneModality>) => void;
  onClear: () => void; onClose: () => void;
}) {
  const PIRADS_OPTS = [{ v: 1, l: "1 – Very low" }, { v: 2, l: "2 – Low" }, { v: 3, l: "3 – Intermediate" }, { v: 4, l: "4 – High" }, { v: 5, l: "5 – Very high" }];
  const MUS_OPTS = [{ v: 1, l: "1 – Normal" }, { v: 2, l: "2 – Low" }, { v: 3, l: "3 – Suspicious" }, { v: 4, l: "4 – High" }, { v: 5, l: "5 – Very high" }];
  const GG_OPTS = [{ v: 1, l: "Grade Group 1" }, { v: 2, l: "Grade Group 2" }, { v: 3, l: "Grade Group 3" }, { v: 4, l: "Grade Group 4" }, { v: 5, l: "Grade Group 5" }];
  const ABUT_OPTS = [{ v: -1, l: "— Not assessed" }, { v: 0, l: "0 — No contact" }, { v: 1, l: "1 — Abuts capsule" }, { v: 2, l: "2 — Broad (>1 cm)" }, { v: 3, l: "3 — Irreg / EPE?" }, { v: 4, l: "4 — Definite bulge" }];
  const hasMri = (data.pirads ?? 0) > 0;
  const hasBx = (data.gg ?? 0) > 0;

  return (
    <div className="rounded-xl border border-primary/30 bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">{zone.label}</span>
          {hasData(data) && <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">{zone.side} · {zone.level} · {zone.pos}</span>}
        </div>
        <div className="flex items-center gap-3">
          {hasData(data) && <button type="button" onClick={onClear} className="text-[10px] font-medium text-destructive/70 hover:text-destructive">Clear all</button>}
          <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted/40 hover:text-foreground text-sm">×</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4">
        {/* MRI */}
        <div className="space-y-3 rounded-lg border border-blue-500/25 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-[9px] font-bold text-white">M</span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">MRI</span>
          </div>
          <ChipSelector label="PI-RADS" value={data.pirads} options={PIRADS_OPTS} onChange={(v) => onUpdate({ pirads: v })} />
          {hasMri && (<>
            <div className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Size</span>
              <Input type="number" step="0.5" min={0} placeholder="mm" className="h-8 w-20 px-2 text-sm" value={data.mriSize ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ mriSize: isNaN(v) ? undefined : v }); }} />
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">ADC</span>
              <Input type="number" step="10" min={0} placeholder="µm²/s" className="h-8 w-24 px-2 text-sm" value={data.mriAdc ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ mriAdc: isNaN(v) ? undefined : v }); }} />
              <span className="text-xs text-muted-foreground">µm²/s</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abut</span>
              <select className="h-8 flex-1 rounded border border-input/80 bg-background px-2 text-sm text-foreground" value={data.mriAbut ?? -1} onChange={(e) => { const v = parseInt(e.target.value, 10); onUpdate({ mriAbut: v === -1 ? undefined : v }); }}>
                {ABUT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4 pl-[5.5rem]">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.mriEpe ?? false} onChange={(e) => onUpdate({ mriEpe: e.target.checked })} />EPE</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.mriSvi ?? false} onChange={(e) => onUpdate({ mriSvi: e.target.checked })} />SVI</label>
            </div>
          </>)}
        </div>
        {/* MUS */}
        <div className="space-y-3 rounded-lg border border-teal-500/25 bg-teal-500/5 p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-teal-500 text-[9px] font-bold text-white">U</span>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Micro-US</span>
          </div>
          <ChipSelector label="PRI-MUS" value={data.primus} options={MUS_OPTS} onChange={(v) => onUpdate({ primus: v })} />
          {(data.primus ?? 0) > 0 && (
            <div className="flex flex-col gap-2 pl-[5.5rem]">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.musEce ?? false} onChange={(e) => onUpdate({ musEce: e.target.checked })} />ECE on MUS</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.musAbut ?? false} onChange={(e) => onUpdate({ musAbut: e.target.checked })} />Abutment</label>
            </div>
          )}
        </div>
        {/* PSMA */}
        <div className="space-y-3 rounded-lg border border-purple-500/25 bg-purple-500/5 p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-purple-500 text-[9px] font-bold text-white">P</span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">PSMA PET</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">SUVmax</span>
            <Input type="number" step="0.1" min={0} placeholder="e.g. 12.4" className="h-8 w-28 px-2 text-sm" value={data.suv ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ suv: isNaN(v) ? undefined : v }); }} />
          </div>
          {(data.suv ?? 0) > 0 && (
            <div className="flex items-center gap-4 pl-[5.5rem]">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.psmaEpe ?? false} onChange={(e) => onUpdate({ psmaEpe: e.target.checked })} />EPE</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.psmaSvi ?? false} onChange={(e) => onUpdate({ psmaSvi: e.target.checked })} />SVI</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.psmaLn ?? false} onChange={(e) => onUpdate({ psmaLn: e.target.checked })} />LN+</label>
            </div>
          )}
        </div>
        {/* Biopsy */}
        <div className="space-y-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-600 text-[9px] font-bold text-white">B</span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Biopsy</span>
          </div>
          <ChipSelector label="Grade Grp" value={data.gg} options={GG_OPTS} onChange={(v) => onUpdate({ gg: v })} />
          {hasBx && (<>
            <div className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Core %</span>
              <Input type="number" step="1" min={0} max={100} placeholder="0–100" className="h-8 w-20 px-2 text-sm" value={data.corePct ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ corePct: isNaN(v) ? undefined : v }); }} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linear</span>
              <Input type="number" step="0.5" min={0} placeholder="mm" className="h-8 w-20 px-2 text-sm" value={data.linearMm ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ linearMm: isNaN(v) ? undefined : v }); }} />
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <div className="flex items-center gap-3 pl-[5.5rem]">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.cribriform ?? false} onChange={(e) => onUpdate({ cribriform: e.target.checked })} />Cribriform</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.idc ?? false} onChange={(e) => onUpdate({ idc: e.target.checked })} />IDC</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.pni ?? false} onChange={(e) => onUpdate({ pni: e.target.checked })} />PNI</label>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ── Segment picker ────────────────────────────────────────────────────────────
function SegPicker<T extends string>({ label, options, value, onChange }: {
  label: string; options: { label: string; value: T }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <div className="flex overflow-hidden rounded-lg border border-border divide-x divide-border">
        {options.map((opt) => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={cn("flex-1 px-2 py-2.5 text-sm font-medium transition-colors",
              value === opt.value ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/60")}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export function ZoneInputWizard() {
  const patients           = usePatientStore((s) => s.patients);
  const activeId           = usePatientStore((s) => s.activeId);
  const threeZones         = usePatientStore((s) => s.threeZones);
  const updateLesionRows   = usePatientStore((s) => s.updateLesionRows);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const pushHistory        = usePatientStore((s) => s.pushHistory);

  const entry = patients.find((p) => p.id === activeId);

  const [activeTab, setActiveTab]       = useState<1 | 2 | 3>(1);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const [age,      setAge]      = useState("");
  const [psa,      setPsa]      = useState("");
  const [vol,      setVol]      = useState("");
  const [decipher, setDecipher] = useState("");
  const [shim,     setShim]     = useState("");
  const [ipss,     setIpss]     = useState("");
  const [zoneData, setZoneData] = useState<ZoneDataMap>({});
  const [bmi,      setBmi]      = useState("");
  const [pfmt,     setPfmt]     = useState<PfmtLevel>("basic");
  const [exercise, setExercise] = useState<ExerciseLevel>("moderate");
  const [smoking,  setSmoking]  = useState<SmokingStatus>("never");
  const [pde5,     setPde5]     = useState<Pde5Regimen>("prn");
  const [alcohol,  setAlcohol]  = useState<AlcoholLevel>("moderate");
  const [dm,       setDm]       = useState(false);
  const [htn,      setHtn]      = useState(false);
  const [cad,      setCad]      = useState(false);

  useEffect(() => {
    if (!entry) return;
    const rec = entry.record;
    setAge(rec.patient.age != null && rec.patient.age > 0 ? String(rec.patient.age) : "");
    setPsa(rec.patient.psa != null && rec.patient.psa > 0 ? String(rec.patient.psa) : "");
    setVol(rec.prostate.volume_cc != null && rec.prostate.volume_cc > 0 ? String(rec.prostate.volume_cc) : "");
    setZoneData(rowsToZoneData(entry.lesionRows));
    setDecipher(rec.biopsy.decipher_score !== null && rec.biopsy.decipher_score !== undefined ? String(rec.biopsy.decipher_score) : "");
    setShim(String(rec.patient.shim ?? ""));
    setIpss(String(rec.patient.ipss ?? ""));
    setBmi(rec.patient.bmi != null && rec.patient.bmi > 0 ? String(rec.patient.bmi) : "");
    setSmoking((rec.patient.smoking as SmokingStatus | undefined) ?? "never");
    setExercise((rec.patient.exercise as ExerciseLevel | undefined) ?? "moderate");
    setPfmt((rec.patient.pfmt as PfmtLevel | undefined) ?? "basic");
    setAlcohol((rec.patient.alcohol as AlcoholLevel | undefined) ?? "moderate");
    if (rec.patient.pde5_plan) setPde5(rec.patient.pde5_plan as Pde5Regimen);
    else if (rec.patient.pde5 === true) setPde5("daily");
    else setPde5("prn");
    setDm(rec.patient.dm ?? false);
    setHtn(rec.patient.htn ?? false);
    setCad(rec.patient.cad ?? false);
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateZone = useCallback((zoneId: string, patch: Partial<ZoneModality>) => {
    setZoneData((prev) => {
      const next = { ...prev, [zoneId]: { ...(prev[zoneId] ?? {}), ...patch } };
      updateLesionRows(zoneDataToRows(next));
      return next;
    });
  }, [updateLesionRows]);

  const clearZone = useCallback((zoneId: string) => {
    setZoneData((prev) => {
      const next = { ...prev };
      delete next[zoneId];
      updateLesionRows(zoneDataToRows(next));
      return next;
    });
    setSelectedZone(null);
  }, [updateLesionRows]);

  const handleAgeChange      = (v: string) => { setAge(v);      updateClinicalForm({ age: parseInt(v) || undefined }); };
  const handlePsaChange      = (v: string) => { setPsa(v);      updateClinicalForm({ psa: parseFloat(v) || 0 }); };
  const handleVolChange      = (v: string) => { setVol(v);      updateClinicalForm({ vol: parseFloat(v) || 45 }); };
  const handleDecipherChange = (v: string) => { setDecipher(v); const d = parseFloat(v); updateClinicalForm({ dec: v === "" || isNaN(d) ? null : d }); };
  const handleShimChange     = (v: string) => { setShim(v);     updateClinicalForm({ shim: parseInt(v) || undefined }); };
  const handleIpssChange     = (v: string) => { setIpss(v);     updateClinicalForm({ ipss: parseInt(v) || undefined }); };
  const handleBmiChange      = (v: string) => { setBmi(v);      const n = parseFloat(v); updateClinicalForm({ bmi: n > 0 && !isNaN(n) ? n : undefined }); };
  const handlePfmtChange     = (v: PfmtLevel)     => { setPfmt(v);     updateClinicalForm({ pfmt: v }); };
  const handleExerciseChange = (v: ExerciseLevel) => { setExercise(v); updateClinicalForm({ exercise: v }); };
  const handleSmokingChange  = (v: SmokingStatus) => { setSmoking(v);  updateClinicalForm({ smoking: v }); };
  const handlePde5Change     = (v: Pde5Regimen)   => { setPde5(v);     updateClinicalForm({ pde5: v }); };
  const handleAlcoholChange  = (v: AlcoholLevel)  => { setAlcohol(v);  updateClinicalForm({ alcohol: v }); };
  const handleDmChange       = (v: boolean) => { setDm(v);  updateClinicalForm({ dm: v }); };
  const handleHtnChange      = (v: boolean) => { setHtn(v); updateClinicalForm({ htn: v }); };
  const handleCadChange      = (v: boolean) => { setCad(v); updateClinicalForm({ cad: v }); };

  const applyAll = () => {
    const dec = parseFloat(decipher);
    const bmiNum = parseFloat(bmi);
    const zones = Object.values(zoneData);
    updateClinicalForm({
      age: parseInt(age) || undefined, psa: parseFloat(psa) || 0, vol: parseFloat(vol) || 45,
      bmi: bmiNum > 0 && !isNaN(bmiNum) ? bmiNum : undefined,
      dm, htn, cad, smoking, exercise, pfmt, alcohol, pde5,
      mri_epe: zones.some((d) => d.mriEpe) ? 1 : 0, mri_svi: zones.some((d) => d.mriSvi) ? 1 : 0,
      mus_ece: zones.some((d) => d.musEce) ? 1 : 0, mus_svi: 0,
      psma_epe: zones.some((d) => d.psmaEpe) ? 1 : 0, psma_svi: zones.some((d) => d.psmaSvi) ? 1 : 0,
      psma_ln: zones.some((d) => d.psmaLn) ? 1 : 0,
      dec: decipher === "" || isNaN(dec) ? null : dec,
      shim: parseInt(shim) || undefined, ipss: parseInt(ipss) || undefined,
      cribriform_bx: zones.some((d) => d.cribriform) ? 1 : 0,
      idc_bx: zones.some((d) => d.idc) ? 1 : 0,
      pni_bx: zones.some((d) => d.pni) ? 1 : 0,
      maxcore: Math.max(0, ...zones.map((d) => d.corePct ?? 0)),
      linear_mm: Math.max(0, ...zones.map((d) => d.linearMm ?? 0)) || undefined,
    });
    pushHistory();
  };

  if (!entry) return null;

  const psaNum  = parseFloat(psa);
  const volNum  = parseFloat(vol);
  const psad    = volNum > 0 && !isNaN(psaNum) ? (psaNum / volNum).toFixed(3) : "—";
  const psaWarn = !isNaN(psaNum) && psaNum > 0 && (psaNum > 100 || psaNum < 0.1);
  const volWarn = !isNaN(volNum) && volNum > 0 && (volNum < 10 || volNum > 250);
  const bmiNum  = parseFloat(bmi);
  const bmiCat  = isNaN(bmiNum) || bmiNum <= 0 ? null
    : bmiNum < 18.5 ? "Underweight" : bmiNum < 25 ? "Normal" : bmiNum < 30 ? "Overweight" : "Obese";

  const totalFilled = ALL_ZONES.filter((z) => hasData(zoneData[z.id])).length;
  const getCancer   = (id: string) => threeZones.find((z) => z.id === id)?.cancer ?? 0.02;
  const selDef      = selectedZone ? ALL_ZONES.find((z) => z.id === selectedZone) : null;
  const toggle      = (id: string) => setSelectedZone(selectedZone === id ? null : id);

  const postRows = [
    { level: "BASE", cells: [{ id: "P-RB-L" }, { id: "P-RB-M" }, { id: "P-LB-M" }, { id: "P-LB-L" }] },
    { level: "MID",  cells: [{ id: "P-RM-L" }, { id: "P-RM-M" }, { id: "P-LM-M" }, { id: "P-LM-L" }] },
  ];

  const TABS = [
    { n: 1 as const, label: "Demographics" },
    { n: 2 as const, label: "Zone Locations" },
    { n: 3 as const, label: "Modifiable Factors" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Tab bar ── */}
      <div className="flex shrink-0 border-b border-border bg-muted/20">
        {TABS.map((tab) => (
          <button
            key={tab.n}
            type="button"
            onClick={() => { setActiveTab(tab.n); setSelectedZone(null); }}
            className={cn(
              "flex flex-1 items-center justify-center gap-3 border-b-[3px] py-[18px] text-base font-bold transition-colors",
              activeTab === tab.n
                ? "border-primary bg-primary/5 text-primary"
                : "border-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground",
            )}
          >
            <span className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black",
              activeTab === tab.n ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground",
            )}>
              {activeTab > tab.n ? "✓" : tab.n}
            </span>
            {tab.label}
            {tab.n === 2 && totalFilled > 0 && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-bold text-primary">{totalFilled}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Demographics ── */}
      {activeTab === 1 && (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-7 p-8">
            <div>
              <h3 className="text-2xl font-bold text-foreground">Demographics &amp; Labs</h3>
              <p className="mt-1 text-sm text-muted-foreground">Baseline parameters for risk calibration</p>
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-age">Age <span className="font-normal text-muted-foreground">(years)</span></label>
                <Input id="wiz-age" type="number" min={18} max={120} inputMode="numeric" placeholder="65" value={age} onChange={(e) => handleAgeChange(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-psa">PSA <span className="font-normal text-muted-foreground">(ng/mL)</span></label>
                <Input id="wiz-psa" type="number" step="0.1" inputMode="decimal" placeholder="6.5" value={psa} onChange={(e) => handlePsaChange(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-vol">Volume <span className="font-normal text-muted-foreground">(cc)</span></label>
                <Input id="wiz-vol" type="number" step="0.1" inputMode="decimal" placeholder="45" value={vol} onChange={(e) => handleVolChange(e.target.value)} className="h-11 text-base" />
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/40 px-5 py-4">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">PSAD</span>
              <span className="text-3xl font-black tabular-nums text-primary">{psad}</span>
              <span className="text-sm text-muted-foreground">ng/mL/cc</span>
            </div>

            {(psaWarn || volWarn) && (
              <div className="space-y-1.5">
                {psaNum > 100 && <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-500">PSA {psaNum} ng/mL — verify entry</div>}
                {psaNum > 0 && psaNum < 0.1 && <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-500">PSA &lt; 0.1 — post-treatment?</div>}
                {volNum > 0 && volNum < 10 && <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-500">Volume {volNum} cc — very small</div>}
                {volNum > 250 && <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-500">Volume {volNum} cc — very large</div>}
              </div>
            )}

            <div className="grid grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-dec">Decipher <span className="font-normal text-muted-foreground">(0–1)</span></label>
                <Input id="wiz-dec" type="text" inputMode="decimal" placeholder="0.52" value={decipher} onChange={(e) => handleDecipherChange(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-shim">SHIM <span className="font-normal text-muted-foreground">(0–25)</span></label>
                <Input id="wiz-shim" type="number" min={0} max={25} inputMode="numeric" placeholder="21" value={shim} onChange={(e) => handleShimChange(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-ipss">IPSS <span className="font-normal text-muted-foreground">(0–35)</span></label>
                <Input id="wiz-ipss" type="number" min={0} max={35} inputMode="numeric" placeholder="8" value={ipss} onChange={(e) => handleIpssChange(e.target.value)} className="h-11 text-base" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" size="lg" onClick={() => setActiveTab(2)}>
                Next: Zone Locations →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Zone Locations ── */}
      {activeTab === 2 && (
        <div className="flex flex-1 overflow-hidden">
          {/* Zone grids */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            {/* Legend */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground/80">
              <span className="font-semibold text-muted-foreground">Click zone → enter findings · 3D updates live</span>
              <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-blue-500 text-[8px] font-bold text-white">M</span> MRI</span>
              <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-teal-500 text-[8px] font-bold text-white">U</span> MUS</span>
              <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-purple-500 text-[8px] font-bold text-white">P</span> PSMA</span>
              <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-600 text-[8px] font-bold text-white">B</span> Bx</span>
            </div>

            {/* Posterior grid */}
            <div className="shrink-0 rounded-xl border border-border bg-muted/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Posterior Zones</h4>
                <span className="text-xs text-muted-foreground/50">Surgical view — patient R on right</span>
              </div>
              <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: "3.5rem repeat(4, 1fr)" }}>
                <div />
                {["R Lat", "R Med", "L Med", "L Lat"].map((h) => (
                  <div key={h} className="text-center text-xs font-bold text-foreground/70">{h}</div>
                ))}
              </div>
              <div className="space-y-2">
                {postRows.map((row) => (
                  <div key={row.level} className="grid items-stretch gap-2" style={{ gridTemplateColumns: "3.5rem repeat(4, 1fr)" }}>
                    <div className="flex items-center justify-end pr-1.5">
                      <span className="text-xs font-bold text-foreground/60">{row.level}</span>
                    </div>
                    {row.cells.map((cell) => {
                      const z = ALL_ZONES.find((zd) => zd.id === cell.id)!;
                      return <ZoneCell key={cell.id} zone={z} data={zoneData[cell.id]} cancer={getCancer(cell.id)} selected={selectedZone === cell.id} onClick={() => toggle(cell.id)} />;
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Anterior grid */}
            <div className="shrink-0 rounded-xl border border-border bg-muted/10 p-4">
              <h4 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Anterior Zones</h4>
              <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: "3.5rem 1fr 1fr" }}>
                <div />
                <div className="text-center text-xs font-bold text-foreground/70">R</div>
                <div className="text-center text-xs font-bold text-foreground/70">L</div>
              </div>
              <div className="space-y-2">
                {(["Base", "Mid", "Apex"] as const).map((level) => {
                  const rId = ANT_ZONES.find((z) => z.side === "R" && z.level === level)!.id;
                  const lId = ANT_ZONES.find((z) => z.side === "L" && z.level === level)!.id;
                  return (
                    <div key={level} className="grid items-stretch gap-2" style={{ gridTemplateColumns: "3.5rem 1fr 1fr" }}>
                      <div className="flex items-center justify-end pr-1.5">
                        <span className="text-xs font-bold text-foreground/60">{level.toUpperCase()}</span>
                      </div>
                      <ZoneCell zone={ANT_ZONES.find((z) => z.id === rId)!} data={zoneData[rId]} cancer={getCancer(rId)} selected={selectedZone === rId} onClick={() => toggle(rId)} />
                      <ZoneCell zone={ANT_ZONES.find((z) => z.id === lId)!} data={zoneData[lId]} cancer={getCancer(lId)} selected={selectedZone === lId} onClick={() => toggle(lId)} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Zone detail — right panel when zone selected */}
          {selDef && (
            <div className="w-[540px] shrink-0 overflow-y-auto border-l border-border p-5">
              <ZoneDetail
                zone={selDef}
                data={zoneData[selDef.id] ?? {}}
                onUpdate={(patch) => updateZone(selDef.id, patch)}
                onClear={() => clearZone(selDef.id)}
                onClose={() => setSelectedZone(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Modifiable Factors ── */}
      {activeTab === 3 && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto border-r border-border p-7 space-y-6">
            <h3 className="text-2xl font-bold text-foreground">Body &amp; Lifestyle</h3>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="wiz-bmi">BMI <span className="font-normal text-muted-foreground">(kg/m²)</span></label>
              <div className="flex items-center gap-3">
                <Input id="wiz-bmi" type="number" step="0.5" min={10} max={60} inputMode="decimal" placeholder="27.0" value={bmi} onChange={(e) => handleBmiChange(e.target.value)} className="h-11 w-36 text-base" />
                {bmiCat && (
                  <span className={cn("rounded-full px-3 py-1 text-sm font-semibold",
                    bmiNum < 18.5 ? "bg-blue-500/10 text-blue-500" : bmiNum < 25 ? "bg-emerald-500/10 text-emerald-400" : bmiNum < 30 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-500")}>
                    {bmiCat}
                  </span>
                )}
              </div>
            </div>

            <SegPicker<PfmtLevel> label="Pelvic Floor Training (PFMT)"
              options={[{ label: "None", value: "none" }, { label: "Basic", value: "basic" }, { label: "Moderate", value: "moderate" }, { label: "Intensive", value: "intensive" }]}
              value={pfmt} onChange={handlePfmtChange} />
            <SegPicker<ExerciseLevel> label="Exercise Level"
              options={[{ label: "Sedentary", value: "sedentary" }, { label: "Light", value: "light" }, { label: "Moderate", value: "moderate" }, { label: "Active", value: "active" }]}
              value={exercise} onChange={handleExerciseChange} />
            <SegPicker<SmokingStatus> label="Smoking Status"
              options={[{ label: "Never", value: "never" }, { label: "Former", value: "former" }, { label: "Current", value: "current" }]}
              value={smoking} onChange={handleSmokingChange} />
          </div>

          <div className="flex-1 overflow-y-auto p-7 space-y-6">
            <h3 className="text-2xl font-bold text-foreground">Medical Factors</h3>

            <SegPicker<Pde5Regimen> label="PDE5 Inhibitor Plan"
              options={[{ label: "None", value: "none" }, { label: "PRN", value: "prn" }, { label: "Daily", value: "daily" }]}
              value={pde5} onChange={handlePde5Change} />
            <SegPicker<AlcoholLevel> label="Alcohol Usage"
              options={[{ label: "None", value: "none" }, { label: "Moderate", value: "moderate" }, { label: "Heavy", value: "heavy" }]}
              value={alcohol} onChange={handleAlcoholChange} />

            <div className="space-y-2.5">
              <div className="text-sm font-semibold text-foreground">Comorbidities</div>
              <div className="flex gap-3">
                {([["Diabetes", dm, handleDmChange], ["HTN", htn, handleHtnChange], ["CAD", cad, handleCadChange]] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter]) => (
                  <button key={label} type="button" onClick={() => setter(!val)}
                    className={cn("flex-1 rounded-lg border-2 px-3 py-3 text-sm font-bold transition-all",
                      val ? "border-red-500 bg-red-500/10 text-red-400" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted/60")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button type="button" size="lg" onClick={applyAll} className="w-full">
                Apply &amp; Save Checkpoint
              </Button>
              <p className="text-xs text-muted-foreground/70">Changes update predictions live. Checkpoint saves an undo point.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
