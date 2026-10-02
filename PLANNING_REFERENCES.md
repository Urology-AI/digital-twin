# Surgical-planning & functional-outcome references

Bibliography for the effect sizes and decision rules in
`src/lib/compass/planningEvidence.ts`. The machine-readable version is
`src/lib/compass/planningReferences.ts`; the app shows it under
**Evidence & sources → Full references** on the Planning and Outcomes tabs.

> ⚠️ **Verification is partial.** Entries carry a `verified` flag in
> `planningReferences.ts`. The **Modifiable-factor grounding** section below was
> checked against the journal record or PubMed, and its effect sizes are quoted
> from the primary papers. The two sections above it were compiled from working
> knowledge and still need checking against PubMed / the DOI, and their numeric
> effect sizes still need to be taken from the primary paper or re-fitted on the
> COMPASS cohort, before any clinical framing.
>
> Separately: a cited paper does **not** mean the coefficient was fitted. The
> functional-outcome nomogram is marked `provisional` in
> `models/surgicalPlanning.json` — "not yet a formally published fitted model".
> The citations say what evidence stands behind a value, not that the value was
> derived from it.

## Mount Sinai / Tewari group

| Key | Citation | Used for |
|---|---|---|
| tewari2011 | Tewari AK, Srivastava A, Huang MW, et al. Anatomical grades of nerve sparing: a risk-stratified approach to neural-hammock sparing during robot-assisted radical prostatectomy. *BJU Int.* 2011;108(6 Pt 2):984-92. | NS grade model; fascial-plane nomenclature; minimal-disease eligibility; NVB anatomy alerts |
| srivastava2013 | Srivastava A, Chopra S, Pham A, et al. Effect of a risk-stratified grade of nerve-sparing technique on early return of continence after robot-assisted laparoscopic radical prostatectomy. *Eur Urol.* 2013;63(3):438-44. | Minimal-disease eligibility; inflammation → grade escalation; functional-outcome nomogram; plan functional deltas |
| tewari2013athermal | Tewari AK, Ali A, Metgud S, et al. Functional outcomes following robotic prostatectomy using athermal, traction-free risk-stratified grades of nerve sparing. *World J Urol.* 2013;31(3):471-80. | Fascial-plane / athermal technique; functional-outcome nomogram |
| tewari2008competing | Tewari A, Rao S, Martinez-Salamanca JI, et al. Cancer control and the preservation of neurovascular tissue: how to meet competing goals during robotic radical prostatectomy. *BJU Int.* 2008;101(8):1013-8. | Inflammation → grade escalation; inflammation-risk framing; hydrodissection |
| tewari2007anatomic | Tewari A, Bigelow K, Rao S, et al. Anatomic restoration technique of continence mechanism and preservation of puboprostatic collar… *Urology.* 2007;69(4):726-31. | Anterior hood candidacy; bladder-neck preservation; plan functional deltas |
| tewari2003anatomy | Tewari A, Peabody JO, Fischer M, et al. An operative and anatomic study to help in nerve sparing during laparoscopic and robotic radical prostatectomy. *Eur Urol.* 2003;43(5):444-54. | Zone dissection-alert thresholds (NVB course) |
| martini2018 | Martini A, Gupta A, Lewis SC, et al. Development and internal validation of a side-specific, multiparametric MRI-based nomogram for the prediction of extracapsular extension of prostate cancer. *BJU Int.* 2018;122(6):1025-1033. | Per-zone NS-grade ECE thresholds; zonal ECE distribution |
| sooriakumaran2014 | Sooriakumaran P, Srivastava A, Shariat SF, et al. A multinational, multi-institutional study comparing positive surgical margin rates among 22393 open, laparoscopic, and robot-assisted radical prostatectomy patients. *Eur Urol.* 2014;66(3):450-6. | Plan effect on positive-margin rate |

## Other landmark references

| Key | Citation | Used for |
|---|---|---|
| rosenberg2020 | Rosenberg JE, Jung JH, Edgerton Z, et al. Retzius-sparing versus standard robot-assisted radical prostatectomy… *Cochrane Database Syst Rev.* 2020;8(8):CD013641. | Anterior hood candidacy; plan functional deltas |
| kowalczyk2011 | Kowalczyk KJ, Huang AC, Hevelone ND, et al. Stepwise approach for nerve sparing without countertraction during RARP: technique and outcomes. *Eur Urol.* 2011;60(3):536-47. | Hydrodissection |
| john2000 | John H, Hauri D. Seminal vesicle-sparing radical prostatectomy: a novel concept to restore early urinary continence. *Urology.* 2000;55(6):820-4. | Seminal-vesicle tip-sparing |
| han2003 | Han M, Partin AW, Zahurak M, et al. Biochemical (PSA) recurrence probability following radical prostatectomy for clinically localized prostate cancer. *J Urol.* 2003;169(2):517-23. | BCR event-timing fractions |
| freedland2005 | Freedland SJ, Humphreys EB, Mangold LA, et al. Risk of prostate cancer-specific mortality following biochemical recurrence after radical prostatectomy. *JAMA.* 2005;294(4):433-9. | BCR event-timing fractions |
| cao2011 | Cao Y, Ma J. Body mass index, prostate cancer-specific mortality, and biochemical recurrence: a systematic review and meta-analysis. *Cancer Prev Res.* 2011;4(4):486-501. | Obesity → BCR risk |
| hofman2020 | Hofman MS, Lawrentschuk N, Francis RJ, et al. PSMA PET-CT in high-risk prostate cancer before curative-intent surgery or radiotherapy (proPSMA)… *Lancet.* 2020;395(10231):1208-1216. | PSMA-at-base ECE rate |
| preisser2019 | Preisser F, et al. Impact of positive surgical margin length and Gleason grade at the margin on biochemical recurrence in patients with organ-confined prostate cancer. *Prostate.* 2019;79(16):1832-1836. | Per-zone thresholds; dissection alerts |
| mandel2016 | Mandel P, Steuber T, Ahyai S, et al. Salvage radical prostatectomy for recurrent prostate cancer: verification of EAU guideline criteria. *BJU Int.* 2016;117(1):55-61. | Inflammation-risk weights (prior pelvic radiation) |
| furman2019sci | Furman D, Campisi J, Verdin E, et al. Chronic inflammation in the etiology of disease across the life span. *Nat Med.* 2019;25(12):1822-1832. | Inflammation-risk weights (systemic CRP/NLR, BMI framing) |
| sotak2025obesity | Soták M, Clark M, Suur BE, Börgeson E. Inflammation and resolution in obesity. *Nat Rev Endocrinol.* 2025;21(1):45-61. | Inflammation-risk weights (BMI framing) |
| hong2010hemorrhage | Hong SK, Kim DS, Lee WK, et al. Significance of postbiopsy hemorrhage observed on preoperative magnetic resonance imaging in performing robot-assisted laparoscopic radical prostatectomy. World J Urol. 2010;28(6):721-6. doi:10.1007/s00345-010-0506-x. | Periprostatic-inflammation risk weights |
| liao2020turp | Liao H, Duan X, Du Y, et al. Radical prostatectomy after previous transurethral resection of the prostate: oncological, surgical and functional outcomes - a meta-analysis. World J Urol. 2020;38(8):1919-1932. doi:10.1007/s00345-019-02986-2. | Periprostatic-inflammation risk weights |
| picozzi2015mesh | Picozzi SC, Ricci C, Bonavina L, et al. Feasibility and outcomes regarding open and laparoscopic radical prostatectomy in patients with previous synthetic mesh inguinal hernia repair: meta-analysis and systematic review of 7,497 patients. World J Urol. 2015;33(1):59-67. doi:10.1007/s00345-014-1282-9. | Periprostatic-inflammation risk weights |
| ribeiro2021salvage | Ribeiro L, Stonier T, Stroman L, et al. Is the toxicity of salvage prostatectomy related to the primary prostate cancer therapy received? J Urol. 2021;205(3):791-799. doi:10.1097/JU.0000000000001382. | Periprostatic-inflammation risk weights |
| villers1993denonvilliers | Villers A, McNeal JE, Freiha FS, Boccon-Gibod L, Stamey TA. Invasion of Denonvilliers' fascia in radical prostatectomy specimens. J Urol. 1993;149(4):793-8. | PIPS-H MRI plane-phenotype weights |
| stephenson2004srp | Stephenson AJ, Scardino PT, Bianco FJ, et al. Morbidity and functional outcomes of salvage radical prostatectomy for locally recurrent prostate cancer after radiation therapy. J Urol. 2004;172(6 Pt 1):2239-43. doi:10.1097/01.ju.0000140960.63108.39. | Periprostatic-inflammation risk weights |
| gotto2010radiation | Gotto GT, Yunis LH, Vora K, et al. Impact of prior prostate radiation on complications after radical prostatectomy. J Urol. 2010;184(1):136-42. doi:10.1016/j.juro.2010.03.031. | Periprostatic-inflammation risk weights |
| tewari2013grades | Tewari AK, Ali A, Metgud S, et al. Functional outcomes following robotic prostatectomy using athermal, traction free risk-stratified grades of nerve sparing. World J Urol. 2013;31(3):471-80. doi:10.1007/s00345-012-1018-7. | PIPS-H MRI plane-phenotype weights |
| hehir2026ari | Hehir CM, Calpin GG, Cullivan O, et al. The role of 5-alpha reductase inhibitors in transurethral resection of the prostate: a meta-analysis of randomised controlled trials. BJU Int. 2026;137(3):430-443. doi:10.1111/bju.70117. | Periprostatic-inflammation risk weights |
| yao2026pelvis | Yao JM, Yuan YY, Yang JQ, et al. Correlation between male pelvic and soft tissue parameters based on three-dimensional reconstruction and the difficulty of robot-assisted radical prostatectomy. World J Urol. 2026;44(1):324. doi:10.1007/s00345-026-06401-5. | Periprostatic-inflammation risk weights |
| alkhanaty2026route | Al-Khanaty A, Sandhu K, Wettstein MS, et al. Positive margin location and prostate biopsy route: a consecutive cohort comparison of transperineal and transrectal techniques. Cancers. 2026;18(5):849. doi:10.3390/cancers18050849. | Periprostatic-inflammation risk weights |
| catanzaro2025ibd | Catanzaro C, Penaranda NR, Marmiroli A, et al. Inflammatory bowel disease vs. adverse in-hospital outcomes after radical prostatectomy. Urol Oncol. 2025. doi:10.1016/j.urolonc.2025.07.032. | Periprostatic-inflammation risk weights |
| ball2015 | Ball MW, et al. Extent of extraprostatic extension independently influences biochemical recurrence-free survival: evidence for further pT3 subclassification. *Urology.* 2015;85(1):161-164. | Zonal ECE distribution |
| ficarra2012 | Ficarra V, Novara G, Ahlering TE, et al. Systematic review and meta-analysis of studies reporting potency rates after robot-assisted radical prostatectomy. *Eur Urol.* 2012;62(3):418-30. | Functional-outcome nomogram (recovery trajectory) |

## Modifiable-factor grounding

One paper per lever in the `MF` table (`src/lib/compass/functionalOutcomes.ts`).
Checked against the journal record or PubMed; effect sizes quoted from the
primary paper. `src/test/surgicalPlanning.test.ts` fails if a coefficient and
its evidence entry drift apart.

| Key | Citation | Used for |
|---|---|---|
| briganti2010ef | Briganti A, Gallina A, Suardi N, et al. Predicting erectile function recovery after bilateral nerve sparing radical prostatectomy: a proposal of a novel preoperative risk stratification. *J Sex Med.* 2010;7(7):2521-31 (N=435). | Age & baseline erectile function; comorbidities |
| wei2018obesity | Wei Y, Wu YP, Lin MY, et al. Impact of obesity on long-term urinary incontinence after radical prostatectomy: a meta-analysis. *Biomed Res Int.* 2018;2018:8279523. | Obesity |
| geng2023pfme | Geng E, Yin S, Yang Y, et al. The effect of perioperative pelvic floor muscle exercise on urinary incontinence after radical prostatectomy: a meta-analysis. *Int Braz J Urol.* 2023;49(4):441-451 (15 RCTs, N=2,178). | Pelvic floor muscle training |
| yu2024pfmtnma | Yu K, Bu F, Jian T, et al. Urinary incontinence rehabilitation after radical prostatectomy: a systematic review and network meta-analysis. *Front Oncol.* 2024;13:1307434 (42 RCTs, N=4,256). | Pelvic floor muscle training |
| gerbild2018pa | Gerbild H, Larsen CM, Graugaard C, Areskoug Josefsson K. Physical activity to improve erectile function: a systematic review of intervention studies. *Sex Med.* 2018;6(2):75-89. | Physical activity |
| montorsi2014reactt | Montorsi F, Brock G, Stolzenburg JU, et al. Effects of tadalafil treatment on erectile function recovery following bilateral nerve-sparing radical prostatectomy (REACTT). *Eur Urol.* 2014;65(3):587-96. | PDE5 inhibitor regimen |
| visscher2025smoking | Visscher J, Bonevski B, O'Callaghan M. The association of smoking with urinary and sexual function recovery following radical prostatectomy. *BJU Int.* 2025;136(4):647-656 (N=2,676). | Smoking (functional recovery) |
| visscher2024smokingmeta | Visscher J, et al. The association of smoking with urinary and sexual function recovery following radical prostatectomy for localized prostate cancer: a systematic review and meta-analysis. *Prostate Cancer Prostatic Dis.* 2024 (9 studies). | Smoking (functional recovery) |
| zhang2025pie | Zhang C, Harper A, Imm KR, et al. Impact of age, marital status, smoking, and alcohol consumption on urinary and sexual function in prostate cancer patients treated with radical prostatectomy. *Urology.* 2025;207:155-161 (PIE study). | Smoking; alcohol |
| arackal2007alcohol | Arackal BS, Benegal V. Prevalence of sexual dysfunction in male subjects with alcohol dependence. *Indian J Psychiatry.* 2007;49(2):109-112 (N=100). | Alcohol |
| wang2018alcohol | Wang X, Zhang Y, Wang X, et al. Alcohol intake and risk of erectile dysfunction: a dose-response meta-analysis of observational studies. *Int J Impot Res.* 2018 (24 studies, N=154,295). | Alcohol |
| bradley2017luts | Bradley CS, Erickson BA, Messersmith EE, et al. Evidence of the impact of diet, fluid intake, caffeine, alcohol and tobacco on lower urinary tract symptoms: a systematic review. *J Urol.* 2017;198(5):1010-20 (LURN). | Alcohol → continence |
| bauer2020diet | Bauer SR, Breyer BN, Stampfer MJ, et al. Association of diet with erectile dysfunction among men in the Health Professionals Follow-up Study. *JAMA Netw Open.* 2020;3(11):e2021701 (N=21,469). | Diet → erectile-function recovery |
| zhang2026diet | Zhang Y, Shanahan MR, Guard HE, et al. Dietary fat intake and mortality among patients with nonmetastatic prostate cancer. *JAMA Netw Open.* 2026;9(9):e2630693. | Biological age — diet years |
| rabbani2009ef | Rabbani F, Schiff J, Piecuch M, et al. Factors predicting preservation of erectile function in men undergoing open radical retropubic prostatectomy. *J Urol.* 2009;181(4):1817-22 (N=1,110). | Comorbidities |
| kimura2026ipss | Kimura N, Yamada Y, Hakozaki Y, et al. Long-term transition of urinary status after robot-assisted radical prostatectomy. *J Robot Surg.* 2026;20:198 (N=243). | Baseline voiding symptoms (IPSS) |
| ficarra2012continence | Ficarra V, Novara G, Rosen RC, et al. Systematic review and meta-analysis of studies reporting urinary continence recovery after robot-assisted radical prostatectomy. *Eur Urol.* 2012;62(3):405-17. | Functional-outcome nomogram (recovery trajectory) |
| bull2020who | Bull FC, Al-Ansari SS, Biddle S, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med.* 2020;54(24):1451-1462. | Activity band definitions |
| niaaa2023levels | NIAAA, *Understanding alcohol drinking patterns*; with the Dietary Guidelines for Americans 2020-2025 definition of moderate drinking. | Alcohol band definitions |
