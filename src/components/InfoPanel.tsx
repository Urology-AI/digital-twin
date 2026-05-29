import { useState } from "react";
import { Button } from "@/components/ui/button";

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

const TABS = ["Overview", "ECE", "SVI", "LNI", "Upgrade", "PSM", "BCR", "Score", "NS"] as const;
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
          Developed on <strong className="text-foreground">3,454 consecutive RARP patients</strong> (ECE/SVI/PSM),
          3,137 for Upgrade, 663 for LNI (PLND dataset), 2,399 for BCR.
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
              ["ECE", "3,454", "882 (25.5%)", "0.797", "0.795", "0.790–0.825", "+25.4%"],
              ["SVI", "3,454", "301 (8.7%)", "0.842", "0.848", "0.839–0.884", "+23.5%"],
              ["Grade Upgrade", "3,137", "422 (13.5%)", "0.807", "0.810", "0.802–0.853", "+27.2%"],
              ["LNI (4-feature)", "663", "35 (5.3%)", "0.842", "0.836", "0.797–0.901", "+5.2%"],
              ["PSM (ceiling)", "3,454", "556 (16.1%)", "0.651", "0.651", "0.658–0.706", "+5.3%"],
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
        <Note>BC AUC = Bootstrap-corrected AUC (Harrell optimism, 500 iterations). BSS = Brier Skill Score vs null model. All models independently verified from raw data 2026-05-03.</Note>
      </section>

      <section>
        <H2>Common 22-Feature Input Set</H2>
        <p className="text-muted-foreground text-[11px] mb-2">ECE, SVI, Upgrade, PSM, and BCR use this identical set. Sparse-coverage features are mean-imputed; Decipher also has an availability flag.</p>
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
        <Note>LNI uses a parsimonious 4-feature subset (see LNI tab). Decipher Available flag β=+0.42 in ECE (third largest predictor).</Note>
      </section>

      <section>
        <H2>LNI Parsimonious 4-Feature Set</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>Definition</Th><Th>Encoding</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["log(PSA Density)", "log(PSA / Prostate Volume cc)", "Continuous"],
              ["GG High (gg_high)", "Biopsy Grade Group 4 or 5", "Binary"],
              ["Positive Cores", "Number of positive biopsy cores", "Continuous"],
              ["PSMA LN Positive", "PSMA PET-positive pelvic lymph nodes (any)", "Binary"],
            ].map(([feat, def, enc]) => (
              <tr key={feat} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{feat}</Td><Td>{def}</Td><Td>{enc}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>4-feature model outperforms 17-feature expansion in the PLND cohort (N=663). Verified independently.</Note>
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
              ["3 — Logistic function", "probability = 1 / (1 + e⁻ˡᵒᵍⁱᵗ)", "ECE is clamped to 2–92%. All other models use the raw sigmoid output."],
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

        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Worked example — ECE patient (GG3, PSA 12, volume 30 cc, PI-RADS 4, MRI EPE+, no Decipher)</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>Value → z-score</Th><Th>× coeff</Th><Th>Contribution</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["log_psad",           "log(12/30+0.01)=−1.304 → +0.443", "× 0.3285", "+0.146"],
              ["grade_group_2",      "0 → −0.812",                       "× 0.4091", "−0.332"],
              ["grade_group_3",      "1 → +1.687",                       "× 0.4912", "+0.829"],
              ["grade_group_4_5",    "0 → −0.561",                       "× 0.5948", "−0.334"],
              ["max_core_pct",       "60 → +0.276",                      "× 0.2019", "+0.056"],
              ["pirads",             "max(4,2)=4 → −0.097",              "× 0.3922", "−0.038"],
              ["mri_epe",            "1 → +2.381",                       "× 0.1399", "+0.333"],
              ["decipher_imputed",   "missing→0.521 → −1.059",           "× 0.2133", "−0.226"],
              ["decipher_available", "0 (missing) → −0.558",             "× 0.4180", "−0.233"],
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
        <Note>intercept −0.7423 + sum of contributions = logit −0.540 → probability 38.0%. Matches pinned regression test in src/test/modelOutputs.test.ts.</Note>
      </section>

      <section>
        <H2>Known Limitations</H2>
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
          <li>Single institution (Mount Sinai). External validation in progress.</li>
          <li>PSM AUC 0.651 reflects irreducible intraoperative variability — confirmed at literature ceiling.</li>
          <li>BCR: median follow-up ~14 months (immature); negative imaging coefficients reflect salvage-therapy informative censoring, not biology.</li>
          <li>Zone-level cohort N=299 with MUS zone data — larger validation needed.</li>
          <li>Decipher coverage 37%; mean imputation + availability flag documented and calibrated.</li>
          <li>Side-specific ECE/SVI predictions use smaller lateralized cohorts (N=228 lobes for ECE, N=227 for SVI).</li>
          <li>Predictions are decision support, not substitutes for clinical judgment.</li>
        </ul>
        <Note>COMPASS v22 · 6 prediction models · Lateralized ECE + SVI · PLND Decision Module · Trimodal + Decipher · Verified 2026-05-03 · Mount Sinai Health System</Note>
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
              ["Cross-validation AUC", "0.797 (SD 0.018)"],
              ["Apparent AUC", "0.803"],
              ["Bootstrap-corrected AUC", "0.795"],
              ["95% CI (1,000 bootstrap)", "0.790–0.825"],
              ["Brier Skill Score", "+25.4%"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>ECE — Locked Coefficients (22 Features)</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th><Th>Magnitude</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Grade Group 4–5", "+0.5948", "Strong"],
              ["Grade Group 3", "+0.4912", "Strong"],
              ["Decipher Available (flag)", "+0.4180", "Strong"],
              ["Grade Group 2", "+0.4091", "Strong"],
              ["PI-RADS", "+0.3922", "Strong"],
              ["log(PSA Density)", "+0.3285", "Strong"],
              ["MRI SVI", "+0.2352", "Moderate"],
              ["Decipher Score (imputed)", "+0.2133", "Moderate"],
              ["Max Core %", "+0.2019", "Moderate"],
              ["MRI EPE", "+0.1399", "Moderate"],
              ["Capsular Abutment", "+0.1371", "Moderate"],
              ["PRI-MUS Score", "+0.0898", "Small"],
              ["Lesion Size (mm)", "+0.0817", "Small"],
              ["Positive Cores", "+0.0642", "Small"],
              ["ADC Mean", "−0.0635", "Small"],
              ["MUS ECE", "+0.0435", "Small"],
              ["Bx PNI", "+0.0383", "Small"],
              ["Bilateral Cores", "+0.0374", "Small"],
              ["PSMA SUVmax", "−0.0274", "Small"],
              ["Bx IDC", "+0.0215", "Small"],
              ["Bx Cribriform", "+0.0178", "Small"],
              ["PSMA EPE", "+0.0062", "Small"],
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
        <H2>ECE — Head-to-Head vs Comparator Nomograms</H2>
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
        <H2>ECE — Confusion Matrices</H2>
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
        <H2>ECE Side-Specific Model (Lateralized)</H2>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Cohort", "159 patients / 228 lobes"],
              ["ECE+ events (lobe-level)", "63 (27.6%)"],
              ["Apparent AUC", "0.813"],
              ["Bootstrap optimism-corrected AUC", "0.785"],
              ["GroupKFold CV AUC (cluster-aware)", "0.765"],
              ["95% CI (cluster bootstrap)", "0.692–0.838"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground">Side-Specific vs Comparators</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Model</Th><Th>AUC</Th><Th>ΔAUC</Th><Th>p-value</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["COMPASS ECE Side-Specific", "0.813", "—", "—", "text-foreground font-semibold"],
              ["Martini 2018 (lateralized)", "0.732", "−0.081", "0.001", ""],
              ["Pedraza 2022 (lateralized)", "0.722", "−0.091", "<0.001", ""],
            ].map(([m, auc, d, p, cls]) => (
              <tr key={m} className={`border-b border-border/40 ${cls}`}>
                <Td>{m}</Td><Td className="tabular-nums">{auc}</Td>
                <Td className="tabular-nums">{d}</Td><Td className="tabular-nums">{p}</Td>
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
              ["Grade Group 4–5 (ipsilateral)", "+0.38"],
              ["log(PSA Density)", "+0.38"],
              ["Grade Group 3 (ipsilateral)", "+0.36"],
              ["Grade Group 2 (ipsilateral)", "+0.26"],
              ["MRI SVI", "+0.20"],
              ["PI-RADS (ipsilateral)", "+0.19"],
              ["Positive Cores (ipsilateral)", "+0.17"],
              ["ECE Concordance (ipsilateral, 0–3)", "+0.15"],
              ["Max Core % (ipsilateral)", "+0.14"],
              ["MUS ECE (ipsilateral)", "+0.11"],
              ["Imaging Ipsilateral (any)", "+0.10"],
              ["PSMA EPE (ipsilateral)", "−0.02"],
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
        <H2>ECE Risk vs Actual Pathology</H2>
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
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N (analytic cohort)", "3,454"],
              ["SVI events", "301 (8.7%)"],
              ["Cross-validation AUC", "0.842 (SD 0.020)"],
              ["Apparent AUC", "0.857"],
              ["Bootstrap-corrected AUC", "0.848"],
              ["95% CI", "0.839–0.884"],
              ["Brier Skill Score", "+23.5%"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>SVI — Locked Coefficients (22 Features)</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th><Th>Magnitude</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Grade Group 4–5", "+0.9954", "Strong"],
              ["Grade Group 2", "+0.7981", "Strong"],
              ["Grade Group 3", "+0.7700", "Strong"],
              ["MRI SVI", "+0.4573", "Strong"],
              ["Max Core %", "+0.3156", "Strong"],
              ["log(PSA Density)", "+0.3139", "Strong"],
              ["Decipher Available (flag)", "+0.3033", "Strong"],
              ["PI-RADS", "+0.2892", "Moderate"],
              ["Decipher Score (imputed)", "+0.2707", "Moderate"],
              ["Bilateral Cores", "+0.1443", "Small"],
              ["Bx IDC", "−0.1211", "Small"],
              ["PRI-MUS Score", "−0.1044", "Small"],
              ["MUS ECE", "+0.0924", "Small"],
              ["Lesion Size (mm)", "+0.0685", "Small"],
              ["MRI EPE", "+0.0614", "Small"],
              ["PSMA SUVmax", "−0.0546", "Small"],
              ["ADC Mean", "+0.0498", "Small"],
              ["PSMA EPE", "+0.0492", "Small"],
              ["Bx PNI", "+0.0476", "Small"],
              ["Bx Cribriform", "+0.0458", "Small"],
              ["Capsular Abutment", "+0.0337", "Small"],
              ["Positive Cores", "+0.0324", "Small"],
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
        <H2>SVI — Head-to-Head vs Comparators</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Model</Th><Th>AUC (95% CI)</Th><Th>ΔAUC vs COMPASS</Th><Th>p-value</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["COMPASS SVI (22 features)", "0.842 (0.839–0.884)", "—", "—", "text-foreground font-semibold"],
              ["Gandaglia-style refit", "0.797 (0.772–0.821)", "−0.045", "0.001", ""],
              ["Briganti-style refit", "0.776 (0.751–0.802)", "−0.066", "<0.001", ""],
              ["Koh 2003 (exact published OR)", "0.756 (0.730–0.781)", "−0.086", "<0.001", ""],
              ["MSKCC SVI (exact, hybrid DRE)", "0.745 (0.715–0.773)", "−0.101 (9.7 pts)", "<0.001", ""],
            ].map(([m, auc, d, p, cls]) => (
              <tr key={m} className={`border-b border-border/40 ${cls}`}>
                <Td>{m}</Td><Td className="tabular-nums">{auc}</Td>
                <Td className="tabular-nums">{d}</Td><Td className="tabular-nums">{p}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>9.7-AUC point advantage over MSKCC driven by MRI SVI (β=+0.46), MUS features, max core %, and Decipher integration.</Note>
      </section>

      <section>
        <H2>SVI Side-Specific — Why No New Model</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Issue</Th><Th>Detail</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Cohort", "158 patients / 227 lobes / 24 SVI+ events"],
              ["Event prevalence", "10.6% lobe-level"],
              ["EPV requirement", "≥10 events per variable"],
              ["Max features supportable", "2–3 features (24 ÷ 10 ≈ 2.4)"],
              ["Decision", "Apply patient-level model to lobes; no new side-specific model fitted"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td>{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 mb-1 text-[10px] font-semibold text-muted-foreground">Head-to-Head AUC — Patient-Level Model Applied to Lobes</div>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Model</Th><Th>AUC (95% CI)</Th><Th>ΔAUC</Th><Th>p-value</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["COMPASS patient-level (applied to lobes)", "0.853 (0.766–0.929)", "—", "—", "text-foreground font-semibold"],
              ["Koh 2003 (exact)", "0.756 (0.652–0.846)", "−0.097", "0.004", ""],
              ["MSKCC SVI (exact, hybrid DRE)", "0.714 (0.618–0.799)", "−0.139", "0.001", ""],
              ["Parsimonious refit (log_PSAD + GG4-5)", "0.685 (0.550–0.794)", "−0.168", "0.001", ""],
              ["MRI SVI alone", "0.641 (0.553–0.738)", "−0.212", "<0.001", ""],
            ].map(([m, auc, d, p, cls]) => (
              <tr key={m} className={`border-b border-border/40 ${cls}`}>
                <Td>{m}</Td><Td className="tabular-nums">{auc}</Td>
                <Td className="tabular-nums">{d}</Td><Td className="tabular-nums">{p}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>When SVI is suspected, surgical strategy (non-NS, wide resection) is typically applied bilaterally regardless of laterality — limiting clinical impact of side-specific SVI prediction.</Note>
      </section>
    </>
  );
}

// ── LNI (LNI Supplementary) ─────────────────────────────────────────────────
function LniTab() {
  return (
    <>
      <section>
        <H2>LNI Parsimonious 4-Feature Model</H2>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N (PLND cohort)", "663"],
              ["LN+ events", "35 (5.3%)"],
              ["5-fold CV AUC", "0.842"],
              ["Bootstrap-corrected AUC", "0.836"],
              ["95% CI", "0.797–0.901"],
              ["Brier Skill Score", "+5.2%"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>LNI — Locked Coefficients</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>Definition</Th><Th>β (standardized)</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["log(PSA Density)", "log(PSA / Prostate Volume)", "+0.5623"],
              ["PSMA LN Positive", "Any pelvic PSMA PET-positive LN (binary)", "+0.5437"],
              ["Grade Group High", "Biopsy GG 4 or 5 (binary)", "+0.4162"],
              ["Positive Cores", "Number of positive biopsy cores", "+0.1260"],
            ].map(([f, def, b]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{f}</Td>
                <Td>{def}</Td>
                <Td className="tabular-nums font-mono">{b}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>4-feature model verified to outperform 17-feature expansion (0.842 vs 0.769). PSMA LN positive and log PSAD are the two dominant predictors.</Note>
      </section>

      <section>
        <H2>LNI — Head-to-Head vs Comparators</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Model</Th><Th>AUC (95% CI)</Th><Th>ΔAUC</Th><Th>p-value</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["COMPASS LNI (4 features)", "0.842 (0.797–0.901)", "—", "—", "text-foreground font-semibold"],
              ["MSKCC LNI (exact, hybrid DRE)", "0.794 (0.715–0.864)", "−0.048", "0.133 (NS)", ""],
              ["Memorial-style refit", "0.789 (0.718–0.851)", "−0.053", "0.047", ""],
              ["Gandaglia 2019 (exact, hybrid DRE)", "0.766 (0.684–0.838)", "−0.076", "0.023", ""],
              ["NCCN binary (high vs not)", "0.722 (0.654–0.783)", "−0.120", "0.001", ""],
              ["Briganti 2012 (exact, hybrid DRE)", "0.718 (0.633–0.796)", "−0.124", "<0.001", ""],
              ["PSMA LN+ alone", "0.657 (0.577–0.743)", "−0.185", "<0.001", ""],
              ["PI-RADS alone", "0.586 (0.492–0.675)", "−0.256", "<0.001", ""],
            ].map(([m, auc, d, p, cls]) => (
              <tr key={m} className={`border-b border-border/40 ${cls}`}>
                <Td>{m}</Td><Td className="tabular-nums">{auc}</Td>
                <Td className="tabular-nums">{d}</Td><Td className="tabular-nums">{p}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>COMPASS vs MSKCC p=0.133 (NS) — likely reflects power limitation (35 events) rather than equivalent performance. COMPASS still numerically superior by 4.8 AUC points.</Note>
      </section>

      <section>
        <H2>LNI — Confusion Matrices at Clinical Thresholds</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Threshold</Th><Th>Sensitivity</Th><Th>Specificity</Th><Th>PPV</Th><Th>NPV</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["0.05 (NCCN-style)", "77.1%", "75.6%", "15.0%", "98.3%"],
              ["0.07", "54.3%", "83.4%", "15.4%", "97.0%"],
              ["0.10 (EAU-style)", "48.6%", "89.6%", "20.7%", "96.9%"],
            ].map(([t, sens, spec, ppv, npv]) => (
              <tr key={t} className="border-b border-border/40">
                <Td className="tabular-nums text-foreground font-medium">{t}</Td>
                <Td className="tabular-nums">{sens}</Td><Td className="tabular-nums">{spec}</Td>
                <Td className="tabular-nums">{ppv}</Td><Td className="tabular-nums">{npv}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
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
        <H2>Grade Upgrade Model — Option A (Primary)</H2>
        <p className="text-muted-foreground text-[11px] mb-2">Endpoint: any pathologic grade group higher than biopsy grade group. Full GG1–GG4 cohort.</p>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N", "3,137"],
              ["Upgrade events", "422 (13.5%)"],
              ["Cross-validation AUC", "0.807 (SD 0.022)"],
              ["Bootstrap-corrected AUC", "0.810"],
              ["95% CI", "0.802–0.853"],
              ["Brier Skill Score", "+27.2%"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>Upgrade — Locked Coefficients (22 Features)</H2>
        <p className="text-muted-foreground text-[11px] mb-2">
          <strong className="text-amber-400">Critical observation:</strong> Biopsy Grade Group has STRONG NEGATIVE coefficients — patients with biopsy GG1 have the most "upgrade headroom" while GG3–4 patients have less. This is the source of the "NCCN inversion" for upgrade prediction.
        </p>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th><Th>Magnitude</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Grade Group 3", "−1.6370", "Strong (negative)"],
              ["Grade Group 2", "−1.4920", "Strong (negative)"],
              ["Grade Group 4–5", "−1.1417", "Strong (negative)"],
              ["PI-RADS", "+0.2587", "Moderate"],
              ["Decipher Score (imputed)", "+0.2554", "Moderate"],
              ["MUS ECE", "−0.2267", "Moderate"],
              ["Decipher Available (flag)", "+0.2133", "Moderate"],
              ["log(PSA Density)", "+0.1976", "Moderate"],
              ["MRI SVI", "+0.1484", "Small"],
              ["ADC Mean", "−0.1386", "Small"],
              ["Positive Cores", "−0.1070", "Small"],
              ["Bx PNI", "−0.0814", "Small"],
              ["PRI-MUS Score", "+0.0544", "Small"],
              ["PSMA EPE", "+0.0504", "Small"],
              ["Bx Cribriform", "+0.0418", "Small"],
              ["Bx IDC", "−0.0324", "Small"],
              ["PSMA SUVmax", "+0.0272", "Small"],
              ["Bilateral Cores", "+0.0223", "Small"],
              ["Lesion Size (mm)", "+0.0151", "Small"],
              ["Capsular Abutment", "+0.0082", "Small"],
              ["MRI EPE", "−0.0064", "Small"],
              ["Max Core %", "−0.0032", "Small"],
            ].map(([f, b, mag]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td>
                <Td className={`tabular-nums font-mono ${b.startsWith("−") ? "text-amber-400" : ""}`}>{b}</Td>
                <Td className="text-muted-foreground">{mag}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </section>

      <section>
        <H2>Upgrade — Option B (Sensitivity Analysis)</H2>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Item</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Cohort", "N ≈ 1,885 (AS-eligible: biopsy GG1 or GG2)"],
              ["Endpoint", "Pathologic GG ≥ 3 vs biopsy GG1–2"],
              ["Upgrade events", "341"],
              ["CV AUC", "0.812"],
              ["Use case", "Active surveillance candidacy screening"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td>{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Option B is a sensitivity analysis. Option A (GG1–4 full cohort) is the primary locked model.</Note>
      </section>
    </>
  );
}

// ── PSM (PSM Side-Specific Supplementary) ───────────────────────────────────
function PsmTab() {
  return (
    <>
      <section>
        <H2>PSM Patient-Level — Literature Ceiling</H2>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["N", "3,454"],
              ["PSM events", "556 (16.1%)"],
              ["CV AUC", "0.651 (SD 0.022)"],
              ["Bootstrap-corrected AUC", "0.651"],
              ["95% CI", "0.658–0.706"],
              ["Brier Skill Score", "+5.3%"],
              ["Status", "Confirmed at literature ceiling"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>AUC 0.651 reflects irreducible intraoperative variability not captured preoperatively (surgeon technique, frozen section decisions, tissue handling). Consistent with published literature range of 0.58–0.68.</Note>
      </section>

      <section>
        <H2>PSM — Locked Coefficients (22 Features)</H2>
        <Tbl>
          <thead>
            <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              ["Lesion Size (mm)", "+0.2260"],
              ["log(PSA Density)", "+0.2844"],
              ["Grade Group 2", "+0.1812"],
              ["Decipher Available (flag)", "+0.3056"],
              ["Grade Group 3", "+0.1188"],
              ["Bilateral Cores", "+0.1002"],
              ["PSMA SUVmax", "+0.1003"],
              ["Positive Cores", "+0.0521"],
              ["Grade Group 4–5", "+0.0400"],
              ["Max Core %", "+0.0109"],
              ["Bx IDC", "+0.0282"],
              ["MUS ECE", "+0.0945"],
              ["MRI SVI", "+0.0542"],
              ["Capsular Abutment", "+0.0052"],
              ["PI-RADS", "+0.0099"],
              ["ADC Mean", "−0.0672"],
              ["MRI EPE", "−0.0287"],
              ["Decipher Score (imputed)", "−0.0038"],
              ["Bx PNI", "−0.0528"],
              ["Bx Cribriform", "−0.0300"],
              ["PRI-MUS Score", "−0.0196"],
              ["PSMA EPE", "−0.7073"],
            ].map(([f, b]) => (
              <tr key={f} className="border-b border-border/40">
                <Td className="text-foreground">{f}</Td>
                <Td className={`tabular-nums font-mono ${b.startsWith("−") ? "text-amber-400" : ""}`}>{b}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>PSMA EPE β=−0.71 (largest absolute coefficient): PSMA EPE+ patients receive wider resection intraoperatively, reducing PSM. This reflects the clinical decision chain, not a protective biological effect.</Note>
      </section>

      <section>
        <H2>PSM Strategic Reframing</H2>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Rather than predicting PSM as an independent endpoint, COMPASS reframes PSM as a{" "}
          <strong className="text-foreground">consequence within the nerve-sparing decision framework</strong>.
          The relevant clinical question is not "will this patient have a PSM" but rather:{" "}
          <strong className="text-foreground">"GIVEN the planned NS approach, what is the residual PSM risk and where will it occur?"</strong>
        </p>
        <p className="text-muted-foreground text-[11px] mt-2 leading-relaxed">
          PSM risk is therefore best interpreted as a zone-level warning signal rather than an independent prediction — informing decisions about margin width at specific anatomic locations.
        </p>
      </section>

      <section>
        <H2>PSM Side-Specific Model</H2>
        <Tbl>
          <thead><tr className="border-b border-border"><Th>Metric</Th><Th>Value</Th></tr></thead>
          <tbody className="text-muted-foreground">
            {[
              ["Lobes (observations)", "6,818"],
              ["Patients", "3,409"],
              ["PSM+ events (lobe-level)", "590 (8.7%)"],
              ["Laterality parsing", "86% of PSM+ events with parseable laterality"],
              ["5-fold CV AUC", "0.664"],
              ["GroupKFold CV AUC (cluster-aware)", "0.653"],
              ["Apparent AUC", "0.666"],
              ["95% CI", "0.640–0.685"],
              ["Brier Skill Score", "+3.8%"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <Td className="font-medium text-foreground">{k}</Td><Td className="tabular-nums">{v}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        <Note>Side-specific PSM AUC 0.664 modestly exceeds patient-level 0.651 (+0.013). Lateralized features provide incremental signal, but dominant determinants remain surgical/intraoperative.</Note>
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
              ["P(ECE)", "22-feature L2 logistic", "3,454 / 25.5%", "0.797"],
              ["P(SVI)", "22-feature L2 logistic", "3,454 / 8.7%", "0.842"],
              ["P(Upgrade)", "22-feature L2 logistic (GG1–4)", "3,137 / 13.5%", "0.807"],
              ["P(PSM)", "22-feature L2 logistic", "3,454 / 16.1%", "0.651 (ceiling)"],
              ["P(LNI)", "4-feature parsimonious with PSMA", "663 / 5.3%", "0.842"],
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
                <Td className={`tabular-nums font-semibold ${delta.startsWith("+") ? "text-emerald-500" : "text-amber-400"}`}>{delta}</Td>
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
        </div>
      </div>
    </div>
  );
}
