import { createClient } from "@libsql/client/web";
import type { CaseRecord } from "@/components/CaseLog";
import type { PatientEntry } from "@/store/patientStore";

const COLS: (keyof CaseRecord)[] = [
  "id","date","psa","vol","psad","gg","cores","maxcore","linear","pirads","laterality",
  "gg_left","gg_right","mri_epe","mri_svi","mri_size","mri_abutment","mri_adc",
  "mus_ece","mus_svi","suv","psma_ln","psma_lesions","psma_base","psma_svi",
  "ev_lesions","ev_base","lesion_count",
  "pred_ece","pred_ece_l","pred_ece_r","pred_svi","pred_upgrade","pred_psm","pred_bcr","pred_lni",
  "ns_left","ns_right",
  "path_ece","path_ece_l","path_ece_r","path_svi","path_upgrade","path_psm","path_lni","path_gg",
  "path_ns_l","path_ns_r","notes",
];

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
  full_record TEXT
)`;

// Migrate existing tables that predate the full_record column.
const MIGRATE_SQL = `ALTER TABLE case_log ADD COLUMN full_record TEXT`;

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

function getClient() {
  const url = import.meta.env.VITE_TURSO_URL as string | undefined;
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN as string | undefined;
  if (!url || !authToken) {
    throw new Error("Turso not configured. Set VITE_TURSO_URL and VITE_TURSO_AUTH_TOKEN.");
  }
  // @libsql/client/web requires https:// not libsql://
  return createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken });
}

/**
 * Strip all HIPAA Safe Harbor identifiers before the record goes to the cloud.
 *  - id       → replaced with the cloud hash by the caller
 *  - name     → replaced with a non-identifying clinical label
 *  - age > 89 → capped at 89 (ages over 89 are PHI under Safe Harbor)
 *  - media    → stripped (data URLs may contain scanned documents / patient photos)
 */
function deidentifyEntry(entry: PatientEntry, cloudId: string): PatientEntry {
  const patient = { ...entry.record.patient };
  if (patient.age !== null && patient.age !== undefined && patient.age > 89) {
    patient.age = 89;
  }

  // Build a safe clinical label from the record so the entry is still useful on pull
  const gg = entry.record.biopsy?.max_grade_group ?? "?";
  const psa = entry.record.patient?.psa ?? "?";
  const safeLabel = `GG${gg} PSA ${psa}`;

  const record = { ...entry.record, patient };
  // Remove media — images are not required for model computation and may contain PHI
  delete record.media;

  return {
    id: cloudId,
    name: safeLabel,
    record,
    lesionRows: entry.lesionRows,
  };
}

async function ensureSchema(client: ReturnType<typeof getClient>) {
  await client.execute(CREATE_SQL);
  // Best-effort migration — silently ignore "duplicate column" error on existing tables.
  try { await client.execute(MIGRATE_SQL); } catch { /* column already exists */ }
}

/** Map local id → cloud id (SHA-256 prefix). Cached in localStorage. */
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

  // Build / update local→cloud id mapping
  const idMap = loadIdMap();
  await Promise.all(cases.map(async (c) => {
    if (!idMap[c.id]) idMap[c.id] = await sha256hex(c.id);
  }));
  saveIdMap(idMap);

  // Index library by local id for quick lookup
  const libraryById = new Map(library.map((e) => [e.id, e]));

  const allCols = [...COLS, "full_record" as const];
  const cols = allCols.join(", ");
  const ph = allCols.map(() => "?").join(", ");

  const stmts = cases.map((c) => {
    const cloudId = idMap[c.id]!;
    // De-identify: swap id for its hash, strip free-text notes (PHI risk)
    const row: Record<string, unknown> = { ...c, id: cloudId, notes: "" };

    // Embed de-identified full patient record for complete restoration on pull.
    const entry = libraryById.get(c.id);
    let fullRecord: string | null = null;
    if (entry) {
      fullRecord = JSON.stringify(deidentifyEntry(entry, cloudId));
    }
    row["full_record"] = fullRecord;

    return {
      sql: `INSERT OR REPLACE INTO case_log (${cols}) VALUES (${ph})`,
      args: allCols.map((k) => (row[k] === undefined ? null : row[k])) as (string | number | null)[],
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

  // Reverse map: cloudId → local case (for preserving notes + matching)
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
    const local = cloudToLocal[cloudId];

    // Determine the local id for this row.
    // If this device originated the case, we already have local→cloud in idMap.
    // If this case came from another device, use cloudId as the local id and
    // register an identity mapping so future pushes from this device reuse the
    // same cloud row instead of creating a duplicate.
    const localId = local?.id ?? cloudId;
    if (!local) {
      idMap[localId] = cloudId;
      idMapDirty = true;
    }

    // Restore full patient entry (zones, lesions, demographics) if available
    const rawFull = r["full_record"] as string | null | undefined;
    if (rawFull) {
      try {
        const entry = JSON.parse(rawFull) as PatientEntry;
        restoredLibrary.push({
          ...entry,
          id: localId,
          // entry.name is already a safe clinical label (set by deidentifyEntry on push)
          lesionRows: entry.lesionRows ?? [],
        });
      } catch { /* malformed blob — skip */ }
    }

    // Keep local notes (never in cloud); restore original local id
    return {
      ...(r as unknown as CaseRecord),
      id: localId,
      notes: local?.notes ?? "",
    };
  });

  // Persist any new id mappings learned from this pull
  if (idMapDirty) saveIdMap(idMap);

  return { records, library: restoredLibrary };
}
