import { createClient } from "@libsql/client/web";
import type { CaseRecord } from "@/components/CaseLog";

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
  notes TEXT
)`;

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

/** Map local id → cloud id (SHA-256 prefix). Cached in localStorage. */
const CLOUD_ID_KEY = "compass_cloud_id_map";
function loadIdMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CLOUD_ID_KEY) || "{}"); } catch { return {}; }
}
function saveIdMap(m: Record<string, string>) {
  localStorage.setItem(CLOUD_ID_KEY, JSON.stringify(m));
}

export async function pushCases(cases: CaseRecord[]): Promise<number> {
  if (!cases.length) return 0;
  const client = getClient();
  await client.execute(CREATE_SQL);

  // Build / update local→cloud id mapping
  const idMap = loadIdMap();
  await Promise.all(cases.map(async (c) => {
    if (!idMap[c.id]) idMap[c.id] = await sha256hex(c.id);
  }));
  saveIdMap(idMap);

  const cols = COLS.join(", ");
  const ph = COLS.map(() => "?").join(", ");
  const stmts = cases.map((c) => {
    // De-identify: swap id for its hash, strip free-text notes (PHI risk)
    const row: Record<string, unknown> = { ...c, id: idMap[c.id], notes: "" };
    return {
      sql: `INSERT OR REPLACE INTO case_log (${cols}) VALUES (${ph})`,
      args: COLS.map((k) => (row[k] === undefined ? null : row[k])) as (string | number | null)[],
    };
  });

  await client.batch(stmts, "write");
  return stmts.length;
}

export async function pullCases(localCases: CaseRecord[]): Promise<CaseRecord[]> {
  const client = getClient();
  await client.execute(CREATE_SQL);

  const result = await client.execute("SELECT * FROM case_log ORDER BY date DESC");
  const idMap = loadIdMap();

  // Reverse map: cloudId → local case (for preserving notes + matching)
  const cloudToLocal: Record<string, CaseRecord> = {};
  for (const lc of localCases) {
    const cid = idMap[lc.id];
    if (cid) cloudToLocal[cid] = lc;
  }

  const pulled: CaseRecord[] = result.rows.map((row) => {
    const r: Record<string, unknown> = {};
    result.columns.forEach((col, i) => { r[col] = row[i]; });
    const cloudId = r["id"] as string;
    const local = cloudToLocal[cloudId];
    // Keep local notes (never in cloud); restore original local id if known
    return {
      ...(r as unknown as CaseRecord),
      id: local?.id ?? cloudId,
      notes: local?.notes ?? "",
    };
  });

  return pulled;
}
