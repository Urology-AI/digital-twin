import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatientStore } from "@/store/patientStore";
import { useUiStore } from "@/store/uiStore";
import { emptyLesion, type LesionRow } from "@/types/lesion";
import { cn } from "@/lib/utils";
import { NoteImportModal, type NoteImportClinical } from "@/components/NoteImportModal";

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
function ChipSelector({ value, options, onChange, label }: {
  value: number | undefined;
  options: { v: number; l: string }[];
  onChange: (v: number | undefined) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(value === o.v ? undefined : o.v)}
            className={cn("flex h-7 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-xs font-semibold transition-colors",
              value === o.v ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground")}
            title={o.l}>{o.v}</button>
        ))}
        {value !== undefined && (
          <button type="button" onClick={() => onChange(undefined)}
            className="flex h-7 w-6 items-center justify-center rounded text-xs text-muted-foreground/50 hover:bg-muted/40"
            title="Clear">×</button>
        )}
      </div>
    </div>
  );
}

// ── Labeled input row (label above, input grows to fill) ──────────────────────
function FieldRow({
  label, unit, children,
}: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">{children}</div>
        {unit && <span className="shrink-0 text-[10px] text-muted-foreground">{unit}</span>}
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
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4">
        {/* MRI */}
        <div className="space-y-2.5 rounded-lg border border-blue-500/25 bg-blue-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-[9px] font-bold text-white">M</span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">MRI</span>
          </div>
          <ChipSelector label="PI-RADS" value={data.pirads} options={PIRADS_OPTS} onChange={(v) => onUpdate({ pirads: v })} />
          {hasMri && (<>
            <FieldRow label="Size" unit="mm">
              <Input type="number" step="0.5" min={0} placeholder="mm" className="h-8 w-full px-2 text-sm" value={data.mriSize ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ mriSize: isNaN(v) ? undefined : v }); }} />
            </FieldRow>
            <FieldRow label="ADC" unit="µm²/s">
              <Input type="number" step="10" min={0} placeholder="ADC" className="h-8 w-full px-2 text-sm" value={data.mriAdc ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ mriAdc: isNaN(v) ? undefined : v }); }} />
            </FieldRow>
            <FieldRow label="Abutment">
              <select className="h-8 w-full min-w-0 rounded border border-input/80 bg-background px-2 text-sm text-foreground" value={data.mriAbut ?? -1} onChange={(e) => { const v = parseInt(e.target.value, 10); onUpdate({ mriAbut: v === -1 ? undefined : v }); }}>
                {ABUT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </FieldRow>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.mriEpe ?? false} onChange={(e) => onUpdate({ mriEpe: e.target.checked })} />EPE</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.mriSvi ?? false} onChange={(e) => onUpdate({ mriSvi: e.target.checked })} />SVI</label>
            </div>
          </>)}
        </div>
        {/* MUS */}
        <div className="space-y-2.5 rounded-lg border border-teal-500/25 bg-teal-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-teal-500 text-[9px] font-bold text-white">U</span>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Micro-US</span>
          </div>
          <ChipSelector label="PRI-MUS" value={data.primus} options={MUS_OPTS} onChange={(v) => onUpdate({ primus: v })} />
          {(data.primus ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.musEce ?? false} onChange={(e) => onUpdate({ musEce: e.target.checked })} />ECE on MUS</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.musAbut ?? false} onChange={(e) => onUpdate({ musAbut: e.target.checked })} />Abutment</label>
            </div>
          )}
        </div>
        {/* PSMA */}
        <div className="space-y-2.5 rounded-lg border border-purple-500/25 bg-purple-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-purple-500 text-[9px] font-bold text-white">P</span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">PSMA PET</span>
          </div>
          <FieldRow label="SUVmax">
            <Input type="number" step="0.1" min={0} placeholder="e.g. 12.4" className="h-8 w-full px-2 text-sm" value={data.suv ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ suv: isNaN(v) ? undefined : v }); }} />
          </FieldRow>
          {(data.suv ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.psmaEpe ?? false} onChange={(e) => onUpdate({ psmaEpe: e.target.checked })} />EPE</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.psmaSvi ?? false} onChange={(e) => onUpdate({ psmaSvi: e.target.checked })} />SVI</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><input type="checkbox" className="h-3.5 w-3.5 rounded accent-primary" checked={data.psmaLn ?? false} onChange={(e) => onUpdate({ psmaLn: e.target.checked })} />LN+</label>
            </div>
          )}
        </div>
        {/* Biopsy */}
        <div className="space-y-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-600 text-[9px] font-bold text-white">B</span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Biopsy</span>
          </div>
          <ChipSelector label="Grade Grp" value={data.gg} options={GG_OPTS} onChange={(v) => onUpdate({ gg: v })} />
          {hasBx && (<>
            <FieldRow label="Core %" unit="%">
              <Input type="number" step="1" min={0} max={100} placeholder="0–100" className="h-8 w-full px-2 text-sm" value={data.corePct ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ corePct: isNaN(v) ? undefined : v }); }} />
            </FieldRow>
            <FieldRow label="Linear" unit="mm">
              <Input type="number" step="0.5" min={0} placeholder="mm" className="h-8 w-full px-2 text-sm" value={data.linearMm ?? ""} onChange={(e) => { const v = parseFloat(e.target.value); onUpdate({ linearMm: isNaN(v) ? undefined : v }); }} />
            </FieldRow>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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

// ── Main wizard ───────────────────────────────────────────────────────────────
export function ZoneInputWizard() {
  const patients           = usePatientStore((s) => s.patients);
  const activeId           = usePatientStore((s) => s.activeId);
  const threeZones         = usePatientStore((s) => s.threeZones);
  const updateLesionRows   = usePatientStore((s) => s.updateLesionRows);
  const updateClinicalForm = usePatientStore((s) => s.updateClinicalForm);
  const pushHistory        = usePatientStore((s) => s.pushHistory);
  const setPatientName     = usePatientStore((s) => s.setPatientName);

  const entry = patients.find((p) => p.id === activeId);

  const wizardTab = useUiStore((s) => s.wizardTab);
  const [_localTab, setLocalTab]        = useState<1 | 2>(1);
  const activeTab: 1 | 2               = wizardTab ?? _localTab;
  const setActiveTab = (t: 1 | 2) => setLocalTab(t);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [showNoteImport, setShowNoteImport] = useState(false);

  const [age,      setAge]      = useState("");
  const [psa,      setPsa]      = useState("");
  const [vol,      setVol]      = useState("");
  const [decipher, setDecipher] = useState("");
  const [shim,     setShim]     = useState("");
  const [ipss,     setIpss]     = useState("");
  // Height/weight kept in the user-facing unit; canonical (cm, kg) values are
  // derived on read so toggling units never loses precision.
  const [bmiMode,      setBmiMode]      = useState<"hw" | "bmi">("hw");
  const [bmiDirectVal, setBmiDirectVal] = useState("");
  const [units,        setUnits]        = useState<"metric" | "imperial">("metric");
  const [heightVal,    setHeightVal]    = useState("");
  const [heightFtVal,  setHeightFtVal]  = useState(""); // feet part (imperial only)
  const [heightInVal,  setHeightInVal]  = useState(""); // inches part (imperial only)
  const [weightVal,    setWeightVal]    = useState("");
  const [zoneData, setZoneData] = useState<ZoneDataMap>({});

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

  const clearAllZones = useCallback(() => {
    if (!window.confirm("Clear all zone locations? This cannot be undone until you apply a new checkpoint.")) return;
    setZoneData({});
    updateLesionRows([]);
    setSelectedZone(null);
  }, [updateLesionRows]);

  const handleAgeChange      = (v: string) => { setAge(v);      updateClinicalForm({ age: parseInt(v) || undefined }); };
  const handlePsaChange      = (v: string) => { setPsa(v);      updateClinicalForm({ psa: parseFloat(v) || 0 }); };
  const handleVolChange      = (v: string) => { setVol(v);      updateClinicalForm({ vol: parseFloat(v) || 45 }); };
  const handleDecipherChange = (v: string) => { setDecipher(v); const d = parseFloat(v); updateClinicalForm({ dec: v === "" || isNaN(d) ? null : d }); };
  const handleShimChange     = (v: string) => { setShim(v);     updateClinicalForm({ shim: parseInt(v) || undefined }); };
  const handleIpssChange     = (v: string) => { setIpss(v);     updateClinicalForm({ ipss: parseInt(v) || undefined }); };

  /**
   * Convert the user-entered height/weight (in the chosen unit) into canonical
   * cm/kg, then compute BMI = kg / m². Result rounded to 1 dp and pushed to the
   * record so the BMI field on the Outcomes page stays in sync.
   */
  // For imperial, height is stored as total inches in heightVal AND as ft+in split.
  const ftInToCm = (ft: string, inches: string) => {
    const f = parseFloat(ft) || 0;
    const i = parseFloat(inches) || 0;
    const totalIn = f * 12 + i;
    return totalIn > 0 ? totalIn * 2.54 : null;
  };
  const toCm = (v: string, u: "metric" | "imperial") => {
    const n = parseFloat(v);
    if (!n || n <= 0) return null;
    return u === "metric" ? n : n * 2.54; // imperial v is total inches
  };
  const toKg = (v: string, u: "metric" | "imperial") => {
    const n = parseFloat(v);
    if (!n || n <= 0) return null;
    return u === "metric" ? n : n * 0.45359237;
  };
  const computeBmiHw = (h: string, ft: string, inches: string, w: string, u: "metric" | "imperial") => {
    const cm = u === "imperial" ? ftInToCm(ft, inches) : toCm(h, u);
    const kg = toKg(w, u);
    if (!cm || !kg) return null;
    const m = cm / 100;
    const v = kg / (m * m);
    return v > 0 && v < 100 ? Math.round(v * 10) / 10 : null;
  };
  const recomputeBmiHw = (h: string, ft: string, inches: string, w: string, u: "metric" | "imperial") => {
    const bmi = computeBmiHw(h, ft, inches, w, u);
    if (bmi !== null) updateClinicalForm({ bmi });
  };
  const handleHeightChange = (v: string) => { setHeightVal(v); recomputeBmiHw(v, heightFtVal, heightInVal, weightVal, units); };
  const handleHeightFtChange = (v: string) => {
    setHeightFtVal(v);
    recomputeBmiHw(heightVal, v, heightInVal, weightVal, units);
  };
  const handleHeightInChange = (v: string) => {
    setHeightInVal(v);
    recomputeBmiHw(heightVal, heightFtVal, v, weightVal, units);
  };
  const handleWeightChange = (v: string) => { setWeightVal(v); recomputeBmiHw(heightVal, heightFtVal, heightInVal, v, units); };

  const handleBmiDirectChange = (v: string) => {
    setBmiDirectVal(v);
    const b = parseFloat(v);
    if (b > 0 && b < 100) updateClinicalForm({ bmi: Math.round(b * 10) / 10 });
  };

  /** Toggle units — convert the currently-displayed values into the new unit. */
  const handleUnitsToggle = (next: "metric" | "imperial") => {
    if (next === units) return;
    const round = (n: number) => String(Math.round(n * 10) / 10);
    if (next === "imperial") {
      // cm → ft+in
      const cm = parseFloat(heightVal);
      if (cm > 0) {
        const totalIn = cm / 2.54;
        const ft = Math.floor(totalIn / 12);
        const ins = totalIn - ft * 12;
        setHeightFtVal(String(ft));
        setHeightInVal(round(ins));
        setHeightVal(""); // not used in imperial display
      }
      const kg = parseFloat(weightVal);
      if (kg > 0) setWeightVal(round(kg / 0.45359237));
    } else {
      // ft+in → cm
      const cm = ftInToCm(heightFtVal, heightInVal);
      if (cm) setHeightVal(round(cm));
      setHeightFtVal(""); setHeightInVal("");
      const lb = parseFloat(weightVal);
      if (lb > 0) setWeightVal(round(lb * 0.45359237));
    }
    setUnits(next);
  };

  // Live BMI preview for hw mode
  const computedBmi = computeBmiHw(heightVal, heightFtVal, heightInVal, weightVal, units);

  /** Apply zone-derived aggregate flags to the clinical state, then save a checkpoint. */
  const applyZoneAggregates = () => {
    const zones = Object.values(zoneData);
    updateClinicalForm({
      mri_epe: zones.some((d) => d.mriEpe) ? 1 : 0,
      mri_svi: zones.some((d) => d.mriSvi) ? 1 : 0,
      mus_ece: zones.some((d) => d.musEce) ? 1 : 0,
      mus_svi: 0,
      psma_epe: zones.some((d) => d.psmaEpe) ? 1 : 0,
      psma_svi: zones.some((d) => d.psmaSvi) ? 1 : 0,
      psma_ln: zones.some((d) => d.psmaLn) ? 1 : 0,
      cribriform_bx: zones.some((d) => d.cribriform) ? 1 : 0,
      idc_bx: zones.some((d) => d.idc) ? 1 : 0,
      pni_bx: zones.some((d) => d.pni) ? 1 : 0,
      maxcore: Math.max(0, ...zones.map((d) => d.corePct ?? 0)),
      linear_mm: Math.max(0, ...zones.map((d) => d.linearMm ?? 0)) || undefined,
    });
    pushHistory();

    // Once the case has real data applied, replace the placeholder "New Case"
    // name in the header dropdown with a real title.
    if (activeId && entry && (entry.name === "New Case" || !entry.name.trim())) {
      const gg = entry.record.biopsy?.max_grade_group ?? "?";
      const psaVal = psa || String(entry.record.patient?.psa ?? "?");
      setPatientName(activeId, `GG${gg} · PSA ${psaVal}`);
    }
  };

  const applyNoteImport = useCallback(
    (rows: import("@/types/lesion").LesionRow[], clinical: NoteImportClinical) => {
      const existingRows = zoneDataToRows(zoneData);
      const merged = rowsToZoneData([...existingRows, ...rows]);
      setZoneData(merged);
      updateLesionRows(zoneDataToRows(merged));
      if (clinical.vol !== undefined) {
        setVol(String(clinical.vol));
        updateClinicalForm({ vol: clinical.vol });
      }
      if (clinical.gg !== undefined) updateClinicalForm({ gg: clinical.gg });
      if (clinical.cores !== undefined) updateClinicalForm({ cores: clinical.cores });
      if (clinical.maxcore !== undefined) updateClinicalForm({ maxcore: clinical.maxcore });
      pushHistory();
    },
    [zoneData, updateLesionRows, updateClinicalForm, pushHistory],
  );

  if (!entry) return null;

  const psaNum  = parseFloat(psa);
  const volNum  = parseFloat(vol);
  const psad    = volNum > 0 && !isNaN(psaNum) ? (psaNum / volNum).toFixed(3) : "—";
  const psaWarn = !isNaN(psaNum) && psaNum > 0 && (psaNum > 100 || psaNum < 0.1);
  const volWarn = !isNaN(volNum) && volNum > 0 && (volNum < 10 || volNum > 250);

  const totalFilled = ALL_ZONES.filter((z) => hasData(zoneData[z.id])).length;
  const filledZones = ALL_ZONES.filter((z) => hasData(zoneData[z.id]));
  const hasMri  = filledZones.some((z) => (zoneData[z.id]?.pirads ?? 0) > 0);
  const hasMus  = filledZones.some((z) => (zoneData[z.id]?.primus ?? 0) > 0);
  const hasPsma = filledZones.some((z) => (zoneData[z.id]?.suv ?? 0) > 0);
  const hasBx   = filledZones.some((z) => (zoneData[z.id]?.gg ?? 0) > 0);
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
              "flex flex-1 items-center justify-center gap-2 border-b-[3px] py-3 text-sm font-bold transition-colors sm:gap-3 sm:py-[18px] sm:text-base",
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
        <div className="flex-1 overflow-y-auto" data-tutorial="clinical-form">
          <div className="mx-auto max-w-2xl space-y-5 p-4 sm:space-y-7 sm:p-8">
            <div>
              <h3 className="text-xl font-bold text-foreground sm:text-2xl">Demographics &amp; Labs</h3>
              <p className="mt-1 text-sm text-muted-foreground">Baseline parameters for risk calibration</p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-5">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-age">Age <span className="font-normal text-muted-foreground">(years)</span></label>
                <Input id="wiz-age" type="number" min={18} max={120} inputMode="numeric" placeholder="65" value={age} onChange={(e) => handleAgeChange(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-psa">PSA <span className="font-normal text-muted-foreground">(ng/mL)</span></label>
                <Input id="wiz-psa" type="number" step="0.1" inputMode="decimal" placeholder="6.5" value={psa} onChange={(e) => handlePsaChange(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-vol">Volume <span className="font-normal text-muted-foreground">(cc)</span></label>
                <Input id="wiz-vol" type="number" step="0.1" inputMode="decimal" placeholder="45" value={vol} onChange={(e) => handleVolChange(e.target.value)} className="h-11 text-base" />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground sm:text-sm">PSAD</span>
              <span className="text-2xl font-black tabular-nums text-primary sm:text-3xl">{psad}</span>
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

            <div className="grid grid-cols-3 gap-3 sm:gap-5">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-dec">
                  Decipher <span className="font-normal text-muted-foreground text-xs sm:text-sm">(0–1)</span>
                </label>
                <Input id="wiz-dec" type="text" inputMode="decimal" placeholder="0.52" value={decipher} onChange={(e) => handleDecipherChange(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-shim">SHIM <span className="font-normal text-muted-foreground text-xs sm:text-sm">(0–25)</span></label>
                <Input id="wiz-shim" type="number" min={0} max={25} inputMode="numeric" placeholder="21" value={shim} onChange={(e) => handleShimChange(e.target.value)} className="h-11 text-base" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="wiz-ipss">IPSS <span className="font-normal text-muted-foreground text-xs sm:text-sm">(0–35)</span></label>
                <Input id="wiz-ipss" type="number" min={0} max={35} inputMode="numeric" placeholder="8" value={ipss} onChange={(e) => handleIpssChange(e.target.value)} className="h-11 text-base" />
              </div>
            </div>

            {/* BMI section — enter directly or via height + weight */}
            <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">BMI <span className="font-normal text-muted-foreground">(optional)</span></span>
                <div className="flex items-center gap-2">
                  {bmiMode === "hw" && computedBmi !== null && (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      BMI <span className="font-bold text-primary">{computedBmi}</span>
                    </span>
                  )}
                  {/* Mode toggle: direct BMI vs height+weight */}
                  <div className="flex overflow-hidden rounded-md border border-border text-xs font-semibold" role="group" aria-label="BMI entry mode">
                    <button
                      type="button"
                      onClick={() => setBmiMode("bmi")}
                      className={`px-2.5 py-1 transition-colors ${bmiMode === "bmi" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/60"}`}
                      aria-pressed={bmiMode === "bmi"}
                    >
                      BMI
                    </button>
                    <button
                      type="button"
                      onClick={() => setBmiMode("hw")}
                      className={`px-2.5 py-1 transition-colors ${bmiMode === "hw" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/60"}`}
                      aria-pressed={bmiMode === "hw"}
                    >
                      Ht / Wt
                    </button>
                  </div>
                  {/* Unit toggle — only visible in hw mode */}
                  {bmiMode === "hw" && (
                    <div className="flex overflow-hidden rounded-md border border-border text-xs font-semibold" role="group" aria-label="Unit system">
                      <button
                        type="button"
                        onClick={() => handleUnitsToggle("metric")}
                        className={`px-2.5 py-1 transition-colors ${units === "metric" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/60"}`}
                        aria-pressed={units === "metric"}
                      >
                        Metric
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitsToggle("imperial")}
                        className={`px-2.5 py-1 transition-colors ${units === "imperial" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/60"}`}
                        aria-pressed={units === "imperial"}
                      >
                        Imperial
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {bmiMode === "bmi" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="wiz-bmi-direct">
                    BMI <span className="font-normal text-muted-foreground/70">(kg/m²)</span>
                  </label>
                  <Input
                    id="wiz-bmi-direct"
                    type="number"
                    step="0.1"
                    min={10}
                    max={80}
                    inputMode="decimal"
                    placeholder="27"
                    value={bmiDirectVal}
                    onChange={(e) => handleBmiDirectChange(e.target.value)}
                    className="h-11 text-base max-w-[160px]"
                  />
                </div>
              ) : (
                <div className={`grid gap-3 ${units === "imperial" ? "grid-cols-3" : "grid-cols-2"}`}>
                  {units === "imperial" ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground" htmlFor="wiz-height-ft">
                          Height <span className="font-normal text-muted-foreground/70">(ft)</span>
                        </label>
                        <Input
                          id="wiz-height-ft"
                          type="number"
                          step="1"
                          min={3}
                          max={8}
                          inputMode="numeric"
                          placeholder="5"
                          value={heightFtVal}
                          onChange={(e) => handleHeightFtChange(e.target.value)}
                          className="h-11 text-base"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground" htmlFor="wiz-height-in">
                          <span className="font-normal text-muted-foreground/70">(in)</span>
                        </label>
                        <Input
                          id="wiz-height-in"
                          type="number"
                          step="0.5"
                          min={0}
                          max={11.5}
                          inputMode="decimal"
                          placeholder="10"
                          value={heightInVal}
                          onChange={(e) => handleHeightInChange(e.target.value)}
                          className="h-11 text-base"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground" htmlFor="wiz-height">
                        Height <span className="font-normal text-muted-foreground/70">(cm)</span>
                      </label>
                      <Input
                        id="wiz-height"
                        type="number"
                        step="0.5"
                        min={50}
                        max={250}
                        inputMode="decimal"
                        placeholder="178"
                        value={heightVal}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        className="h-11 text-base"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground" htmlFor="wiz-weight">
                      Weight <span className="font-normal text-muted-foreground/70">({units === "metric" ? "kg" : "lb"})</span>
                    </label>
                    <Input
                      id="wiz-weight"
                      type="number"
                      step="0.1"
                      min={units === "metric" ? 20 : 40}
                      max={units === "metric" ? 300 : 660}
                      inputMode="decimal"
                      placeholder={units === "metric" ? "80" : "175"}
                      value={weightVal}
                      onChange={(e) => handleWeightChange(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setAge(""); setPsa(""); setVol(""); setDecipher(""); setShim(""); setIpss("");
                  setHeightVal(""); setHeightFtVal(""); setHeightInVal(""); setWeightVal(""); setBmiDirectVal("");
                  updateClinicalForm({ age: undefined, psa: 0, vol: 45, dec: null, shim: undefined, ipss: undefined, bmi: undefined });
                }}
                className="text-xs font-medium text-muted-foreground/60 hover:text-destructive transition-colors"
              >
                Clear all fields
              </button>
              <Button type="button" size="lg" onClick={() => setActiveTab(2)}>
                Next: Zone Locations →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Zone Locations ── */}
      {activeTab === 2 && (
        <div className="flex flex-1 flex-col overflow-hidden" data-tutorial="zone-grid">
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Zone grids */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
            {/* Legend + import button */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-1.5 text-xs text-muted-foreground/80">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <span className="font-semibold text-muted-foreground">Click zone → enter findings · 3D updates live</span>
                <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-blue-500 text-[8px] font-bold text-white">M</span> MRI</span>
                <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-teal-500 text-[8px] font-bold text-white">U</span> MUS</span>
                <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-purple-500 text-[8px] font-bold text-white">P</span> PSMA</span>
                <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-600 text-[8px] font-bold text-white">B</span> Bx</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedZone && hasData(zoneData[selectedZone]) && (
                  <button
                    type="button"
                    onClick={() => clearZone(selectedZone)}
                    className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-semibold text-destructive/80 transition-colors hover:border-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                  >
                    Clear zone
                  </button>
                )}
                {totalFilled > 0 && (
                  <button
                    type="button"
                    onClick={clearAllZones}
                    className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-semibold text-destructive/80 transition-colors hover:border-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                  >
                    Clear all locations
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNoteImport(true)}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/50 hover:text-foreground"
                >
                  ↑ Import note
                </button>
              </div>
            </div>

            {showNoteImport && (
              <NoteImportModal
                onClose={() => setShowNoteImport(false)}
                onApply={applyNoteImport}
              />
            )}

            {/* Posterior grid */}
            <div className="shrink-0 rounded-lg border border-border bg-muted/10 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground sm:tracking-widest">Posterior Zones</h4>
                <span className="text-[10px] text-muted-foreground/50">Surgical view · R on right</span>
              </div>
              <div className="mb-1.5 grid gap-1.5" style={{ gridTemplateColumns: "2.5rem repeat(4, minmax(0, 1fr))" }}>
                <div />
                {["R Lat", "R Med", "L Med", "L Lat"].map((h) => (
                  <div key={h} className="text-center text-[10px] font-bold text-foreground/70 sm:text-xs">{h}</div>
                ))}
              </div>
              <div className="space-y-1.5">
                {postRows.map((row) => (
                  <div key={row.level} className="grid items-stretch gap-1.5" style={{ gridTemplateColumns: "2.5rem repeat(4, minmax(0, 1fr))" }}>
                    <div className="flex items-center justify-end pr-1">
                      <span className="text-[10px] font-bold text-foreground/60 sm:text-xs">{row.level}</span>
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
            <div className="shrink-0 rounded-lg border border-border bg-muted/10 p-3">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:tracking-widest">Anterior Zones</h4>
              <div className="mb-1.5 grid gap-1.5" style={{ gridTemplateColumns: "2.5rem minmax(0, 1fr) minmax(0, 1fr)" }}>
                <div />
                <div className="text-center text-[10px] font-bold text-foreground/70 sm:text-xs">R</div>
                <div className="text-center text-[10px] font-bold text-foreground/70 sm:text-xs">L</div>
              </div>
              <div className="space-y-1.5">
                {(["Base", "Mid", "Apex"] as const).map((level) => {
                  const rId = ANT_ZONES.find((z) => z.side === "R" && z.level === level)!.id;
                  const lId = ANT_ZONES.find((z) => z.side === "L" && z.level === level)!.id;
                  return (
                    <div key={level} className="grid items-stretch gap-1.5" style={{ gridTemplateColumns: "2.5rem minmax(0, 1fr) minmax(0, 1fr)" }}>
                      <div className="flex items-center justify-end pr-1">
                        <span className="text-[10px] font-bold text-foreground/60 sm:text-xs">{level.toUpperCase()}</span>
                      </div>
                      <ZoneCell zone={ANT_ZONES.find((z) => z.id === rId)!} data={zoneData[rId]} cancer={getCancer(rId)} selected={selectedZone === rId} onClick={() => toggle(rId)} />
                      <ZoneCell zone={ANT_ZONES.find((z) => z.id === lId)!} data={zoneData[lId]} cancer={getCancer(lId)} selected={selectedZone === lId} onClick={() => toggle(lId)} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Location summary table */}
            {totalFilled > 0 && (
              <div className="shrink-0 rounded-lg border border-border bg-muted/10 p-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:tracking-widest">Location Summary</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[10px] sm:text-xs">
                    <thead>
                      <tr>
                        <th className="border-b border-border/40 pb-1 pr-3 text-left font-semibold text-foreground/70" rowSpan={2}>Zone</th>
                        {hasMri  && <th className="border-b border-border/40 pb-1 pr-1 text-center font-semibold text-blue-500"   colSpan={4}>MRI</th>}
                        {hasMus  && <th className="border-b border-border/40 pb-1 pr-1 text-center font-semibold text-teal-500"   colSpan={2}>MUS</th>}
                        {hasPsma && <th className="border-b border-border/40 pb-1 pr-1 text-center font-semibold text-purple-500" colSpan={2}>PSMA</th>}
                        {hasBx   && <th className="border-b border-border/40 pb-1    text-center font-semibold text-amber-600"    colSpan={4}>Bx</th>}
                      </tr>
                      <tr className="text-[9px] text-muted-foreground/60">
                        {hasMri  && <><th className="pb-1 pr-1 text-center font-medium">PI-RADS</th><th className="pb-1 pr-1 text-center font-medium">Sz(mm)</th><th className="pb-1 pr-1 text-center font-medium">EPE</th><th className="pb-1 pr-2 text-center font-medium">SVI</th></>}
                        {hasMus  && <><th className="pb-1 pr-1 text-center font-medium">PRIMUS</th><th className="pb-1 pr-2 text-center font-medium">ECE</th></>}
                        {hasPsma && <><th className="pb-1 pr-1 text-center font-medium">SUV</th><th className="pb-1 pr-2 text-center font-medium">EPE</th></>}
                        {hasBx   && <><th className="pb-1 pr-1 text-center font-medium">GG</th><th className="pb-1 pr-1 text-center font-medium">Core%</th><th className="pb-1 pr-1 text-center font-medium">mm</th><th className="pb-1 text-center font-medium">Flags</th></>}
                      </tr>
                    </thead>
                    <tbody>
                      {filledZones.map((z) => {
                        const d = zoneData[z.id];
                        const flags = [d?.cribriform && "Crib", d?.idc && "IDC", d?.pni && "PNI"].filter(Boolean).join(" ");
                        return (
                          <tr key={z.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => toggle(z.id)}>
                            <td className="py-1 pr-3 font-semibold text-foreground/80">{z.label}</td>
                            {hasMri  && <><td className="py-1 pr-1 text-center text-foreground/80">{d?.pirads  ?? "—"}</td><td className="py-1 pr-1 text-center text-foreground/60">{d?.mriSize  ? d.mriSize  : "—"}</td><td className="py-1 pr-1 text-center">{d?.mriEpe  ? <span className="font-bold text-amber-500">✓</span> : <span className="text-muted-foreground/30">—</span>}</td><td className="py-1 pr-2 text-center">{d?.mriSvi  ? <span className="font-bold text-red-500">✓</span>   : <span className="text-muted-foreground/30">—</span>}</td></>}
                            {hasMus  && <><td className="py-1 pr-1 text-center text-foreground/80">{d?.primus  ?? "—"}</td><td className="py-1 pr-2 text-center">{d?.musEce  ? <span className="font-bold text-amber-500">✓</span> : <span className="text-muted-foreground/30">—</span>}</td></>}
                            {hasPsma && <><td className="py-1 pr-1 text-center text-foreground/80">{d?.suv     ?? "—"}</td><td className="py-1 pr-2 text-center">{d?.psmaEpe ? <span className="font-bold text-amber-500">✓</span> : <span className="text-muted-foreground/30">—</span>}</td></>}
                            {hasBx   && <><td className="py-1 pr-1 text-center text-foreground/80">{d?.gg      ?? "—"}</td><td className="py-1 pr-1 text-center text-foreground/60">{d?.corePct  ? `${d.corePct}%`  : "—"}</td><td className="py-1 pr-1 text-center text-foreground/60">{d?.linearMm ? d.linearMm : "—"}</td><td className="py-1 text-center text-foreground/60">{flags || "—"}</td></>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Zone detail — side panel on lg+, stacks below grids on narrower */}
          {selDef && (
            <div className="overflow-y-auto border-t border-border p-3 sm:p-4 lg:w-[400px] lg:max-w-[45%] lg:shrink-0 lg:border-l lg:border-t-0 xl:w-[460px] 2xl:w-[540px]">
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

        {/* Apply zone aggregates — flex-col footer (sized in the column flow) */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur sm:px-5 sm:py-3">
          <p className="hidden text-xs text-muted-foreground/70 md:block">
            Zone edits update predictions live. Apply commits aggregate flags & saves an undo point.
          </p>
          <Button type="button" size="default" onClick={applyZoneAggregates}>
            Apply &amp; Save Checkpoint
          </Button>
        </div>
        </div>
      )}

    </div>
  );
}
