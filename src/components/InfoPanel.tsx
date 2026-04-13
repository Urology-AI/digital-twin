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

interface InfoPanelProps {
  onClose: () => void;
}

export function InfoPanel({ onClose }: InfoPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 sm:p-6 backdrop-blur"
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
      <div className="mx-auto max-w-2xl py-8 space-y-6 text-sm">

        {/* ── What Is COMPASS? ── */}
        <section>
          <H2>What Is COMPASS?</H2>
          <p className="text-muted-foreground leading-relaxed">
            COMPASS predicts surgical outcomes for prostate cancer patients by combining clinical data
            with three imaging modalities: MRI, micro-ultrasound (ExactVu), and PSMA PET/CT. It generates
            <strong className="text-foreground"> side-specific nerve-sparing recommendations</strong> and{" "}
            <strong className="text-foreground">zone-level risk heatmaps</strong> for surgical planning.
          </p>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Developed on <strong className="text-foreground">5,352 consecutive RARP patients</strong>. Independently validated on{" "}
            <strong className="text-foreground">815 trimodal imaging patients</strong> (MRI + PSMA PET + ExactVu; 663 with complete data, zero training overlap).
          </p>
        </section>

        {/* ── What It Predicts ── */}
        <section>
          <H2>What It Predicts</H2>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Outcome</Th><Th>What It Means</Th><Th>Full CV</Th><Th>Independent</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["ECE (patient)", "Cancer beyond the capsule", "0.800", "0.761"],
                ["ECE (side-specific)", "Lateralized ECE per side", "0.80", "L 0.71 / R 0.77"],
                ["Focal vs Extensive ECE", "If ECE: focal (<2 HPF) or extensive", "0.70", "—"],
                ["SVI (patient)", "Seminal vesicle invasion", "0.863", "0.874"],
                ["SVI (side-specific)", "Lateralized SVI per side", "0.81", "—"],
                ["Upgrade", "Higher grade on final path", "0.804", "0.830"],
                ["LNI (ePLND-validated)", "Lymph node invasion", "0.879", "0.794"],
                ["BCR", "PSA rising after surgery", "0.733", "0.733"],
                ["PSM", "Positive surgical margins", "0.62", "0.586"],
              ].map(([out, meaning, cv, ind]) => (
                <tr key={out} className="border-b border-border/40">
                  <Td className="font-medium text-foreground">{out}</Td><Td>{meaning}</Td>
                  <Td className="tabular-nums">{cv}</Td><Td className="tabular-nums">{ind}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
          <Note>Full CV: 5-fold cross-validation on full cohort. Independent: trained on non-trimodal, tested on 815 trimodal patients (663 with complete data, zero overlap). SVI and BCR retrained with expanded biopsy (3,306 max core%) + Decipher (1,845 patients). LNI validated on ePLND histopathology (N=644).</Note>
        </section>

        {/* ── ECE Side-Specific Model ── */}
        <section>
          <H2>ECE Side-Specific Model (Lateralized)</H2>
          <p className="text-muted-foreground text-[11px] mb-2">12 variables. Full CV AUC 0.80. Independent: L 0.71 / R 0.77 (N=663). <strong className="text-foreground">Imaging features are lateralized</strong> — PI-RADS, MRI EPE, MUS ECE only apply to the side where the lesion is located.</p>
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
                <tr key={f} className="border-b border-border/40"><Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td></tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── ECE Patient-Level Model ── */}
        <section>
          <H2>ECE Patient-Level Model</H2>
          <p className="text-muted-foreground text-[11px] mb-2">13 variables. Full CV AUC 0.800 (N=2,572). Independent AUC 0.761 (N=663, 227 events).</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Grade Group 3", "+0.53"],
                ["log(PSA Density)", "+0.52"],
                ["Grade Group 4–5", "+0.46"],
                ["MRI SVI", "+0.45"],
                ["Grade Group 2", "+0.35"],
                ["Decipher Available (flag)", "+0.32"],
                ["PI-RADS", "+0.25"],
                ["Max Core %", "+0.23"],
                ["Decipher Score (imputed)", "+0.21"],
                ["ECE Concordance (0–3)", "+0.12"],
                ["Micro-US ECE", "+0.09"],
                ["PSMA EPE", "+0.07"],
                ["MRI EPE", "+0.07"],
              ].map(([f, b]) => (
                <tr key={f} className="border-b border-border/40"><Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td></tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── SVI Patient-Level Model ── */}
        <section>
          <H2>SVI Model (Patient-Level)</H2>
          <p className="text-muted-foreground text-[11px] mb-2">9 variables. Full CV AUC 0.863 (N=2,475). Independent AUC 0.874 (N=611, 59 events). Retrained with max core % (3,306 patients) + Decipher (1,845 patients).</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["MRI SVI", "+0.59"],
                ["Max Core %", "+0.48"],
                ["PI-RADS", "+0.48"],
                ["Grade Group", "+0.43"],
                ["Decipher Available (flag)", "+0.40"],
                ["log(PSA Density)", "+0.32"],
                ["Positive Cores", "+0.11"],
                ["Decipher Score (imputed)", "+0.09"],
                ["MRI EPE", "−0.08"],
              ].map(([f, b]) => (
                <tr key={f} className="border-b border-border/40"><Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td></tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── SVI Side-Specific Model ── */}
        <section>
          <H2>SVI Side-Specific Model (Lateralized)</H2>
          <p className="text-muted-foreground text-[11px] mb-2">10 variables. Full CV AUC 0.81. <strong className="text-foreground">Imaging features are lateralized</strong> — MRI SVI, MRI EPE, PI-RADS, and MUS ECE only apply to the side where the lesion is located.</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Max Core % (ipsilateral)", "+0.42"],
                ["log(PSA Density)", "+0.42"],
                ["Positive Cores (ipsilateral)", "+0.36"],
                ["Grade Group (ipsilateral)", "+0.14"],
                ["MRI SVI (ipsilateral)", "+0.11"],
                ["PI-RADS (ipsilateral)", "+0.11"],
                ["Micro-US ECE (ipsilateral)", "+0.07"],
                ["Bilateral Disease", "+0.06"],
                ["MRI EPE (ipsilateral)", "+0.06"],
                ["PSMA SVI (ipsilateral)", "+0.06"],
              ].map(([f, b]) => (
                <tr key={f} className="border-b border-border/40"><Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td></tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── Focal vs Extensive ECE ── */}
        <section>
          <H2>Focal vs Extensive ECE</H2>
          <p className="text-muted-foreground text-[11px] mb-2">Given ECE is present, predicts focal (&lt;2 HPF) or extensive. AUC 0.70 (N=227 ECE-positive patients).</p>
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
          <div className="mt-2 mb-1 text-[10px] font-semibold text-muted-foreground">Predictors of Extensive ECE</div>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Feature</Th><Th>β</Th><Th>Interpretation</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["log(PSA Density)", "+0.37", "Higher density = more aggressive extension"],
                ["Micro-US ECE", "+0.34", "Strongest — MUS sees capsular detail MRI misses"],
                ["Bilateral Disease", "+0.25", "Bilateral disease = more extensive"],
                ["MRI SVI", "+0.24", "SVI suggests established disease"],
                ["Max Core %", "+0.11", "Higher involvement → more extensive"],
                ["MRI EPE", "−0.07", "MRI detects extensive better → selection bias"],
                ["Linear Extent", "−0.30", "Paradoxical: large low-GG tumors → focal ECE"],
              ].map(([f, b, interp]) => (
                <tr key={f} className="border-b border-border/40">
                  <Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td><Td>{interp}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── Upgrade Model ── */}
        <section>
          <H2>Upgrade Model</H2>
          <p className="text-muted-foreground text-[11px] mb-2">14 variables. Full CV AUC 0.804 (N=2,640). Independent AUC 0.830 (N=662, 72 events). Predicts pathologic grade group higher than biopsy.</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Grade Group (biopsy)", "−1.89"],
                ["PNI", "−0.60"],
                ["Positive Cores", "−0.35"],
                ["PI-RADS", "+0.37"],
                ["SUVmax", "+0.31"],
                ["Cribriform", "−0.27"],
                ["Bilateral Disease", "+0.20"],
                ["MRI SVI", "+0.20"],
                ["Micro-US ECE", "+0.19"],
                ["PSMA EPE", "+0.11"],
                ["PSA Density", "+0.12"],
                ["PSMA LN Positive", "+0.11"],
                ["PSMA SUV ×  PSMA EPE", "+0.11"],
                ["Decipher Score (imputed)", "+0.11"],
              ].map(([f, b]) => (
                <tr key={f} className="border-b border-border/40"><Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td></tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── LNI Model ── */}
        <section>
          <H2>LNI Model (PLND-Validated)</H2>
          <p className="text-muted-foreground text-[11px] mb-2">4 variables. Full CV AUC 0.879 (N=2,854). Independent AUC 0.794 (N=624, 29 events). Validated on ePLND histopathology (N=644).</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["PSMA LN Positive", "+0.53"],
                ["log(PSA + 1)", "+0.46"],
                ["Biopsy Grade Group", "+0.44"],
                ["Prostate Volume", "−0.34"],
              ].map(([f, b]) => (
                <tr key={f} className="border-b border-border/40"><Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td></tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── PLND Decision Module ── */}
        <section>
          <H2>PLND Decision Module</H2>
          <p className="text-muted-foreground text-[11px] mb-2">Based on N=664 consecutive RARP + PLND + PSMA PET patients. Asymmetric decision rule derived from risk-stratified diagnostic accuracy analysis.</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Scenario</Th><Th>LNI Rate</Th><Th>Recommendation</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Non-HR + PSMA LN−", "0%", "Consider omitting PLND (zero false negatives)"],
                ["Non-HR + PSMA LN+", "Low", "Limited PLND (low PPV, most are FP)"],
                ["HR + PSMA LN−", "12%", "Always ePLND (12% occult LNI)"],
                ["HR + PSMA LN+", "Highest", "Always ePLND, high priority"],
              ].map(([sc, lni, rec]) => (
                <tr key={sc} className="border-b border-border/40">
                  <Td className="font-medium text-foreground">{sc}</Td><Td className="tabular-nums">{lni}</Td><Td>{rec}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
          <Note>NCCN High-Risk = GG ≥ 4 or PSA &gt; 20 ng/mL. All 20 false negatives in the full cohort were NCCN high-risk patients.</Note>
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-semibold text-muted-foreground">Station-Specific False Positive Rates (N=82 PSMA LN+ with ePLND histopathology)</div>
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
                    <Td>{station}</Td><Td className={`tabular-nums font-semibold ${cls}`}>{fp}</Td><Td>{note}</Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-semibold text-muted-foreground">SUVmax Interpretation for PSMA LN+</div>
            <Tbl>
              <thead><tr className="border-b border-border"><Th>LN SUVmax</Th><Th>Assessment</Th></tr></thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/40"><Td className="tabular-nums">&lt; 3.5</Td><Td className="text-emerald-500">Likely reactive / false positive</Td></tr>
                <tr className="border-b border-border/40"><Td className="tabular-nums">3.5 – 6.0</Td><Td className="text-amber-500">Indeterminate</Td></tr>
                <tr className="border-b border-border/40"><Td className="tabular-nums">&gt; 6.0</Td><Td className="text-red-500">Likely true positive</Td></tr>
              </tbody>
            </Tbl>
          </div>
        </section>

        {/* ── BCR Model ── */}
        <section>
          <H2>BCR Model</H2>
          <p className="text-muted-foreground text-[11px] mb-2">10 variables. Full CV AUC 0.733 (N=2,105, 268 events). Independent AUC 0.733 (N=425, 47 events). Retrained with 1,845 Decipher patients.</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Grade Group 4–5", "+0.39"],
                ["Decipher Available (flag)", "+0.37"],
                ["Grade Group 3", "+0.29"],
                ["Grade Group 2", "+0.23"],
                ["Decipher Score (imputed)", "+0.23"],
                ["log(PSA Density)", "+0.21"],
                ["PI-RADS", "+0.17"],
                ["ECE Concordance (0–3)", "+0.13"],
                ["MRI SVI", "+0.10"],
                ["Positive Cores", "+0.06"],
              ].map(([f, b]) => (
                <tr key={f} className="border-b border-border/40"><Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td></tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── PSM Model ── */}
        <section>
          <H2>PSM Model</H2>
          <p className="text-muted-foreground text-[11px] mb-2">10 variables. Full CV AUC 0.62. Independent AUC 0.586 (N=663). Limited by intraoperative factors not captured preoperatively.</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Feature</Th><Th>β (standardized)</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Bilateral Disease", "+0.34"],
                ["log(PSA Density)", "+0.28"],
                ["Max Core %", "+0.12"],
                ["PI-RADS", "+0.12"],
                ["Grade Group 2", "+0.09"],
                ["Grade Group 3", "+0.04"],
                ["Positive Cores", "+0.09"],
                ["MRI SVI", "−0.06"],
                ["MRI EPE", "−0.04"],
                ["Prostate Volume", "−0.04"],
              ].map(([f, b]) => (
                <tr key={f} className="border-b border-border/40"><Td className="text-foreground">{f}</Td><Td className="tabular-nums font-mono">{b}</Td></tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── Nerve-Sparing Grades ── */}
        <section>
          <H2>Nerve-Sparing Grades</H2>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Grade</Th><Th>Approach</Th><Th>When Recommended</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Grade 1", "Intrafascial (full preservation)", "Low ECE + SVI risk, no MRI flags"],
                ["Grade 2", "Interfascial (partial preservation)", "Moderate risk"],
                ["Grade 3", "Wide resection (minimal preservation)", "High risk or MRI EPE/SVI positive"],
              ].map(([g, approach, when]) => (
                <tr key={g} className="border-b border-border/40">
                  <Td className="font-medium text-foreground">{g}</Td><Td>{approach}</Td><Td>{when}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── ECE Risk vs Actual Pathology ── */}
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
                  <Td className="tabular-nums">{pred}</Td><Td className="tabular-nums">{actual}</Td><Td>{action}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── NS Grade → PSM → BCR ── */}
        <section>
          <H2>NS Grade → PSM → BCR Consequence Chain</H2>
          <p className="text-muted-foreground text-[11px] mb-2">From 5,003 sides (NS grade) and 442 PSM+ patients with BCR follow-up. The NS grade choice changes whether a PSM actually causes biochemical recurrence.</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border">
                <Th>NS Grade</Th><Th>N</Th><Th>PSM Rate</Th><Th>BCR if PSM−</Th><Th>BCR if PSM+</Th><Th>Overall BCR</Th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["Grade 1", "706", "11.6%", "3.4%", "3.3%", "3.4%", "text-emerald-500"],
                ["Grade 2", "3,097", "12.0%", "9.2%", "16.0%", "10.2%", "text-amber-500"],
                ["Grade 3", "1,105", "16.7%", "21.6%", "27.6%", "22.7%", "text-red-500"],
              ].map(([g, n, psm, bcrNo, bcrPsm, bcrAll, cls]) => (
                <tr key={g} className="border-b border-border/40 text-muted-foreground">
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

        {/* ── Bilateral NS Grade Combinations ── */}
        <section>
          <H2>Bilateral NS Grade Combinations</H2>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Combination</Th><Th>N</Th><Th>PSM Rate</Th><Th>Overall BCR</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["G1/G1 (bilateral full NS)", "707", "11.5%", "3.4%", "text-emerald-500"],
                ["G2/G2 (bilateral partial NS)", "2,435", "12.1%", "10.5%", "text-amber-500"],
                ["G1/G2 (asymmetric)", "376", "10.1%", "10.0%", "text-amber-500"],
                ["G2/G3 (asymmetric)", "240", "10.4%", "21.1%", "text-red-400"],
                ["G3/G3 (bilateral wide)", "483", "19.9%", "32.1%", "text-red-500"],
              ].map(([combo, n, psm, bcr, cls]) => (
                <tr key={combo} className="border-b border-border/40 text-muted-foreground">
                  <Td className="text-foreground">{combo}</Td>
                  <Td className="tabular-nums">{n}</Td><Td className="tabular-nums">{psm}</Td>
                  <td className={`py-1 pr-3 font-bold tabular-nums ${cls}`}>{bcr}</td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── Imaging Detail Variables ── */}
        <section>
          <H2>Imaging Detail Variables</H2>
          <p className="text-muted-foreground text-[11px] mb-2">Three additional MRI-derived variables adjust the ECE prediction when entered via the lesion table:</p>
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

        {/* ── Surgical Alerts ── */}
        <section>
          <H2>Surgical Alerts</H2>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Alert</Th><Th>Trigger</Th><Th>Evidence</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["PSMA+ at Base", "PSMA lesion at base + base ECE ≥8%", "43.6% path ECE (N=55)"],
                ["PSMA SVI Positive", "PSMA SVI = Yes", "76.9% path SVI (10/13)"],
                ["Apical ECE", "Apex ECE ≥10%", "Apical dissection caution"],
                ["Bladder Neck ECE", "BN ECE ≥10%", "Wider BN margin"],
                ["NVB Threatened", "Posterolateral ≥15%", "PNVB at risk"],
              ].map(([alert, trigger, evidence]) => (
                <tr key={alert} className="border-b border-border/40">
                  <Td className="font-medium text-amber-500">{alert}</Td><Td>{trigger}</Td><Td>{evidence}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── Imaging Modality Evidence ── */}
        <section>
          <H2>Imaging Modality Evidence</H2>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Modality</Th><Th>ECE Signal</Th><Th>Key Finding</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["MRI (PI-RADS)", "EPE binary + size + abutment + ADC", "Binary EPE + concordance drives ECE model"],
                ["Micro-US (PRI-MUS)", "ECE binary (β=0.658)", "70.4% path ECE when positive (N=32); binary outperforms PRI-MUS score"],
                ["PSMA PET (SUVmax)", "EPE binary (β=0.554)", "43.6% ECE at base; SUV dose-response 23.5%(<5) → 41.7%(15–25)"],
              ].map(([mod, sig, key]) => (
                <tr key={mod} className="border-b border-border/40">
                  <Td className="font-medium text-foreground">{mod}</Td><Td>{sig}</Td><Td>{key}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── Decipher Genomic Classifier ── */}
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
                  <Td>{risk}</Td><Td className="tabular-nums">{n}</Td><Td className="tabular-nums">{ece}</Td>
                  <Td className="tabular-nums">{svi}</Td><Td className="tabular-nums">{bcr}</Td>
                  <td className="py-1 pr-3 tabular-nums">{lni}</td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── Zone-Level Heatmap ── */}
        <section>
          <H2>Zone-Level Heatmap: csPCa Risk</H2>
          <p className="text-muted-foreground text-[11px] mb-2">The heatmap displays clinically significant prostate cancer (csPCa) risk per zone — the likelihood that each anatomical region harbors disease warranting treatment, not merely any cancer.</p>
          <div className="mb-1 text-[10px] font-semibold text-muted-foreground">csPCa Definition by Guideline</div>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Guideline</Th><Th>Definition</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["AUA/SUO (2023)", "Grade Group ≥ 2 (Gleason ≥ 3+4)"],
                ["NCCN (v5.2025)", "Grade Group ≥ 2, or GG1 with high volume (multiple cores, >50% involvement)"],
                ["EAU (2024)", "ISUP Grade ≥ 2, or any grade with core length >6 mm"],
                ["PI-RADS v2.1", "PI-RADS 3–5 target csPCa detection (GG ≥ 2)"],
              ].map(([g, d]) => (
                <tr key={g} className="border-b border-border/40"><Td className="text-foreground font-medium">{g}</Td><Td>{d}</Td></tr>
              ))}
            </tbody>
          </Tbl>
          <div className="mt-2 mb-1 text-[10px] font-semibold text-muted-foreground">Zone Fusion Sources</div>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Source</Th><Th>Captures</Th><Th>Relevance</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["MRI (PI-RADS)", "Lesion suspicion, anatomy", "PI-RADS 4–5 detect csPCa with ~70–90% PPV"],
                ["Micro-US (PRI-MUS)", "Tissue texture, capsular detail", "PRI-MUS ≥ 3 associated with csPCa"],
                ["PSMA PET (SUVmax)", "Metabolic activity", "Higher SUV correlates with higher GG"],
                ["Biopsy (GG per zone)", "Histological confirmation", "Direct evidence of csPCa at that location"],
              ].map(([src, cap, rel]) => (
                <tr key={src} className="border-b border-border/40">
                  <Td className="text-foreground font-medium">{src}</Td><Td>{cap}</Td><Td>{rel}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </section>

        {/* ── Known Limitations ── */}
        <section>
          <H2>Known Limitations</H2>
          <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
            <li>Single institution (Mount Sinai). External validation in progress.</li>
            <li>PSM depends heavily on surgical technique.</li>
            <li>BCR follow-up is maturing (60% complete).</li>
            <li>Predictions are decision support, not substitutes for clinical judgment.</li>
          </ul>
          <Note>COMPASS v22 · 9 prediction models · Lateralized ECE + SVI + Focal/Extensive ECE · PLND Decision Module (N=664) · Trimodal + Decipher · March 2026 · Mount Sinai Health System</Note>
        </section>

        {/* ── Median Lobe Grading ── */}
        <section>
          <H2>Median Lobe Grading</H2>
          <p className="text-muted-foreground text-[11px] mb-2">The median lobe grade describes intravesical protrusion of the prostate into the bladder. It affects bladder neck dissection approach during RALP.</p>
          <Tbl>
            <thead>
              <tr className="border-b border-border"><Th>Grade</Th><Th>Protrusion</Th><Th>Surgical Impact</Th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[
                ["0", "None", "Standard bladder neck dissection"],
                ["1", "Mild (< 1 cm)", "Minor adjustment, straightforward dissection"],
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

      </div>
    </div>
  );
}
