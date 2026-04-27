export type LesionSource = "MRI" | "MUS" | "PSMA" | "Bx" | "ExactVu";

export interface LesionRow {
  id: string;
  source: LesionSource;
  side: "L" | "R" | "";
  /** Anterior | Posterior | Posterolateral | Medial | Lateral | "" (maps like original `.lps`) */
  zone: string;
  score: string;
  epe: boolean;
  svi: boolean;
  corePct: number;
  linear: number;
  mriSize: number;
  mriAbutment: number;
  mriAdc: number;
  level: "Base" | "Mid" | "Apex" | "";
  /** Optional fields from parser JSON */
  pirads?: number;
  primus?: number;
  suv?: number;
  cribriform?: boolean;
  idc?: boolean;
  pni?: boolean;
  psmaLn?: boolean;
}

export function emptyLesion(id: string): LesionRow {
  return {
    id,
    source: "MRI",
    side: "L",
    zone: "Posterior",
    score: "4",
    epe: false,
    svi: false,
    corePct: 0,
    linear: 0,
    mriSize: 0,
    mriAbutment: -1,
    mriAdc: 0,
    level: "",
  };
}
