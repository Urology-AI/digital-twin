import { useState } from "react";
import { useAppUpdates } from "@/hooks/useAppUpdates";
import { Button } from "@/components/ui/button";
import { EvidencePanel } from "@/components/EvidencePanel";
import { isOfflineBuild } from "@/lib/offlineBuild";

// Build version (git tag in CI, else package.json — see vite.config.ts), plus
// the update status the header badge also shows (see useAppUpdates).
function VersionFooter() {
  const { status, refresh, desktop } = useAppUpdates();

  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 text-[11px] text-muted-foreground">
      <span>COMPASS Digital Twin · v{__APP_VERSION__}{isOfflineBuild() ? " · offline build" : ""}</span>
      {desktop && (
        <button
          type="button"
          onClick={refresh}
          className="rounded px-1.5 py-0.5 underline-offset-2 hover:bg-muted hover:underline"
        >
          Check for updates
        </button>
      )}
      {status && <span className="text-foreground/70">{status}</span>}
    </div>
  );
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-base font-semibold uppercase tracking-wide text-primary mb-2">{children}</h2>
);
const Tbl = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-[11px]">{children}</table>
  </div>
);
const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="py-1 pr-3 font-medium text-muted-foreground text-left">{children}</th>
);
const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`py-1 pr-3 ${className}`}>{children}</td>
);
const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-2 text-[10px] text-muted-foreground">{children}</p>
);

const TABS = ["Overview", "ECE", "SVI", "LNI", "Upgrade", "PSM", "BCR", "Score", "NS", "Sources"] as const;
type Tab = (typeof TABS)[number];

interface InfoPanelProps {
  onClose: () => void;
}

// ── Overview (Master Verification) ──────────────────────────────────────────
function OverviewTab() {
  return (
    <>
      <section>
        <H2>What Is COMPASS?</H2>
        <p className="text-muted-foreground leading-relaxed">
          COMPASS predicts surgical outcomes for prostate cancer patients by combining clinical data
          with three imaging modalities: MRI, micro-ultrasound (ExactVu), and PSMA PET/CT. It generates{" "}
          <strong className="text-foreground">side-specific nerve-sparing recommendations</strong> and{" "}
          <strong className="text-foreground">zone-level risk heatmaps</strong> for surgical planning.
        </p>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          Developed on <strong className="text-foreground">3,454 consecutive RARP patients</strong> (ECE/SVI),
          3,137 for Upgrade, 4,203 for PSM, 663 for LNI (PLND dataset), 2,399 for BCR.
          Mount Sinai Health System, January 2015 — January 2026.
        </p>
        <p className="text-muted-foreground mt-1 leading-relaxed text-[11px]">
          All models: L2-regularized logistic regression (C=1.0), 5-fold stratified CV,
          StandardScaler-within-fold (no leakage), mean imputation + Decipher availability flag.
          Bootstrap-corrected AUC via Harrell method (500 iterations); 95% CI via 1,000 bootstrap iterations.
        </p>
      </section>

      <section>
        <H2>Headline Results — All Models Locked</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border">
              <Th>Endpoint</Th><Th>N</Th><Th>Events</Th><Th>CV AUC</Th><Th>BC AUC</Th><Th>95% CI</Th><Th>BSS</Th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["ECE", "3,454", "882 (25.5%)", "0.7825", "—", "—", "—"],
              ["SVI", "3,454", "301 (8.7%)", "0.8322", "—", "—", "—"],
              ["Grade Upgrade", "3,137", "422 (13.5%)", "0.8121", "—", "—", "—"],
              ["LNI", "663", "35 (5.3%)", "0.8422", "—", "—", "—"],
              ["PSM (left / right)", "4,203 pts / 8,406 sides", "616 (7.3%)", "0.6934", "—", "—", "—"],
              ["BCR", "2,399", "297 (12.4%)", "0.743", "—", "0.738–0.800", "+12.8%"],
            ].map(([ep, n, ev, cv, bc, ci, bss]) => (
              <tr key={ep} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{ep}</Td>
                <Td className="tabular-nums">{n}</Td>
                <Td className="tabular-nums">{ev}</Td>
                <Td className="tabular-nums font-semibold text-foreground">{cv}</Td>
                <Td className="tabular-nums">{bc}</Td>
                <Td className="tabular-nums">{ci}</Td>
                <Td className="tabular-nums">{bss}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>BC AUC = Bootstrap-corrected AUC (Harrell optimism, 500 iterations). BSS = Brier Skill Score vs null model. All models independently verified from raw data 2026-05-03. ECE, SVI, Grade Upgrade, PSM and LNI rows report repeated cross-validated AUC; bootstrap-corrected AUC, CI and BSS were not recomputed.</Note>
      </section>

      <section>
        <H2>Common 22-Feature Input Set</H2>
        <p className="text-muted-foreground text-[11px] mb-2">BCR uses this identical set. ECE, SVI, Upgrade, PSM and LNI use their own smaller input sets (see each tab). Sparse-coverage features are mean-imputed; Decipher also has an availability flag.</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>#</Th><Th>Feature</Th><Th>Source</Th><Th>Coverage</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["1", "Biopsy Grade Group 2 (binary)", "Biopsy GG", "100%"],
              ["2", "Biopsy Grade Group 3 (binary)", "Biopsy GG", "100%"],
              ["3", "Biopsy Grade Group 4–5 (binary)", "Biopsy GG", "100%"],
              ["4", "log(PSA Density)", "PSA / Volume", "100%"],
              ["5", "PI-RADS (1–5)", "MRI", "88%"],
              ["6", "MRI EPE (binary)", "MRI ECE Lesion 1", "80%"],
              ["7", "MRI SVI (binary)", "MRI SVI", "91%"],
              ["8", "MUS ECE (binary)", "ExactVu EV_ECE", "10%"],
              ["9", "PSMA EPE (binary)", "PSMA PET EPE", "6%"],
              ["10", "Decipher Score (mean-imputed)", "Decipher", "100% (imputed)"],
              ["11", "Decipher Available (flag)", "Derived", "100%"],
              ["12", "Max Core %", "Biopsy", "18%"],
              ["13", "Positive Cores", "Biopsy", "18%"],
              ["14", "Lesion Size (mm)", "MRI Size × 10", "88%"],
              ["15", "Capsular Abutment Grade (0–4)", "MRI Abutment", "52%"],
              ["16", "ADC Mean", "MRI ADC", "39%"],
              ["17", "PSMA SUVmax (continuous)", "PSMA PET", "11%"],
              ["18", "PRI-MUS Score (1–5)", "ExactVu PRIMUS", "9%"],
              ["19", "Bx PNI (binary)", "Biopsy", "13%"],
              ["20", "Bx Cribriform (binary)", "Biopsy", "13%"],
              ["21", "Bx IDC (binary)", "Biopsy", "13%"],
              ["22", "Bilateral Cores (binary)", "Biopsy", "9%"],
            ].map(([num, feat, src, cov]) => (
              <tr key={num} className="border-b border-border/40">
                <Td className="text-muted-foreground">{num}</Td>
                <Td className="text-foreground">{feat}</Td>
                <Td>{src}</Td>
                <Td className="tabular-nums">{cov}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>LNI uses a 3-feature set (see LNI tab). Decipher Available flag β=+0.42 in ECE (third largest predictor).</Note>
      </section>

      <section>
        <H2>LNI 3-Feature Set</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>Definition</Th><Th>Encoding</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["log(PSA Density)", "ln(PSA / Prostate Volume cc), no offset", "Continuous"],
              ["GG High (gg4_5)", "Biopsy Grade Group 4 or 5", "Binary"],
              ["PSMA LN Positive", "PSMA PET-positive pelvic lymph nodes (any). Not performed is neutral, not negative", "Binary"],
            ].map(([feat, def, enc]) => (
              <tr key={feat} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{feat}</Td><Td>{def}</Td><Td>{enc}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Three-feature model. Positive biopsy cores are not an input.</Note>
      </section>

      <section>
        <H2>Methodology</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Item</Th><Th>Approach</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Model type", "L2-regularized logistic regression (sklearn, penalty='l2', C=1.0, max_iter=5000, random_state=42)"],
              ["Feature scaling", "StandardScaler fit only on training fold — prevents data leakage"],
              ["Missing data", "Mean imputation; binary availability flag for Decipher"],
              ["Cross-validation", "5-fold StratifiedKFold (shuffle=True, random_state=42)"],
              ["Bootstrap 95% CI", "1,000 bootstrap iterations, percentile method"],
              ["Bootstrap optimism", "Harrell method, 500 iterations"],
              ["Brier Skill Score", "BSS = 1 − (Brier_model / Brier_null)"],
              ["LNI cohort", "PLND_Dataset (3-16-26), N=663 with pathologic LN assessment"],
              ["Software", "Python 3.12, scikit-learn 1.5"],
              ["Data lock", "Mount Sinai RARP database, Jan 2015 – Jan 2026"],
            ].map(([item, approach]) => (
              <tr key={item} className="border-b border-border/40">
                <Td className="font-medium text-foreground whitespace-nowrap">{item}</Td>
                <Td>{approach}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>Zone-Level Heatmap Architecture</H2>
        <p className="text-muted-foreground text-[11px] mb-2">
          Zone risk = patient-level COMPASS prediction projected onto anatomic zones using imaging localization.
          Formula: <code className="text-foreground">Risk_zone = P_patient × ZoneWeight(z, imaging_at_z)</code>
        </p>
        <div className="mb-1 text-[10px] font-semibold text-muted-foreground">Observed Zone-Specific ECE Rates (N=299 patients with structured MUS zone data)</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Zone</Th><Th>N</Th><Th>ECE+</Th><Th>ECE Rate</Th><Th>Mean P_compass</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["L-Apex", "48", "18", "37.5%", "0.263"],
              ["L-Mid", "69", "21", "30.4%", "0.197"],
              ["L-Base", "31", "11", "35.5%", "0.190"],
              ["R-Apex", "45", "7", "15.6%", "0.211"],
              ["R-Mid", "58", "18", "31.0%", "0.246"],
              ["R-Base", "33", "13", "39.4%", "0.211"],
            ].map(([zone, n, eceN, rate, pred]) => (
              <tr key={zone} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{zone}</Td>
                <Td className="tabular-nums">{n}</Td>
                <Td className="tabular-nums">{eceN}</Td>
                <Td className="tabular-nums">{rate}</Td>
                <Td className="tabular-nums">{pred}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Zone model CV AUC 0.745 (+0.004 vs patient-level 0.741). Zone architecture is a projection, not a separately fitted model.</Note>
      </section>

      <section>
        <H2>Decipher Genomic Classifier</H2>
        <p className="text-muted-foreground text-[11px] mb-2">N=1,845 patients (34%) have Decipher scores (mean 0.521). Incorporated via mean-imputation + availability flag.</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Decipher Risk</Th><Th>N</Th><Th>ECE</Th><Th>SVI</Th><Th>BCR</Th><Th>LNI</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Low (<0.45)", "821", "25.0%", "6.3%", "9.6%", "2.1%", ""],
              ["Intermediate (0.45–0.60)", "302", "34.3%", "11.3%", "17.3%", "3.5%", ""],
              ["High (≥0.60)", "722", "55.5%", "25.4%", "29.3%", "16.0%", "text-red-500 font-semibold"],
            ].map(([risk, n, ece, svi, bcr, lni, cls]) => (
              <tr key={risk} className={`border-b border-border/40 ${cls}`}>
                <Td>{risk}</Td><Td className="tabular-nums">{n}</Td>
                <Td className="tabular-nums">{ece}</Td><Td className="tabular-nums">{svi}</Td>
                <Td className="tabular-nums">{bcr}</Td>
                <td className="py-1 pr-3 tabular-nums">{lni}</td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>Median Lobe Grading</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Describes intravesical protrusion of the prostate. Affects bladder neck dissection approach during RALP.</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Grade</Th><Th>Protrusion</Th><Th>Surgical Impact</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["0", "None", "Standard bladder neck dissection"],
              ["1", "Mild (< 1 cm)", "Minor adjustment, straightforward"],
              ["2", "Moderate (1–2 cm)", "Modified BN dissection, posterior approach may be needed"],
              ["3", "Severe (> 2 cm)", "Complex BN dissection, risk of BN margin, consider wider resection"],
            ].map(([g, prot, impact]) => (
              <tr key={g} className="border-b border-border/40">
                <Td className="font-bold text-foreground">{g}</Td><Td>{prot}</Td><Td>{impact}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>How Predictions Are Calculated</H2>
        <p className="text-muted-foreground text-[11px] mb-2">
          Every COMPASS model is a <strong className="text-foreground">standardized logistic regression</strong>.
          The same three-step formula applies to all six endpoints.
        </p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Step</Th><Th>Formula</Th><Th>Notes</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["1 — Z-score each input", "z = (value − mean) / scale", "mean and scale are from the training cohort (N=5,352). Never re-standardise on external data."],
              ["2 — Linear combination", "logit = intercept + Σ (coeff × z)", "Coefficients from L2 logistic regression. All weights are in src/lib/models/weights.ts."],
              ["3 — Logistic function", "probability = 1 / (1 + e⁻ˡᵒᵍⁱᵗ)", "ECE uses the raw sigmoid output with no clamp. Other endpoints are unchanged."],
            ].map(([step, formula, note]) => (
              <tr key={step} className="border-b border-border/40">
                <Td className="font-medium text-foreground whitespace-nowrap">{step}</Td>
                <Td><code className="text-foreground text-[10px]">{formula}</code></Td>
                <Td>{note}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>

        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Feature engineering — transformations applied before z-scoring</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Input</Th><Th>Transformation</Th><Th>Reason</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["PSA + Prostate Volume", "log(PSA / Volume + 0.01)", "PSA density is right-skewed; log compresses it. +0.01 prevents log(0)."],
              ["Max Core %", "If ≤ 1 → multiply by 100", "Normalises fractional (0.60) and percentage (60) encodings to same 0–100 scale."],
              ["PI-RADS", "max(pirads, 2)", "PI-RADS 1 is clinically equivalent to 2 for EPE risk; prevents extrapolation below training range."],
              ["Grade Group", "Split into gg2 / gg3 / gg45 binary flags", "One-hot encoding with GG1 as reference. Each grade group gets an independent effect."],
              ["Decipher score", "Missing → substitute 0.521 (cohort mean); set decipher_available = 0", "Mean imputation so patients without genomic testing still get a prediction. The available flag discounts the imputed value."],
              ["ECE concordance", "mri_epe + mus_ece + psma_epe (0–3)", "Counts imaging modalities agreeing on EPE. Multi-modal agreement carries more weight than any single modality."],
            ].map(([input, tx, reason]) => (
              <tr key={input} className="border-b border-border/40">
                <Td className="font-medium text-foreground whitespace-nowrap">{input}</Td>
                <Td><code className="text-[10px] text-foreground">{tx}</code></Td>
                <Td>{reason}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>

        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Worked example — ECE (GG3, PSA 12, volume 30 cc, PI-RADS 4, MRI EPE+; MRI SVI, max core % and capsular abutment not entered)</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>Value → z-score</Th><Th>× coeff</Th><Th>Contribution</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["gg2",                "0 → −0.861",                       "× 0.3872", "−0.333"],
              ["gg3",                "1 → +1.820",                       "× 0.5178", "+0.942"],
              ["gg4_5",              "0 → −0.535",                       "× 0.6650", "−0.356"],
              ["log_psad",           "log(12/30)=−0.916 → +1.096",       "× 0.3169", "+0.347"],
              ["pirads",             "4 → −0.283",                       "× 0.4302", "−0.122"],
              ["mri_epe",            "1 → +2.643",                       "× 0.1396", "+0.369"],
              ["mri_svi_clean",      "missing → training mean → 0",      "× 0.2510", "0.000"],
              ["max_core_pct",       "missing → training mean → 0",      "× 0.4629", "0.000"],
              ["capsular_abutment",  "missing → training mean → 0",      "× 0.1257", "0.000"],
            ].map(([feat, val, coeff, contrib]) => (
              <tr key={feat} className="border-b border-border/40">
                <Td className="font-mono text-[10px] text-foreground">{feat}</Td>
                <Td className="font-mono text-[10px]">{val}</Td>
                <Td className="font-mono text-[10px] tabular-nums">{coeff}</Td>
                <Td className={`font-mono text-[10px] tabular-nums font-semibold ${(contrib ?? "").startsWith("+") ? "text-orange-500" : "text-blue-400"}`}>{contrib}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>intercept −1.3398 + sum of contributions = logit −0.492 → probability 37.9%. Missing optional inputs take the frozen training mean (z = 0), never a negative value.</Note>
      </section>

      <section>
        <H2>Known Limitations</H2>
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
          <li>Single institution (Mount Sinai). External validation in progress.</li>
          <li>PSM discrimination is modest (AUC 0.69) because intraoperative surgical technique strongly influences margins.</li>
          <li>BCR: median follow-up ~14 months (immature); negative imaging coefficients reflect salvage-therapy informative censoring, not biology.</li>
          <li>Zone-level cohort N=299 with MUS zone data — larger validation needed.</li>
          <li>Decipher coverage 37%; mean imputation + availability flag documented and calibrated.</li>
          <li>Side-specific ECE is a research model on a smaller cohort (606 patients, 1,212 sides); side-specific SVI uses 664 patients / 1,328 sides (92 events).</li>
          <li>Predictions are decision support, not substitutes for clinical judgment.</li>
        </ul>
        <Note>COMPASS · 6 prediction models · Lateralized ECE + SVI · PLND Decision Module · Trimodal + Decipher · Verified 2026-05-03 · Mount Sinai Health System</Note>
      </section>
    </>
  );
}

// ── ECE (ECE Supplementary) ─────────────────────────────────────────────────
function EceTab() {
  return (
    <>
      <section>
        <H2>ECE Patient-Level Model</H2>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N (analytic cohort)", "3,454"],
              ["ECE events", "882 (25.5%)"],
              ["Repeated 10×5-fold CV AUC", "0.7825"],
              ["2024–2025 temporal AUC (same institution)", "0.7415"],
              ["Brier score (repeated CV)", "0.1494"],
              ["Calibration slope / intercept (repeated CV)", "0.9815 / −0.0162"],
              ["Output", "Raw logistic probability, no clamp"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>ECE — Locked Coefficients (9 Predictors)</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th><Th>Magnitude</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Grade Group 4–5", "+0.6650", "Strong"],
              ["Grade Group 3", "+0.5178", "Strong"],
              ["Max Core %", "+0.4629", "Strong"],
              ["PI-RADS", "+0.4302", "Strong"],
              ["Grade Group 2", "+0.3872", "Strong"],
              ["log(PSA Density)", "+0.3169", "Strong"],
              ["MRI SVI", "+0.2510", "Moderate"],
              ["MRI EPE", "+0.1396", "Moderate"],
              ["Capsular Abutment", "+0.1257", "Moderate"],
            ].map(([f, b, mag]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td>
                <Td className="tabular-nums font-mono">{b}</Td>
                <Td className="text-muted-foreground">{mag}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>ECE — Head-to-Head vs Comparator Nomograms (earlier model, not recomputed)</H2>
        <p className="text-muted-foreground text-[11px] mb-2">MSKCC applied with exact published coefficients. Clinical T stage: 77% from DRE notes, 23% MRI-derived proxy. Stage distribution: T1c 51%, T2 45%, T3+ 4%. Mean predicted ECE 56.1% vs actual 25.5%.</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Model</Th><Th>AUC (95% CI)</Th><Th>ΔAUC vs COMPASS</Th><Th>p-value</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["COMPASS ECE (22 features)", "0.797 (0.790–0.825)", "—", "—", "text-foreground font-semibold"],
              ["Martini 2018 (exact)", "0.716 (0.694–0.738)", "−0.081", "<0.001", ""],
              ["Pedraza 2022 (exact OR)", "0.706 (0.683–0.728)", "−0.091", "<0.001", ""],
              ["MSKCC ECE (exact, hybrid DRE)", "0.694 (0.674–0.714)", "−0.085 (103)", "<0.001", ""],
            ].map(([model, auc, delta, p, cls]) => (
              <tr key={model} className={`border-b border-border/40 ${cls}`}>
                <Td>{model}</Td>
                <Td className="tabular-nums">{auc}</Td>
                <Td className="tabular-nums">{delta}</Td>
                <Td className="tabular-nums">{p}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>ECE — Confusion Matrices (earlier model, not recomputed)</H2>
        <div className="mb-1 text-[10px] font-semibold text-muted-foreground">Threshold = 0.20</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Model</Th><Th>Sensitivity</Th><Th>Specificity</Th><Th>PPV</Th><Th>NPV</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["COMPASS", "76.1%", "62.1%", "40.8%", "88.3%", "text-foreground"],
              ["Martini 2018", "72.8%", "57.9%", "37.2%", "86.1%", ""],
              ["Pedraza 2022", "70.7%", "60.3%", "37.9%", "85.7%", ""],
              ["MSKCC ECE", "98.4%", "5.4%", "26.3%", "90.8%", ""],
            ].map(([m, sens, spec, ppv, npv, cls]) => (
              <tr key={m} className={`border-b border-border/40 ${cls}`}>
                <Td>{m}</Td>
                <Td className="tabular-nums">{sens}</Td><Td className="tabular-nums">{spec}</Td>
                <Td className="tabular-nums">{ppv}</Td><Td className="tabular-nums">{npv}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground">Threshold = 0.30</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Model</Th><Th>Sensitivity</Th><Th>Specificity</Th><Th>PPV</Th><Th>NPV</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["COMPASS", "60.1%", "81.3%", "52.5%", "85.6%", "text-foreground"],
              ["Martini 2018", "56.8%", "75.6%", "44.4%", "83.6%", ""],
              ["Pedraza 2022", "44.3%", "83.4%", "47.7%", "81.4%", ""],
              ["MSKCC ECE", "96.4%", "13.4%", "27.6%", "91.5%", ""],
            ].map(([m, sens, spec, ppv, npv, cls]) => (
              <tr key={m} className={`border-b border-border/40 ${cls}`}>
                <Td>{m}</Td>
                <Td className="tabular-nums">{sens}</Td><Td className="tabular-nums">{spec}</Td>
                <Td className="tabular-nums">{ppv}</Td><Td className="tabular-nums">{npv}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Threshold 0.20 maximizes sensitivity for nerve-sparing decisions. Threshold 0.30 for higher-confidence wide-resection recommendation.</Note>
      </section>

      <section>
        <H2>ECE Left / Right Model</H2>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Cohort", "606 patients / 1,212 sides"],
              ["Side EPE events", "241"],
              ["10×5 patient-grouped CV AUC", "0.7362"],
              ["Global ECE + side grade group only (AUC)", "0.7304"],
              ["Brier score", "0.1378"],
              ["Calibration slope / intercept", "0.8775 / −0.1533"],
              ["2024–2025 temporal AUC", "0.6928"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground">Side-Specific Coefficients</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Global ECE logit", "+0.7386"],
              ["Side biopsy Grade Group", "+0.3789"],
              ["ExactVu lesion on that side", "+0.3151"],
            ].map(([f, b]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>Focal vs Extensive ECE</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Given ECE is present, predicts focal (&lt;2 HPF) or extensive. Applied to ECE-positive patients only.</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Type</Th><Th>Definition</Th><Th>5-yr DFS</Th><Th>NS Implication</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/40">
              <Td className="text-emerald-400 font-medium">Focal</Td>
              <Td>&lt;2 high-power fields beyond capsule</Td>
              <Td className="tabular-nums">~82%</Td>
              <Td>Partial nerve-sparing may be feasible</Td>
            </tr>
            <tr className="border-b border-border/40">
              <Td className="text-red-400 font-medium">Extensive</Td>
              <Td>Established tumor spread beyond capsule</Td>
              <Td className="tabular-nums">~65%</Td>
              <Td>Wide resection recommended</Td>
            </tr>
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>Imaging Detail Variables (MRI Adjustments)</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Three MRI-derived variables that adjust ECE prediction when entered via the lesion table:</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Variable</Th><Th>Univariable AUC</Th><Th>Dose-Response</Th><Th>Coefficient</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Lesion Size (mm)", "0.691 (N=3,335)", "12.7% (≤9mm) → 45.7% (>18mm)", "β=+0.636/cm"],
              ["Capsular Abutment (0–4)", "0.647 (N=1,781)", "12.2% (none) → 40.4% (bulge)", "β=+0.171/grade"],
              ["ADC Mean", "0.634 (N=1,894)", "33.9% (Q1) → 12.6% (Q4)", "β=−0.00023/unit"],
            ].map(([v, auc, dose, coef]) => (
              <tr key={v} className="border-b border-border/40">
                <Td className="text-foreground">{v}</Td><Td className="tabular-nums">{auc}</Td>
                <Td>{dose}</Td><Td className="font-mono tabular-nums">{coef}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>ECE Risk vs Actual Pathology (earlier model, not recomputed)</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Predicted ECE Risk</Th><Th>Actual EPE Found</Th><Th>Suggested Action</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["< 15%", "~15%", "Favor intrafascial nerve-sparing"],
              ["15–30%", "~25%", "Standard interfascial approach"],
              ["30–50%", "~40%", "Consider wide resection on that side"],
              ["> 50%", "~73%", "Wide resection recommended"],
            ].map(([pred, actual, action]) => (
              <tr key={pred} className="border-b border-border/40">
                <Td className="tabular-nums">{pred}</Td>
                <Td className="tabular-nums">{actual}</Td><Td>{action}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>
    </>
  );
}

// ── SVI (Patient-Level + Side-Specific) ─────────────────────────────────────
function SviTab() {
  return (
    <>
      <section>
        <H2>SVI Patient-Level Model</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Probability of seminal vesicle invasion at surgery. Standardized L2-regularized logistic regression (same core lock as ECE and Upgrade). Research use only.</p>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N (analytic cohort)", "3,454"],
              ["SVI events", "301 (8.7%)"],
              ["Repeated 10×5-fold CV AUC", "0.8322"],
              ["2024–2025 temporal AUC (same institution)", "0.8107"],
              ["Output", "Raw logistic probability, no clamp"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inputs (7 predictors)</div>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Input</Th><Th>How it is used</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Biopsy Grade Group", "Required. Entered as GG2, GG3, GG4–5 versus GG1"],
              ["PSA and prostate volume", "Required. Combined as log PSA density"],
              ["PI-RADS", "Optional"],
              ["MRI SVI", "Optional"],
              ["Max core %", "Optional"],
            ].map(([f, d]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td><Td>{d}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Missing optional inputs take the frozen training mean, never a negative value. If PSA, volume or grade group is missing, no prediction is made.</Note>
      </section>


      <section>
        <H2>SVI Left / Right Model</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Splits the patient-level SVI risk into left and right. It is a localization aid built on the patient-level SVI model, not a separate outcome. Research use only.</p>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Cohort", "664 patients / 1,328 sides"],
              ["Side SVI events", "92"],
              ["10×5 patient-grouped CV AUC", "0.8415"],
              ["Patient-level SVI logit alone (AUC)", "0.8350"],
              ["Inputs", "Patient-level SVI risk and biopsy Grade Group on that side"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Side grade group helps only modestly (ΔAUC +0.0065) and calibration is weaker than the patient-level model, so the side value is a ranking aid and not a calibrated probability. A side with no documented cancer counts as GG 0; an unknown side is treated as missing, not as zero.</Note>
      </section>
    </>
  );
}

// ── LNI (LNI Supplementary) ─────────────────────────────────────────────────
function LniTab() {
  return (
    <>
      <section>
        <H2>LNI Model</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Probability of lymph node invasion at surgery. Standardized L2-regularized logistic regression with three inputs. Research use only.</p>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N (PLND cohort)", "663"],
              ["LN+ events", "35 (5.3%)"],
              ["Repeated out-of-fold CV AUC", "0.8422"],
              ["Brier score", "0.0491"],
              ["Calibration slope / intercept", "0.91 / −0.236"],
              ["Output", "Raw logistic probability, no clamp"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inputs (3 predictors)</div>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Input</Th><Th>How it is used</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["PSA and prostate volume", "Required. Combined as log PSA density"],
              ["Biopsy Grade Group", "Required. Grade Group 4–5 versus 1–3"],
              ["PSMA PET pelvic lymph nodes", "Optional. Positive or negative. Not performed is NOT treated as negative"],
            ].map(([f, d]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td><Td>{d}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Risk tiers</div>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Tier</Th><Th>Predicted risk (observed in development)</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Low", "Below 2% (0 of 206 had LN+ in development)"],
              ["Intermediate", "2% to below 5% (2.2% observed)"],
              ["High", "5% or above (16.2% observed)"],
            ].map(([f, d]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td><Td>{d}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Only 35 events, so the tiers rest on few cases and need external validation. There is no side-specific or regional LNI and no automatic PLND recommendation. Positive biopsy cores are no longer an input.</Note>
      </section>


      <section>
        <H2>PLND Decision Module</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Based on N=663 consecutive RARP + PLND + PSMA PET patients. Asymmetric rule derived from risk-stratified diagnostic accuracy.</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Scenario</Th><Th>LNI Rate</Th><Th>Recommendation</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Non-HR + PSMA LN−", "0%", "Consider omitting PLND (zero false negatives in cohort)"],
              ["Non-HR + PSMA LN+", "Low", "Limited PLND (low PPV, most nodes are FP)"],
              ["HR + PSMA LN−", "12%", "Always ePLND (12% occult LNI)"],
              ["HR + PSMA LN+", "Highest", "Always ePLND, high priority"],
            ].map(([sc, lni, rec]) => (
              <tr key={sc} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{sc}</Td>
                <Td className="tabular-nums">{lni}</Td><Td>{rec}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>NCCN High-Risk = GG ≥ 4 or PSA &gt; 20 ng/mL. All false negatives in the cohort were NCCN high-risk patients.</Note>

        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground">Station-Specific False Positive Rates (N=82 PSMA LN+ with ePLND histopathology)</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Station</Th><Th>FP Rate</Th><Th>Clinical Note</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["External iliac", "90%", "text-emerald-500", "Predominantly reactive nodes"],
              ["Inguinal", "70%", "text-emerald-500", "Often reactive"],
              ["Common iliac", "50%", "text-amber-500", "Moderate concern, check SUVmax"],
              ["Presacral", "30%", "text-amber-500", "Moderate concern"],
              ["Obturator", "25%", "", "Clinically significant when positive"],
              ["Internal iliac", "20%", "text-red-500", "High clinical significance"],
              ["Perirectal", "15%", "text-red-500", "Rare but highly concerning"],
            ].map(([station, fp, cls, note]) => (
              <tr key={station} className="border-b border-border/40">
                <Td>{station}</Td>
                <Td className={`tabular-nums font-semibold ${cls}`}>{fp}</Td>
                <Td>{note}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>

        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground">SUVmax Interpretation for PSMA LN+</div>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>LN SUVmax</Th><Th>Assessment</Th></tr></thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/40"><Td className="tabular-nums">&lt; 3.5</Td><Td className="text-emerald-500">Likely reactive / false positive</Td></tr>
            <tr className="border-b border-border/40"><Td className="tabular-nums">3.5 – 6.0</Td><Td className="text-amber-500">Indeterminate</Td></tr>
            <tr className="border-b border-border/40"><Td className="tabular-nums">&gt; 6.0</Td><Td className="text-red-500">Likely true positive</Td></tr>
          </tbody>
        </Tbl>
      </section>
    </>
  );
}

// ── Upgrade (Grade Upgrade Supplementary) ───────────────────────────────────
function UpgradeTab() {
  return (
    <>
      <section>
        <H2>Grade Upgrade Model</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Probability that final pathology has a higher Grade Group than the biopsy. Applies to biopsy Grade Group 1–4 only. For GG5 there is no higher grade, so the result is Not applicable. Standardized L2-regularized logistic regression (same core lock as ECE and SVI). Research use only.</p>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N (analytic cohort)", "3,137"],
              ["Upgrade events", "422 (13.5%)"],
              ["Repeated 10×5-fold CV AUC", "0.8121"],
              ["2024–2025 temporal AUC (same institution)", "0.8226"],
              ["Output", "Raw logistic probability, no clamp"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inputs (6 clinical inputs)</div>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Input</Th><Th>How it is used</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Biopsy Grade Group", "Required. GG1 to GG4"],
              ["PSA and prostate volume", "Required. Combined as log PSA density"],
              ["PI-RADS", "Optional"],
              ["MRI SVI", "Optional"],
              ["Positive biopsy cores", "Optional"],
              ["ADC mean", "Optional"],
            ].map(([f, d]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td><Td>{d}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Risk tiers</div>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Tier</Th><Th>Predicted risk (observed in development)</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Low", "Below 5% (about 3.7–3.8% observed)"],
              ["Intermediate", "5% to below 20% (about 8.2–8.3% observed)"],
              ["High", "20% or above (about 51–52% observed)"],
            ].map(([f, d]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td><Td>{d}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Missing optional inputs take the frozen training mean, never a negative value. Patient-level only: there is no left/right or regional Upgrade. Provisionally frozen pending external validation.</Note>
      </section>


    </>
  );
}

// ── PSM (PSM Side-Specific Supplementary) ───────────────────────────────────
function PsmTab() {
  return (
    <>
      <section>
        <H2>PSM Left / Right Model</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Probability of a positive surgical margin, predicted separately for the left and right side. Standardized L2-regularized logistic regression with three inputs. Research use only.</p>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N (development cohort)", "4,203 patients / 8,406 sides"],
              ["Side PSM events", "616 (7.3%)"],
              ["Patient-grouped CV AUC", "0.6934"],
              ["Repeated grouped-CV mean AUC", "0.6942"],
              ["Brier score / calibration slope", "0.0657 / 0.981"],
              ["2024–2025 temporal AUC / Brier / slope", "0.6841 / 0.0725 / 0.936"],
              ["Output", "Raw logistic probability per side, no clamp"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inputs (3 predictors)</div>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Input</Th><Th>How it is used</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["PSA and prostate volume", "Required. Combined as log PSA density"],
              ["Positive biopsy cores", "Optional. Missing takes the training mean"],
              ["PI-RADS of the MRI index lesion, by side", "Index lesion side gets its PI-RADS, the other side gets 0, a bilateral index lesion gives both sides the score. Unknown side or score is missing, never guessed"],
            ].map(([f, d]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td><Td>{d}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Risk tiers (per side)</div>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Tier</Th><Th>Predicted risk (observed in development)</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Very low", "Below 3% (2.0% observed)"],
              ["Low", "3% to below 8% (5.1% observed)"],
              ["Intermediate", "8% to below 15% (11.7% observed)"],
              ["High", "15% or above (19.0% observed)"],
            ].map(([f, d]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td><Td>{d}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>A margin is counted as left or right only when the pathology report explicitly names the side. Generic descriptions (apex, base, posterior, bladder neck, seminal vesicle, midline) are not assigned a side. Nerve-sparing grade and ECE are not inputs. Same-institution temporal check only, not external validation.</Note>
      </section>

    </>
  );
}

// ── BCR (BCR Supplementary) ─────────────────────────────────────────────────
function BcrTab() {
  return (
    <>
      <section>
        <H2>BCR Model — With Salvage Caveat</H2>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N (analytic cohort)", "2,399"],
              ["BCR events", "297 (12.4%)"],
              ["Median follow-up", "~14 months"],
              ["CV AUC", "0.743 (SD 0.024)"],
              ["Apparent AUC", "0.763"],
              ["95% CI", "0.738–0.800"],
              ["Brier Skill Score", "+12.8%"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>BCR defined as PSA ≥ 0.2 ng/mL on two consecutive measurements ≥ 6 weeks apart following radical prostatectomy.</Note>
      </section>

      <section>
        <H2>BCR — Locked Coefficients (22 Features)</H2>
        <p className="text-muted-foreground text-[11px] mb-2">⚠ Flagged features show negative coefficients due to salvage-therapy informative censoring — not biological protection.</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th><Th>Flag</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Decipher Available (flag)", "+0.4597", "Strong positive predictor", ""],
              ["Grade Group 4–5", "+0.4495", "Strong positive predictor", ""],
              ["Grade Group 3", "+0.3019", "Strong positive predictor", ""],
              ["Bx Cribriform", "+0.2626", "Moderate predictor", ""],
              ["log(PSA Density)", "+0.2346", "Moderate predictor", ""],
              ["Bx IDC", "+0.2323", "Moderate predictor", ""],
              ["Grade Group 2", "+0.2256", "Moderate predictor", ""],
              ["Decipher Score (imputed)", "+0.2157", "Moderate predictor", ""],
              ["PI-RADS", "+0.1757", "Moderate predictor", ""],
              ["Bx PNI", "−0.1420", "⚠ Salvage censoring", "text-amber-400"],
              ["ADC Mean", "−0.1282", "⚠ Salvage censoring", "text-amber-400"],
              ["MRI SVI", "+0.1222", "Small contribution", ""],
              ["Bilateral Cores", "−0.0986", "⚠ Salvage censoring", "text-amber-400"],
              ["MRI EPE", "+0.0843", "Small contribution", ""],
              ["Capsular Abutment", "+0.0691", "Small contribution", ""],
              ["PSMA SUVmax", "−0.0445", "⚠ Salvage censoring", "text-amber-400"],
              ["MUS ECE", "−0.0358", "⚠ Salvage censoring", "text-amber-400"],
              ["Positive Cores", "+0.0341", "Small contribution", ""],
              ["PRI-MUS Score", "−0.0185", "⚠ Salvage censoring", "text-amber-400"],
              ["Max Core %", "−0.0141", "⚠ Salvage censoring", "text-amber-400"],
              ["PSMA EPE", "−0.0125", "⚠ Salvage censoring", "text-amber-400"],
              ["Lesion Size (mm)", "−0.0121", "⚠ Salvage censoring", "text-amber-400"],
            ].map(([f, b, flag, cls]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td>
                <Td className={`tabular-nums font-mono ${cls}`}>{b}</Td>
                <Td className="text-muted-foreground">{flag}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>Salvage Therapy Informative Censoring</H2>
        <p className="text-muted-foreground text-[11px] leading-relaxed mb-2">
          High-risk imaging findings at preop → closer post-op monitoring → earlier salvage therapy initiation → PSA suppressed below 0.2 ng/mL → patient recorded as <em>BCR-free</em> → imaging risk factors appear paradoxically inversely associated with observed BCR.
        </p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Use Case</Th><Th>Validity</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Discrimination / ranking patients", "Valid (AUC 0.743)", "text-emerald-500"],
              ["Identifying low-risk patients (high NPV)", "Valid", "text-emerald-500"],
              ["Absolute risk calibration", "Caveated — suppressed by salvage in high-risk patients", "text-amber-400"],
              ["Imaging-feature β interpretation", "Do not interpret negative coefficients as causal", "text-red-400"],
              ["Counterfactual ('what if no salvage')", "Cannot answer with current data", "text-red-400"],
            ].map(([use, val, cls]) => (
              <tr key={use} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{use}</Td>
                <Td className={cls}>{val}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Salvage therapy not abstracted. Median follow-up ~14 months (immature — full BCR maturation requires 5+ years). Single-institution. Decipher coverage 37%.</Note>
      </section>
    </>
  );
}

// ── Score (Integrated Score Supplementary) ──────────────────────────────────
function ScoreTab() {
  return (
    <>
      <section>
        <H2>COMPASS Score — Component Models</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Endpoint</Th><Th>Model</Th><Th>N</Th><Th>CV AUC</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["P(ECE)", "9-feature L2 logistic", "3,454 / 25.5%", "0.7825"],
              ["P(SVI)", "7-feature L2 logistic", "3,454 / 8.7%", "0.8322"],
              ["P(Upgrade)", "8-feature L2 logistic (GG1–4)", "3,137 / 13.5%", "0.8121"],
              ["P(PSM)", "3-feature L2 logistic, left / right", "8,406 sides / 7.3%", "0.6934"],
              ["P(LNI)", "3-feature L2 logistic with PSMA", "663 / 5.3%", "0.8422"],
            ].map(([ep, model, n, auc]) => (
              <tr key={ep} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{ep}</Td>
                <Td>{model}</Td><Td className="tabular-nums">{n}</Td>
                <Td className="tabular-nums font-semibold">{auc}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>COMPASS Score Formula</H2>
        <div className="bg-muted/30 rounded p-3 text-[11px] text-foreground space-y-1">
          <p><strong>Local aggressiveness composite</strong> = (P(ECE) + P(SVI) + P(PSM)) / 3</p>
          <p><strong>Without LNI:</strong> COMPASS_Score = 0.6 × Local + 0.4 × P(Upgrade)</p>
          <p><strong>With LNI:</strong> COMPASS_Score = 0.4 × Local + 0.3 × P(Upgrade) + 0.3 × P(LNI)</p>
        </div>
      </section>

      <section>
        <H2>Risk Tier Criteria</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Tier</Th><Th>Criteria</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Low", "Local composite < 0.10 AND P(Upgrade) < 0.10", "text-emerald-500"],
              ["High", "≥2 of {Local ≥ 0.30, P(Upgrade) ≥ 0.30, P(LNI) ≥ 0.10}, OR P(SVI) ≥ 0.30, OR P(LNI) ≥ 0.20", "text-red-400"],
              ["Intermediate", "Neither Low nor High", "text-amber-400"],
            ].map(([tier, criteria, cls]) => (
              <tr key={tier} className="border-b border-border/40">
                <Td className={`font-semibold ${cls}`}>{tier}</Td><Td>{criteria}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>Risk Tier Outcomes</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Tier</Th><Th>N (%)</Th><Th>ECE+</Th><Th>SVI+</Th><Th>Upgrade</Th><Th>PSM+</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Low", "717 (22.9%)", "8.8%", "1.5%", "4.0%", "12.1%", "text-emerald-500"],
              ["Intermediate", "2,258 (72.0%)", "23.2%", "5.6%", "15.9%", "15.9%", "text-amber-400"],
              ["High", "159 (5.1%)", "73.0%", "45.3%", "22.0%", "28.9%", "text-red-400"],
            ].map(([tier, n, ece, svi, up, psm, cls]) => (
              <tr key={tier} className="border-b border-border/40">
                <Td className={`font-semibold ${cls}`}>{tier}</Td>
                <Td className="tabular-nums">{n}</Td>
                <Td className="tabular-nums">{ece}</Td><Td className="tabular-nums">{svi}</Td>
                <Td className="tabular-nums">{up}</Td><Td className="tabular-nums">{psm}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>COMPASS-High (5.1% of cohort): 73% ECE+, 45% SVI+, 29% PSM+ — 8-fold ECE and 30-fold SVI risk vs Low tier.</Note>
      </section>

      <section>
        <H2>Decision-Specific Recommendations</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Decision</Th><Th>Threshold</Th><Th>Sens</Th><Th>Spec</Th><Th>PPV</Th><Th>NPV</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Nerve-sparing (per side)", "P(ECE) ≥ 0.30", "55.7%", "82.8%", "48.3%", "86.6%"],
              ["Wide SV resection", "P(SVI) ≥ 0.20", "44.8%", "95.7%", "42.9%", "96.0%"],
              ["AS candidacy caution", "P(Upgrade) ≥ 0.30", "56.6%", "92.8%", "55.1%", "93.2%"],
              ["Margin warning", "P(PSM) ≥ 0.20", "33.0%", "84.6%", "28.4%", "87.2%"],
              ["PLND recommendation", "P(LNI) ≥ 0.05 (NCCN)", "70.8%", "80.8%", "14.2%", "98.4%"],
            ].map(([dec, thr, sens, spec, ppv, npv]) => (
              <tr key={dec} className="border-b border-border/40">
                <Td className="text-foreground font-medium">{dec}</Td>
                <Td className="tabular-nums">{thr}</Td>
                <Td className="tabular-nums">{sens}</Td><Td className="tabular-nums">{spec}</Td>
                <Td className="tabular-nums">{ppv}</Td><Td className="tabular-nums">{npv}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>COMPASS vs NCCN Risk Tier AUC</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Outcome</Th><Th>COMPASS Tier AUC</Th><Th>NCCN Tier AUC</Th><Th>Δ</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["ECE+", "0.642", "0.606", "+0.036"],
              ["SVI+", "0.710", "0.653", "+0.057"],
              ["Upgrade", "0.602", "0.349", "+0.253 (NCCN inverts)"],
              ["PSM+", "0.549", "0.541", "+0.008"],
            ].map(([out, compass, nccn, delta]) => (
              <tr key={out} className="border-b border-border/40">
                <Td className="text-foreground">{out}</Td>
                <Td className="tabular-nums">{compass}</Td>
                <Td className="tabular-nums">{nccn}</Td>
                <Td className={`tabular-nums font-semibold ${out === "Upgrade" ? "text-amber-400" : "text-emerald-500"}`}>{delta}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>COMPASS vs CAPRA Continuous Score</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Outcome</Th><Th>COMPASS</Th><Th>CAPRA</Th><Th>ΔAUC</Th><Th>p-value</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["ECE+", "0.668", "0.674", "−0.006", "0.656 (NS)"],
              ["SVI+", "0.761", "0.723", "+0.038", "0.026"],
              ["Upgrade", "0.770", "0.370", "+0.400", "<0.001"],
              ["PSM+", "0.557", "0.578", "−0.021", "0.209 (NS)"],
            ].map(([out, compass, capra, delta, p]) => (
              <tr key={out} className="border-b border-border/40">
                <Td className="text-foreground">{out}</Td>
                <Td className="tabular-nums">{compass}</Td>
                <Td className="tabular-nums">{capra}</Td>
                <Td className={`tabular-nums font-semibold ${delta?.startsWith("+") ? "text-emerald-500" : "text-amber-400"}`}>{delta}</Td>
                <Td className="tabular-nums">{p}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Honest interpretation: COMPASS comparable to CAPRA for ECE and PSM (NS). Modest superiority for SVI (+0.038, p=0.026). Dramatic outperformance for Grade Upgrade (+0.400, p&lt;0.001) due to CAPRA biopsy-grade inversion.</Note>
      </section>

      <section>
        <H2>Surgical Alerts</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Alert</Th><Th>Trigger</Th><Th>Evidence</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["PSMA+ at Base", "PSMA lesion at base + base ECE ≥ 8%", "43.6% path ECE (N=55)"],
              ["PSMA SVI Positive", "PSMA SVI = Yes", "76.9% path SVI (10/13)"],
              ["Apical ECE", "Apex ECE ≥ 10%", "Apical dissection caution"],
              ["Bladder Neck ECE", "BN ECE ≥ 10%", "Wider BN margin"],
              ["NVB Threatened", "Posterolateral ≥ 15%", "PNVB at risk"],
            ].map(([alert, trigger, evidence]) => (
              <tr key={alert} className="border-b border-border/40">
                <Td className="font-medium text-amber-500">{alert}</Td><Td>{trigger}</Td><Td>{evidence}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>
    </>
  );
}

// ── NS (Nerve-Sparing Supplementary) ────────────────────────────────────────
function NsTab() {
  return (
    <>
      <section>
        <H2>Tewari NS Grade — 4-Grade Anatomical Scale</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Grade</Th><Th>Description</Th><Th>Left N (%)</Th><Th>Right N (%)</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["G1", "Wide athermal — preservation of vascular pedicles + neural hammock", "1,134 (22.7%)", "1,071 (21.4%)"],
              ["G2", "Interfascial — between layers of pelvic fascia", "2,970 (59.4%)", "3,074 (61.5%)"],
              ["G3", "Intrafascial partial — partial sparing only", "830 (16.6%)", "785 (15.7%)"],
              ["G4", "Non-NS — wide resection, no preservation", "66 (1.3%)", "70 (1.4%)"],
            ].map(([g, desc, l, r]) => (
              <tr key={g} className="border-b border-border/40">
                <Td className="font-semibold text-foreground">{g}</Td>
                <Td>{desc}</Td>
                <Td className="tabular-nums">{l}</Td><Td className="tabular-nums">{r}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>N=5,000 patients with bilateral NS grade documented. Cohort for this analysis: N=3,406 with COMPASS ECE prediction; N=3,343 with per-side PSM outcome.</Note>
      </section>

      <section>
        <H2>COMPASS NS Recommendation Thresholds</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>P(ECE)</Th><Th>Recommendation</Th><Th>Rationale</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["< 0.10", "Spare — Wide / Athermal (G1)", "text-emerald-500", "Low ECE risk; full neural hammock preservation"],
              ["0.10 – 0.30", "Cautious spare — Interfascial (G2)", "text-amber-400", "Modest ECE risk; standard of care approach"],
              ["≥ 0.30", "Reduced sparing or Non-NS (G3–4)", "text-red-400", "High ECE risk; aggressive resection for oncologic margin"],
            ].map(([p, rec, cls, rat]) => (
              <tr key={p} className="border-b border-border/40">
                <Td className="tabular-nums font-medium text-foreground">{p}</Td>
                <Td className={`font-medium ${cls}`}>{rec}</Td>
                <Td>{rat}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Spearman ρ = 0.487 (p &lt; 0.001) between P(ECE) and actual NS grade. Binary decision agreement: 79.2% at P(ECE) ≥ 0.10; 76.0% at P(ECE) ≥ 0.30.</Note>
      </section>

      <section>
        <H2>Actual NS Grade by COMPASS Recommendation Tier</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border">
              <Th>COMPASS Recommendation</Th><Th>N</Th><Th>% Bilateral G1</Th><Th>% G2/G1-G2</Th><Th>% Any G3</Th><Th>% Any G4</Th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Spare (G1)", "719", "34.6%", "59.5%", "5.8%", "0.0%"],
              ["Cautious spare (G2)", "1,677", "13.1%", "71.8%", "14.7%", "0.4%"],
              ["Reduced / Non-NS (G3–4)", "1,010", "1.9%", "49.9%", "44.5%", "3.8%"],
            ].map(([rec, n, g1, g2, g3, g4]) => (
              <tr key={rec} className="border-b border-border/40">
                <Td className="text-foreground font-medium">{rec}</Td>
                <Td className="tabular-nums">{n}</Td>
                <Td className="tabular-nums">{g1}</Td><Td className="tabular-nums">{g2}</Td>
                <Td className="tabular-nums">{g3}</Td><Td className="tabular-nums">{g4}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>PSM by NS Grade (Lobe-Level, N=6,686 Lobes)</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>NS Grade</Th><Th>Lobes</Th><Th>PSM+</Th><Th>PSM Rate</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["G1 (wide athermal)", "1,550", "102", "6.6%", "text-emerald-500"],
              ["G2 (interfascial)", "4,059", "329", "8.1%", "text-amber-400"],
              ["G3 (intrafascial partial)", "1,014", "133", "13.1%", "text-orange-400"],
              ["G4 (non-NS)", "63", "18", "28.6%", "text-red-400"],
            ].map(([g, lobes, psm, rate, cls]) => (
              <tr key={g} className="border-b border-border/40">
                <Td className="text-foreground">{g}</Td>
                <Td className="tabular-nums">{lobes}</Td>
                <Td className="tabular-nums">{psm}</Td>
                <Td className={`tabular-nums font-semibold ${cls}`}>{rate}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>PSM rate increases with non-sparing surgery due to confounding — surgeons choose G3–4 for high-risk cases. PSM is a consequence of case selection, not a failure of the NS approach.</Note>
      </section>

      <section>
        <H2>PSM Anatomic Zone Distribution</H2>
        <p className="text-muted-foreground text-[11px] mb-2">N=702 of 710 PSM-positive patients (98.9%) with documented PSM location:</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Zone</Th><Th>PSM+ Cases</Th><Th>% of PSM+</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Posterolateral / lateral / posterior", "338", "48.1%"],
              ["Apex / apical", "175", "24.9%"],
              ["Anterior", "159", "22.6%"],
              ["Bladder neck", "131", "18.7%"],
              ["Base / basal", "69", "9.8%"],
              ["Seminal vesicle", "26", "3.7%"],
            ].map(([zone, n, pct]) => (
              <tr key={zone} className="border-b border-border/40">
                <Td className="text-foreground">{zone}</Td>
                <Td className="tabular-nums">{n}</Td><Td className="tabular-nums">{pct}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>NS Grade → PSM → BCR Consequence Chain</H2>
        <p className="text-muted-foreground text-[11px] mb-2">From 5,003 sides (NS grade) and 442 PSM+ patients with BCR follow-up.</p>
        <Tbl>
          <thead>
            <tr className="border-b border-border">
              <Th>NS Grade</Th><Th>N</Th><Th>PSM Rate</Th><Th>BCR if PSM−</Th><Th>BCR if PSM+</Th><Th>Overall BCR</Th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Grade 1", "706", "11.6%", "3.4%", "3.3%", "3.4%", "text-emerald-500"],
              ["Grade 2", "3,097", "12.0%", "9.2%", "16.0%", "10.2%", "text-amber-400"],
              ["Grade 3", "1,105", "16.7%", "21.6%", "27.6%", "22.7%", "text-red-400"],
            ].map(([g, n, psm, bcrNo, bcrPsm, bcrAll, cls]) => (
              <tr key={g} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{g}</Td>
                <Td className="tabular-nums">{n}</Td><Td className="tabular-nums">{psm}</Td>
                <Td className="tabular-nums">{bcrNo}</Td><Td className="tabular-nums">{bcrPsm}</Td>
                <td className={`py-1 pr-3 font-bold tabular-nums ${cls}`}>{bcrAll}</td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3">
          <div className="mb-1 text-[10px] font-semibold text-muted-foreground">BCR Rate by PSM Location</div>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Location</Th><Th>Grade 1</Th><Th>Grade 2</Th><Th>Grade 3</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Apex", "1/21 → 5%", "15/76 → 20%", "3/20 → 15%"],
                ["Posterolateral (NVB)", "0/6 → 0%", "3/36 → 8%", "2/8 → 25%"],
                ["Posterior", "0/21 → 0%", "19/93 → 20%", "10/36 → 28%"],
                ["Base / Bladder Neck", "0/11 → 0%", "13/57 → 23%", "18/49 → 37%"],
                ["Anterior", "0/12 → 0%", "3/48 → 6%", "4/16 → 25%"],
              ].map(([loc, g1, g2, g3]) => (
                <tr key={loc} className="border-b border-border/40">
                  <Td className="text-foreground">{loc}</Td>
                  <Td className="tabular-nums">{g1}</Td><Td className="tabular-nums">{g2}</Td><Td className="tabular-nums">{g3}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </div>
      </section>

      <section>
        <H2>Bilateral NS Grade Combinations</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Combination</Th><Th>N</Th><Th>PSM Rate</Th><Th>Overall BCR</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["G1/G1 (bilateral full NS)", "707", "11.5%", "3.4%", "text-emerald-500"],
              ["G2/G2 (bilateral interfascial)", "2,435", "12.1%", "10.5%", "text-amber-400"],
              ["G1/G2 (asymmetric)", "376", "10.1%", "10.0%", "text-amber-400"],
              ["G2/G3 (asymmetric)", "240", "10.4%", "21.1%", "text-orange-400"],
              ["G3/G3 (bilateral wide)", "483", "19.9%", "32.1%", "text-red-400"],
            ].map(([combo, n, psm, bcr, cls]) => (
              <tr key={combo} className="border-b border-border/40">
                <Td className="text-foreground">{combo}</Td>
                <Td className="tabular-nums">{n}</Td><Td className="tabular-nums">{psm}</Td>
                <td className={`py-1 pr-3 font-bold tabular-nums ${cls}`}>{bcr}</td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
// ── Sources (surgical-planning & functional-outcome evidence) ──────────────
function SourcesTab() {
  return (
    <>
      <section>
        <H2>Evidence &amp; sources</H2>
        <p className="text-muted-foreground text-[11px] mb-3">
          Every value and decision rule in the surgical-planning, inflammation-risk, healer-tier and
          BCR-by-plan modules, grouped by whether it is COMPASS-data-driven, literature-based, or a
          provisional expert prior. Full bibliography (Mount Sinai / Tewari group first) is at the
          bottom.
        </p>
        <EvidencePanel defaultOpen />
      </section>
    </>
  );
}

export function InfoPanel({ onClose }: InfoPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <Button
        type="button"
        variant="secondary"
        className="fixed right-4 top-4 z-10"
        onClick={onClose}
      >
        Close
      </Button>

      <div className="mx-auto max-w-2xl py-8">
        {/* Tab navigation */}
        <div className="sticky top-0 bg-background pt-1 pb-3 z-10 border-b border-border mb-6">
          <div className="flex flex-wrap gap-1 pr-20">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="space-y-6 text-sm">
          {activeTab === "Overview" && <OverviewTab />}
          {activeTab === "ECE" && <EceTab />}
          {activeTab === "SVI" && <SviTab />}
          {activeTab === "LNI" && <LniTab />}
          {activeTab === "Upgrade" && <UpgradeTab />}
          {activeTab === "PSM" && <PsmTab />}
          {activeTab === "BCR" && <BcrTab />}
          {activeTab === "Score" && <ScoreTab />}
          {activeTab === "NS" && <NsTab />}
          {activeTab === "Sources" && <SourcesTab />}
        </div>

        <VersionFooter />
      </div>
    </div>
  );
}
