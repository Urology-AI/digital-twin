import type { CaseRecord } from "@/components/CaseLog";
import type { PatientEntry } from "@/store/patientStore";

// Columns sourced from CaseRecord (flat prediction snapshot)
const CASE_COLS: (keyof CaseRecord)[] = [
  "id","date","psa","vol","psad","gg","cores","maxcore","linear","pirads","laterality",
  "gg_left","gg_right","mri_epe","mri_svi","mri_size","mri_abutment","mri_adc",
  "mus_ece","mus_svi","suv","psma_ln","psma_lesions","psma_base","psma_svi",
  "ev_lesions","ev_base","lesion_count",
  "pred_ece","pred_ece_l","pred_ece_r","pred_svi","pred_upgrade","pred_psm","pred_bcr","pred_lni",
  "ns_left","ns_right",
  "path_ece","path_ece_l","path_ece_r","path_svi","path_upgrade","path_psm","path_lni","path_gg",
  "path_ns_l","path_ns_r","notes",
];

// Additional columns sourced from the full Prostate3DInputV1 record.
// Zones and lesion rows stay in full_record (non-scalar / variable-length).
const RECORD_COLS = [
  // patient
  "age","bmi","shim","ipss","dm","htn","cad","statin",
  "smoking","exercise","pde5","pde5_plan","pfmt","alcohol",
  // prostate dimensions
  "dim_ap","dim_transverse","dim_cc","median_lobe_grade",
  // biopsy detail
  "total_cores","pct_pattern45","has_cribriform","has_idc","has_pni",
  "cores_left","cores_right","mc_left","mc_right","linear_left","linear_right","decipher_score",
  // staging detail
  "psma_epe","max_primus","lymph_nodes_psma",
  // nested data blob
  "full_record",
] as const;

const ALL_COLS = [...CASE_COLS, ...RECORD_COLS];

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS case_log (
  id TEXT PRIMARY KEY, date TEXT,
  psa REAL, vol REAL, psad TEXT, gg INTEGER, cores INTEGER, maxcore INTEGER,
  linear REAL, pirads INTEGER, laterality TEXT, gg_left INTEGER, gg_right INTEGER,
  mri_epe REAL, mri_svi REAL, mri_size REAL, mri_abutment REAL, mri_adc REAL,
  mus_ece REAL, mus_svi REAL, suv REAL, psma_ln REAL, psma_lesions INTEGER,
  psma_base REAL, psma_svi REAL, ev_lesions INTEGER, ev_base REAL, lesion_count INTEGER,
  pred_ece INTEGER, pred_ece_l INTEGER, pred_ece_r INTEGER, pred_svi INTEGER,
  pred_upgrade INTEGER, pred_psm INTEGER, pred_bcr INTEGER, pred_lni INTEGER,
  ns_left INTEGER, ns_right INTEGER,
  path_ece INTEGER, path_ece_l INTEGER, path_ece_r INTEGER, path_svi INTEGER,
  path_upgrade INTEGER, path_psm INTEGER, path_lni INTEGER, path_gg INTEGER,
  path_ns_l INTEGER, path_ns_r INTEGER,
  notes TEXT,
  age INTEGER, bmi REAL, shim INTEGER, ipss INTEGER,
  dm INTEGER, htn INTEGER, cad INTEGER, statin INTEGER,
  smoking TEXT, exercise TEXT, pde5 INTEGER, pde5_plan TEXT, pfmt TEXT, alcohol TEXT,
  dim_ap REAL, dim_transverse REAL, dim_cc REAL, median_lobe_grade INTEGER,
  total_cores INTEGER, pct_pattern45 REAL,
  has_cribriform INTEGER, has_idc INTEGER, has_pni INTEGER,
  cores_left INTEGER, cores_right INTEGER,
  mc_left REAL, mc_right REAL, linear_left REAL, linear_right REAL,
  decipher_score REAL,
  psma_epe INTEGER, max_primus REAL, lymph_nodes_psma TEXT,
  full_record TEXT
)`;

// One migration statement per new column; each is wrapped in try-catch so
// existing tables silently gain the column on first connect.
const MIGRATE_COLS: [string, string][] = [
  ["full_record",       "TEXT"],
  ["age",               "INTEGER"],
  ["bmi",               "REAL"],
  ["shim",              "INTEGER"],
  ["ipss",              "INTEGER"],
  ["dm",                "INTEGER"],
  ["htn",               "INTEGER"],
  ["cad",               "INTEGER"],
  ["statin",            "INTEGER"],
  ["smoking",           "TEXT"],
  ["exercise",          "TEXT"],
  ["pde5",              "INTEGER"],
  ["pde5_plan",         "TEXT"],
  ["pfmt",              "TEXT"],
  ["alcohol",           "TEXT"],
  ["dim_ap",            "REAL"],
  ["dim_transverse",    "REAL"],
  ["dim_cc",            "REAL"],
  ["median_lobe_grade", "INTEGER"],
  ["total_cores",       "INTEGER"],
  ["pct_pattern45",     "REAL"],
  ["has_cribriform",    "INTEGER"],
  ["has_idc",           "INTEGER"],
  ["has_pni",           "INTEGER"],
  ["cores_left",        "INTEGER"],
  ["cores_right",       "INTEGER"],
  ["mc_left",           "REAL"],
  ["mc_right",          "REAL"],
  ["linear_left",       "REAL"],
  ["linear_right",      "REAL"],
  ["decipher_score",    "REAL"],
  ["psma_epe",          "INTEGER"],
  ["max_primus",        "REAL"],
  ["lymph_nodes_psma",  "TEXT"],
];

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

/**
 * Live connectivity check — actually calls the Worker's health endpoint
 * (which itself does a real round-trip to Turso), rather than just assuming
 * sync works because the code path exists. Used to gate the CaseLog sync UI.
 */
export async function checkTursoHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/turso/health");
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Thin client-side stand-in for the subset of the Turso SDK this file uses
 * (`.execute`, `.batch`). Neither the DB URL nor the auth token ever reach
 * the browser — both requests go to the Cloudflare Worker proxy (see
 * cf-worker/src/index.ts), which holds the real Turso credentials as a
 * server-side secret and is itself gated by Cloudflare Access.
 */
function getClient() {
  async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Turso proxy error (${res.status})`);
    return data as Record<string, unknown>;
  }
  return {
    execute: async (sql: string, args: (string | number | null)[] = []) => {
      const data = await post("/api/turso/execute", { sql, args });
      return { rows: data.rows as unknown[][], columns: data.columns as string[] };
    },
    batch: async (statements: { sql: string; args: (string | number | null)[] }[], _mode: "write") => {
      void _mode; // kept for call-site parity with the real SDK's signature
      await post("/api/turso/batch", { statements });
    },
  };
}

/**
 * Strip HIPAA Safe Harbor identifiers before any data leaves the browser.
 *  - id       → cloud hash (set by caller)
 *  - name     → non-identifying clinical label
 *  - age > 89 → capped at 89
 *  - media    → stripped (images may contain patient documents / photos)
 */
function deidentifyEntry(entry: PatientEntry, cloudId: string): PatientEntry {
  const patient = { ...entry.record.patient };
  if (patient.age !== null && patient.age !== undefined && patient.age > 89) {
    patient.age = 89;
  }
  const gg = entry.record.biopsy?.max_grade_group ?? "?";
  const psa = entry.record.patient?.psa ?? "?";
  const record = { ...entry.record, patient };
  delete record.media;
  return {
    id: cloudId,
    name: `GG${gg} PSA ${psa}`,
    record,
    lesionRows: entry.lesionRows,
  };
}

/** Extract all scalar fields from a PatientEntry record as flat column values. */
function recordColumns(entry: PatientEntry, cloudId: string): Record<string, unknown> {
  const rec = entry.record;
  const p = rec.patient;
  const b = rec.biopsy;
  const s = rec.staging;
  const d = rec.prostate.dimensions_cm;

  // Cap age at 89 for HIPAA Safe Harbor
  const age = p.age !== null && p.age !== undefined
    ? Math.min(p.age, 89) : null;

  return {
    age,
    bmi:               p.bmi ?? null,
    shim:              p.shim ?? null,
    ipss:              p.ipss ?? null,
    dm:                p.dm ? 1 : 0,
    htn:               p.htn ? 1 : 0,
    cad:               p.cad ? 1 : 0,
    statin:            p.statin ? 1 : 0,
    smoking:           p.smoking ?? null,
    exercise:          p.exercise ?? null,
    pde5:              p.pde5 ? 1 : 0,
    pde5_plan:         p.pde5_plan ?? null,
    pfmt:              p.pfmt ?? null,
    alcohol:           p.alcohol ?? null,
    dim_ap:            d?.ap ?? null,
    dim_transverse:    d?.transverse ?? null,
    dim_cc:            d?.cc ?? null,
    median_lobe_grade: rec.prostate.median_lobe_grade ?? null,
    total_cores:       b.total_cores ?? null,
    pct_pattern45:     b.max_pct_pattern45 ?? null,
    has_cribriform:    b.has_cribriform ?? null,
    has_idc:           b.has_idc ?? null,
    has_pni:           b.has_pni ?? null,
    cores_left:        b.cores_left ?? null,
    cores_right:       b.cores_right ?? null,
    mc_left:           b.mc_left ?? null,
    mc_right:          b.mc_right ?? null,
    linear_left:       b.linear_left ?? null,
    linear_right:      b.linear_right ?? null,
    decipher_score:    b.decipher_score ?? null,
    psma_epe:          s.psma_epe ? 1 : 0,
    max_primus:        s.max_primus ?? null,
    lymph_nodes_psma:  s.lymph_nodes_psma != null ? String(s.lymph_nodes_psma) : null,
    full_record:       JSON.stringify(deidentifyEntry(entry, cloudId)),
  };
}

async function ensureSchema(client: ReturnType<typeof getClient>) {
  await client.execute(CREATE_SQL);
  // Migrate existing tables — each ADD COLUMN is a no-op if the column already exists.
  await Promise.allSettled(
    MIGRATE_COLS.map(([col, type]) =>
      client.execute(`ALTER TABLE case_log ADD COLUMN ${col} ${type}`)
    )
  );
}

const CLOUD_ID_KEY = "compass_cloud_id_map";
function loadIdMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CLOUD_ID_KEY) || "{}"); } catch { return {}; }
}
function saveIdMap(m: Record<string, string>) {
  localStorage.setItem(CLOUD_ID_KEY, JSON.stringify(m));
}

export async function pushCases(
  cases: CaseRecord[],
  library: PatientEntry[],
): Promise<number> {
  if (!cases.length) return 0;
  const client = getClient();
  await ensureSchema(client);

  const idMap = loadIdMap();
  await Promise.all(cases.map(async (c) => {
    if (!idMap[c.id]) idMap[c.id] = await sha256hex(c.id);
  }));
  saveIdMap(idMap);

  const libraryById = new Map(library.map((e) => [e.id, e]));
  const cols = ALL_COLS.join(", ");
  const ph  = ALL_COLS.map(() => "?").join(", ");

  const stmts = cases.map((c) => {
    const cloudId = idMap[c.id]!;
    const base: Record<string, unknown> = { ...c, id: cloudId, notes: "" };
    const entry = libraryById.get(c.id);
    const extra = entry ? recordColumns(entry, cloudId) : {};
    const row = { ...base, ...extra };
    return {
      sql:  `INSERT OR REPLACE INTO case_log (${cols}) VALUES (${ph})`,
      args: ALL_COLS.map((k) => (row[k] === undefined ? null : row[k])) as (string | number | null)[],
    };
  });

  await client.batch(stmts, "write");
  return stmts.length;
}

export async function pullCases(
  localCases: CaseRecord[],
): Promise<{ records: CaseRecord[]; library: PatientEntry[] }> {
  const client = getClient();
  await ensureSchema(client);

  const result = await client.execute("SELECT * FROM case_log ORDER BY date DESC");
  const idMap = loadIdMap();

  const cloudToLocal: Record<string, CaseRecord> = {};
  for (const lc of localCases) {
    const cid = idMap[lc.id];
    if (cid) cloudToLocal[cid] = lc;
  }

  const restoredLibrary: PatientEntry[] = [];
  let idMapDirty = false;

  const records: CaseRecord[] = result.rows.map((row) => {
    const r: Record<string, unknown> = {};
    result.columns.forEach((col, i) => { r[col] = row[i]; });
    const cloudId = r["id"] as string;
    const local   = cloudToLocal[cloudId];

    // Cases first seen on this device get a local id = cloud hash;
    // the identity mapping is saved so future pushes reuse the same cloud row.
    const localId = local?.id ?? cloudId;
    if (!local) {
      idMap[localId] = cloudId;
      idMapDirty = true;
    }

    const rawFull = r["full_record"] as string | null | undefined;
    if (rawFull) {
      try {
        const entry = JSON.parse(rawFull) as PatientEntry;
        restoredLibrary.push({ ...entry, id: localId, lesionRows: entry.lesionRows ?? [] });
      } catch { /* malformed — skip */ }
    }

    return {
      ...(r as unknown as CaseRecord),
      id:    localId,
      notes: local?.notes ?? "",
    };
  });

  if (idMapDirty) saveIdMap(idMap);
  return { records, library: restoredLibrary };
}

// ── Patient-link sharing ──────────────────────────────────────────────────
// Deliberately a separate table from case_log above: sharing a case with a
// patient (via /patient/<id>) is not the same thing as logging it into the
// aggregate research case log, and the two shouldn't be conflated — this
// table exists only so a short /patient/<id> link can be resolved server-
// side instead of embedding the whole (often very long) record in the URL.
const SHARE_CREATE_SQL = `CREATE TABLE IF NOT EXISTS patient_shares (
  id TEXT PRIMARY KEY,
  record TEXT NOT NULL,
  created_at TEXT NOT NULL
)`;

/** Upserts one case for patient-link sharing, keyed by its share id. */
export async function saveShareCase(id: string, record: unknown): Promise<void> {
  const client = getClient();
  await client.execute(SHARE_CREATE_SQL);
  await client.batch(
    [
      {
        sql: "INSERT OR REPLACE INTO patient_shares (id, record, created_at) VALUES (?, ?, ?)",
        args: [id, JSON.stringify(record), new Date().toISOString()],
      },
    ],
    "write",
  );
}

/** Fetches one case previously saved with `saveShareCase`, or null if not found. */
export async function loadShareCase(id: string): Promise<unknown | null> {
  const client = getClient();
  const result = await client.execute("SELECT record FROM patient_shares WHERE id = ?", [id]);
  const row = result.rows[0];
  if (!row) return null;
  const recordIdx = result.columns.indexOf("record");
  const raw = row[recordIdx];
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
