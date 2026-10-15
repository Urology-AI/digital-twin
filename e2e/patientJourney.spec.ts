import { expect, test, type Page } from "@playwright/test";

/**
 * Full journey: a clinician builds a case, opens patient mode on their own
 * device, fills pre-op details, signs the page off and walks every tab.
 * There is no backend — nothing in this flow leaves the browser.
 */

const DEMO = "GG2 mapped by PSMA, not MRI";
const REVIEWER = "Dr. E2E Reviewer";

async function skipWelcome(page: Page) {
  await page.addInitScript(() => localStorage.setItem("compass-welcome-seen", "1"));
}

function patientTab(page: Page, name: RegExp) {
  return page.getByRole("navigation", { name: /Sections|Secciones/ }).first().getByRole("button", { name });
}

async function openPatientMode(page: Page) {
  await skipWelcome(page);
  await page.goto("/clinical");
  await page.locator('[data-tutorial="patient-select"]').click();
  await page.getByRole("button", { name: DEMO }).click();
  await expect(page.locator('[data-tutorial="patient-select"]')).toContainText(DEMO);
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitem", { name: "Patient mode" }).click();
  await expect(page.getByText("Your prostate surgery guide")).toBeVisible();
}

test("clinician signs off a case in patient mode and uses every tab", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await openPatientMode(p);
  await expect(p.getByRole("button", { name: "Back to clinical mode" })).toBeVisible();

  await patientTab(p, /Getting ready/).click();
  await p.getByRole("combobox").filter({ hasText: "Healthy" }).selectOption("3");
  await p.getByRole("button", { name: "Blood thinner" }).click();
  await expect(p.locator("#preop-plan")).toContainText("Plan ahead");
  await expect(p.locator("#preop-plan")).toContainText("Bleeding");

  // Sign off.
  await expect(p.getByRole("status").first()).toContainText("Not yet reviewed");
  await p.locator("#preop-reviewer").fill(REVIEWER);
  await p.getByRole("button", { name: "Sign off" }).click();
  await expect(p.getByRole("status").first()).toContainText(`Reviewed by ${REVIEWER}`);

  // My case.
  await patientTab(p, /My case/).click();
  await expect(p.getByRole("status").first()).toContainText(`Reviewed by ${REVIEWER}`);
  await expect(p.getByText("Your diagnosis in plain words")).toBeVisible();
  await expect(p.getByText(/Grade Group 2 \(Gleason 3\+4\)/)).toBeVisible();
  await expect(p.getByText("Chance of the cancer coming back")).toBeVisible();

  // My surgery: explanations beside the live 3D canvas.
  await patientTab(p, /My surgery/).click();
  await expect(p.getByText("Saving the nerves for erections")).toBeVisible();
  const canvas = p.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(1280 / 2 - 2);

  // What I can change: patient wording.
  await patientTab(p, /What I can change/).click();
  await expect(p.getByRole("heading", { name: "Your habits and health" })).toBeVisible();
  await expect(p.getByText("Your recovery at 12 months")).toBeVisible();
  await expect(p.getByText("Save Checkpoint")).toHaveCount(0);

  // Getting ready: checklist + date persist on this device; printout.
  await patientTab(p, /Getting ready/).click();
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

  // Back to the clinical shell.
  await p.getByRole("button", { name: "Back to clinical mode" }).click();
  await expect(p.getByRole("button", { name: "More tools" })).toBeVisible();
  await ctx.close();
});

test("patient mode on a phone: tabs fit and prep steps through", async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  await openPatientMode(p);
  await expect(p.getByRole("status").first()).toContainText("Not yet reviewed");

  const nav = p.getByRole("navigation", { name: "Sections" }).first();
  expect(await nav.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await patientTab(p, /Prep/).click();
  await expect(p.getByText("Step 1 of 10")).toBeVisible();
  await p.getByRole("button", { name: "Next" }).click();
  await expect(p.getByText("Step 2 of 10")).toBeVisible();
  await expect(p.getByText("Your before-surgery checklist")).toBeVisible();
  await phone.close();
});

test("no request in the clinical app goes to a data or AI endpoint", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const hits: string[] = [];
  p.on("request", (r) => {
    const u = new URL(r.url());
    if (/^\/api\/(turso|chat)/.test(u.pathname) || u.pathname.startsWith("/patient/")) hits.push(u.pathname);
  });
  await openPatientMode(p);
  await p.getByRole("button", { name: "Back to clinical mode" }).click();
  await p.getByRole("button", { name: "More tools" }).click();
  await expect(p.getByRole("menuitem", { name: "Share case" })).toHaveCount(0);
  expect(hits).toEqual([]);
  await ctx.close();
});
