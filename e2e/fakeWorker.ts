import type { BrowserContext } from "@playwright/test";

/**
 * In-memory stand-in for the Cloudflare Worker's Turso proxy
 * (cf-worker/src/index.ts → /api/turso/*). Only the patient-share table is
 * modelled; every other query answers with an empty result. One instance is
 * shared across browser contexts so a link made by the "clinician" context
 * resolves in the "patient" context, exactly like the real backend.
 */
export class FakeWorker {
  readonly shares = new Map<string, string>();

  async attach(context: BrowserContext) {
    await context.route("**/api/turso/**", async (route) => {
      const url = new URL(route.request().url());
      const body = route.request().postDataJSON?.() as
        | { sql?: string; args?: unknown[]; statements?: { sql: string; args: unknown[] }[] }
        | undefined;

      if (url.pathname === "/api/turso/health") return route.fulfill({ json: { ok: true } });

      if (url.pathname === "/api/turso/batch") {
        for (const st of body?.statements ?? []) {
          if (/INSERT OR REPLACE INTO patient_shares/i.test(st.sql)) {
            const [id, record] = st.args as [string, string];
            this.shares.set(id, record);
          }
        }
        return route.fulfill({ json: { ok: true } });
      }

      if (url.pathname === "/api/turso/execute") {
        const sql = body?.sql ?? "";
        if (/SELECT record FROM patient_shares WHERE id = \?/i.test(sql)) {
          const rec = this.shares.get(String(body?.args?.[0]));
          return route.fulfill({ json: { columns: ["record"], rows: rec ? [[rec]] : [] } });
        }
        return route.fulfill({ json: { columns: [], rows: [] } });
      }

      return route.fulfill({ status: 404, json: { error: "not faked" } });
    });
  }
}
