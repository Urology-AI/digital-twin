import { expect, test, type Page } from "@playwright/test";
import { FakeWorker } from "./fakeWorker";

/**
 * Full journey: a clinician builds a case, fills pre-op details, signs the
 * patient page off and shares a /patient/<id> link; the patient opens it on
 * a fresh device and uses every tab. Backend = in-memory FakeWorker.
 */

const DEMO = "GG2 mapped by PSMA, not MRI";
const REVIEWER = "Dr. E2E Reviewer";

async function skipWelcome(page: Page) {
  await page.addInitScript(() => localStorage.setItem("compass-welcome-seen", "1"));
}

function patientTab(page: Page, name: RegExp) {
  return page.getByRole("navigation", { name: /Sections|Secciones/ }).first().getByRole("button", { name });
}

test("clinician shares a signed-off case and the patient uses every tab", async ({ browser }) => {
  const worker = new FakeWorker();

  // ── Clinician ────────────────────────────────────────────────────────────
  const clinician = await browser.newContext();
  await worker.attach(clinician);
  const c = await clinician.newPage();
  await skipWelcome(c);
  await c.goto("/clinical");

  await c.locator('[data-tutorial="patient-select"]').click();
  await c.getByRole("button", { name: DEMO }).click();
  await expect(c.locator('[data-tutorial="patient-select"]')).toContainText(DEMO);

  // Enter patient mode (clinician preview) and fill the pre-op details.
  await c.getByRole("button", { name: "More tools" }).click();
  await c.getByRole("menuitem", { name: "Patient mode" }).click();
  await expect(c.getByText("Your prostate surgery guide")).toBeVisible();
  await expect(c.getByRole("button", { name: "Back to clinical mode" })).toBeVisible();

  await patientTab(c, /Getting ready/).click();
  await c.getByRole("combobox").filter({ hasText: "Healthy" }).selectOption("3");
  await c.getByRole("button", { name: "Blood thinner" }).click();
  await expect(c.locator("#preop-plan")).toContainText("Plan ahead");
  await expect(c.locator("#preop-plan")).toContainText("Bleeding");

  // Sign off.
  await expect(c.getByRole("status").first()).toContainText("Not yet reviewed");
  await c.locator("#preop-reviewer").fill(REVIEWER);
  await c.getByRole("button", { name: "Sign off" }).click();
  await expect(c.getByRole("status").first()).toContainText(`Reviewed by ${REVIEWER}`);

  // Back to clinical mode, share the patient link.
  await c.getByRole("button", { name: "Back to clinical mode" }).click();
  await c.getByRole("button", { name: "More tools" }).click();
  await c.getByRole("menuitem", { name: "Share case" }).click();
  const dialog = c.getByRole("dialog");
  await expect(dialog).toContainText(/\/patient\/[\w-]+/);
  const link = (await dialog.textContent())!.match(/\/patient\/[0-9a-f-]{36}/)![0];

  // The shared record carries the new inputs and the sign-off.
  expect(worker.shares.size).toBe(1);
  const shared = JSON.parse([...worker.shares.values()][0]!);
  expect(shared.history.asa_class).toBe(3);
  expect(shared.history.anticoagulant).toBe(true);
  expect(shared.preop_review.reviewer).toBe(REVIEWER);
  await clinician.close();

  // ── Patient, on a fresh device ───────────────────────────────────────────
  const patient = await browser.newContext();
  await worker.attach(patient);
  const p = await patient.newPage();
  await p.goto(link);

  // Locked patient mode, on "My case".
  await expect(p.getByText("Your prostate surgery guide")).toBeVisible();
  await expect(p.getByRole("button", { name: "Back to clinical mode" })).toHaveCount(0);
  await expect(p.getByRole("status").first()).toContainText(`Reviewed by ${REVIEWER}`);
  await expect(p.getByText("Your diagnosis in plain words")).toBeVisible();
  await expect(p.getByText(/Grade Group 2 \(Gleason 3\+4\)/)).toBeVisible();
  await expect(p.getByText("Chance of the cancer coming back")).toBeVisible();
  await expect(p.getByText("Clinician: edit basics")).toHaveCount(0);

  // My surgery: explanations beside the live 3D canvas.
  await patientTab(p, /My surgery/).click();
  await expect(p.getByText("Saving the nerves for erections")).toBeVisible();
  const canvas = p.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(1280 / 2 - 2);

  // What I can change: patient wording; exploring a change flags the review
  // as out of date until reset.
  await patientTab(p, /What I can change/).click();
  await expect(p.getByRole("heading", { name: "Your habits and health" })).toBeVisible();
  await expect(p.getByText("Your recovery at 12 months")).toBeVisible();
  await expect(p.getByText("Save Checkpoint")).toHaveCount(0);
  await p.getByRole("button", { name: "Current" }).click();
  await expect(p.getByRole("button", { name: "Reset to original" })).toBeVisible();
  await patientTab(p, /My case/).click();
  await expect(p.getByRole("status").first()).toContainText("Your details changed after");
  await p.getByRole("button", { name: "Reset to original" }).click();
  await expect(p.getByRole("status").first()).toContainText(`Reviewed by ${REVIEWER}`);

  // Getting ready: checklist + date persist on this device; printout.
  await patientTab(p, /Getting ready/).click();
  await expect(p.locator("#preop-health").getByRole("combobox")).toBeDisabled();
  await p.locator('input[type="date"]').fill("2026-11-02");
  await expect(p.getByText(/Dates are based on your surgery on/)).toBeVisible();
  const kegel = p.getByRole("checkbox", { name: /Start daily pelvic-floor/ });
  await kegel.click();
  await expect(kegel).toHaveAttribute("aria-checked", "true");
  await expect(p.getByText("PSMA scan")).toBeVisible();

  await p.reload();
  await patientTab(p, /Getting ready/).click();
  await expect(p.locator('input[type="date"]')).toHaveValue("2026-11-02");
  await expect(p.getByRole("checkbox", { name: /Start daily pelvic-floor/ })).toHaveAttribute("aria-checked", "true");

  const printed = await p.evaluate(async () => {
    let html = "";
    const fake = { document: { write: (h: string) => { html += h; }, close() {} }, focus() {}, print() {} };
    (window as unknown as { open: () => unknown }).open = () => fake;
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Print my plan"))!.click();
    return html;
  });
  expect(printed).toContain("My surgery plan");
  expect(printed).toContain(`Reviewed by ${REVIEWER}`);
  expect(printed).toContain("When to call us right away");
  expect(printed).toMatch(/<span class="box">✓<\/span>Start daily pelvic-floor/);
  expect(printed).toContain("Follow your written plan for stopping your blood thinner");

  // Spanish, across tabs and after a reload.
  await p.getByRole("button", { name: "Ver en español" }).click();
  await expect(p.getByText("Su guía para la cirugía de próstata")).toBeVisible();
  await expect(p.getByText("Imprimir mi plan")).toBeVisible();
  await patientTab(p, /Mi caso/).click();
  await expect(p.getByText("Su diagnóstico en palabras sencillas")).toBeVisible();
  await expect(p.getByRole("status").first()).toContainText(`Revisado por ${REVIEWER}`);
  await p.reload();
  await expect(p.getByText("Su guía para la cirugía de próstata")).toBeVisible();

  // Leaving the patient path drops the patient-link lock.
  await p.goto("/clinical");
  await expect(p.getByText("Su guía para la cirugía de próstata")).toHaveCount(0);
  await expect(p.getByRole("button", { name: "More tools" })).toBeVisible();
  await patient.close();
});

test("patient link on a phone: tabs fit and prep steps through", async ({ browser }) => {
  const worker = new FakeWorker();
  const clinician = await browser.newContext();
  await worker.attach(clinician);
  const c = await clinician.newPage();
  await skipWelcome(c);
  await c.goto("/clinical");
  await c.locator('[data-tutorial="patient-select"]').click();
  await c.getByRole("button", { name: DEMO }).click();
  await c.getByRole("button", { name: "More tools" }).click();
  await c.getByRole("menuitem", { name: "Share case" }).click();
  await expect(c.getByRole("dialog")).toContainText(/\/patient\/[\w-]+/);
  const link = (await c.getByRole("dialog").textContent())!.match(/\/patient\/[0-9a-f-]{36}/)![0];
  await clinician.close();

  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await worker.attach(phone);
  const p = await phone.newPage();
  await p.goto(link);
  await expect(p.getByText("Your prostate surgery guide")).toBeVisible();
  await expect(p.getByRole("status").first()).toContainText("Not yet reviewed");

  const nav = p.getByRole("navigation", { name: "Sections" }).first();
  expect(await nav.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await patientTab(p, /Prep/).click();
  await expect(p.getByText("Step 1 of 11")).toBeVisible();
  await p.getByRole("button", { name: "Next" }).click();
  await expect(p.getByText("Step 2 of 11")).toBeVisible();
  await expect(p.getByText("Your before-surgery checklist")).toBeVisible();
  await phone.close();
});

test("a bad or expired patient link says so instead of showing a blank case", async ({ browser }) => {
  const worker = new FakeWorker();
  const ctx = await browser.newContext();
  await worker.attach(ctx);
  const p = await ctx.newPage();
  await p.goto("/patient/00000000-0000-0000-0000-000000000000");
  await expect(p.getByRole("alert")).toContainText("We couldn't open this link");
  await expect(p.getByText("Chance of the cancer coming back")).toHaveCount(0);
  await expect(p.getByText("Your diagnosis in plain words")).toHaveCount(0);
  await ctx.close();
});
