export type CompassZoneKey =
  | "1a"
  | "2a"
  | "3a"
  | "4a"
  | "5a"
  | "6a"
  | "1p"
  | "2p"
  | "3p"
  | "4p"
  | "5p"
  | "6p"
  | "7p"
  | "8p"
  | "9p"
  | "10p"
  | "SV-L"
  | "SV-R";

export interface ZoneSources {
  mri: number | null;
  mus: number | null;
  suv: number | null;
  biopsy_gg: number | null;
  core_pct: number | null;
  linear_mm: number | null;
  pct_4_5: number | null;
  cribriform: boolean | null;
}

export interface ZoneData {
  cancer: number;
  ece: number;
  svi: number;
  psm?: number;
  hasData?: boolean;
  sources: ZoneSources;
}

export type ZoneMap = Partial<Record<CompassZoneKey, ZoneData>>;

export interface Prostate3DInputV1 {
  _schema: "prostate-3d-input-v1";
  _shareId?: string;
  patient: {
    age: number | null;
    psa: number | null;
    psa_density?: number | null;
    bmi?: number | null;
    shim?: number | null;
    ipss?: number | null;
    dm?: boolean;
    htn?: boolean;
    cad?: boolean;
    statin?: boolean;
    smoking?: string;
    exercise?: string;
    pfmt?: string;
    alcohol?: string;
    /** postdiagnosis dietary fat pattern — biological-age counseling only, see BIOLOGICAL_AGE_DIET */
    diet?: string;
    pde5?: boolean;
    pde5_plan?: string;
  };
  prostate: {
    volume_cc: number | null;
    dimensions_cm: {
      ap: number;
      transverse: number;
      cc: number;
    } | null;
    median_lobe_grade?: number | null;
  };
  /**
   * Urologic / pelvic history feeding the periprostatic-inflammation
   * ("obliterated planes") risk model. All optional — absent means "not known
   * / not present". Added in schema working-set version 4.
   */
  history?: {
    prior_turp?: boolean;
    prior_urolift?: boolean;
    prior_greenlight?: boolean;
    prior_holep?: boolean;
    prior_rezum?: boolean;
    prior_pelvic_radiation?: boolean;
    urinary_retention?: boolean;
    recurrent_uti?: boolean;
    treated_prostatitis?: boolean;
    biopsy_shows_inflammation?: boolean;
    /** number of separate biopsy sessions, including the current one */
    biopsy_sessions?: number | null;
    crohns?: boolean;
    ulcerative_colitis?: boolean;
    diverticulitis?: boolean;
    pelvic_abscess?: boolean;
    hernia_mesh?: boolean;
    rectal_fistula?: boolean;
    radiation_proctitis?: boolean;
    /** radiologist read of periprostatic inflammation on MRI */
    mri_periprostatic_inflammation?: "none" | "equivocal" | "present";
    mri_periprostatic_fat_stranding?: boolean;
    /** intra-operative inflammation grade 0–3 (Kacie's data) — recorded, not predicted */
    intraop_inflammation_l?: number | null;
    intraop_inflammation_r?: number | null;
    /**
     * Side-specific MRI "plane phenotype" (PIPS-H) — distinct from the whole-
     * gland `mri_periprostatic_inflammation` read above. 0 = normal at every
     * item. Added in schema working-set version 5.
     */
    mri_capsule_interface_l?: number | null;
    mri_capsule_interface_r?: number | null;
    mri_nvb_plane_l?: number | null;
    mri_nvb_plane_r?: number | null;
    mri_post_treatment_distortion_l?: number | null;
    mri_post_treatment_distortion_r?: number | null;
    mri_nonmass_inflammatory_signal_l?: number | null;
    mri_nonmass_inflammatory_signal_r?: number | null;
    /** side-specific fat stranding/fibrotic bands — 0 none, 1 mild, 2 marked. Added in schema working-set version 6 (PIPS-H gap closure). */
    mri_fat_stranding_l?: number | null;
    mri_fat_stranding_r?: number | null;
    /** prior focal/whole-gland ablative therapy, this side — 0 none, 1 ipsilateral focal (IRE/laser/PDT), 2 ipsilateral/whole-gland (HIFU/cryo) */
    prior_focal_ablation_l?: number | null;
    prior_focal_ablation_r?: number | null;
    /** prior bladder surgery, pelvic fracture fixation, urethroplasty, or rectal/LAR/APR surgery at Denonvilliers */
    prior_pelvic_surgery?: "none" | "bladder_fracture_urethroplasty" | "rectal_denonvilliers";
    /** penile prosthesis reservoir in Retzius space */
    penile_prosthesis_reservoir?: "none" | "present" | "prior_infection_or_revision";
    /** prolonged (>=4wk), traumatic, or infected catheterization */
    catheter_prolonged_or_traumatic?: boolean;
    /** transrectal biopsy with complication, or biopsy <6 weeks before surgery */
    biopsy_recent_or_complicated?: boolean;
    /** hs-CRP, mg/L */
    crp?: number | null;
    /** neutrophil-to-lymphocyte ratio */
    nlr?: number | null;
    /** hard-stop gate: active bacterial prostatitis, abscess, fistula, sepsis, or a positive culture with symptoms */
    flag_active_infection?: boolean;
    /** review gate: MRI/PSMA/biopsy/micro-US disagree on side or extent */
    flag_imaging_discordant?: boolean;
    /** confidence gate: MRI degraded by hip hardware or motion artifact */
    flag_mri_artifact?: boolean;
    /** confidence gate: no MRI plane read, no baseline IIEF, or prior operative reports unavailable */
    flag_key_data_missing?: boolean;
  };
  /**
   * Surgeon's editable operative plan. Persisted on the record so it round-trips
   * with the case. `null` NS overrides mean "use the model's recommendation".
   */
  plan?: {
    ns_override_l?: number | null;
    ns_override_r?: number | null;
    /** "auto" = follow the model recommendation */
    hood?: "auto" | "none" | "unilateral" | "bilateral";
    /** null = follow the model recommendation, true/false = surgeon decided */
    bladder_neck_preservation?: boolean | null;
    sv_preservation_l?: boolean | null;
    sv_preservation_r?: boolean | null;
    hydrodissection_l?: boolean | null;
    hydrodissection_r?: boolean | null;
  };
  biopsy: {
    max_grade_group: number | null;
    total_positive_cores: number | null;
    total_cores?: number | null;
    max_core_involvement_pct: number | null;
    max_linear_extent_mm?: number | null;
    max_pct_pattern45?: number | null;
    has_cribriform?: number | null;
    has_idc?: number | null;
    has_pni?: number | null;
    laterality?: "left" | "right" | "bilateral";
    gg_left?: number | null;
    gg_right?: number | null;
    cores_left?: number | null;
    cores_right?: number | null;
    mc_left?: number | null;
    mc_right?: number | null;
    linear_left?: number | null;
    linear_right?: number | null;
    decipher_score?: number | null;
  };
  staging: {
    epe: boolean;
    svi: boolean;
    max_pirads?: number | null;
    max_suv?: number | null;
    lesion_size_cm?: number | null;
    abutment?: number | null;
    adc_mean?: number | null;
    epe_mus?: boolean;
    svi_mus?: boolean;
    psma_epe?: boolean;
    psma_svi?: boolean;
    max_primus?: number | null;
    lymph_nodes_psma?: unknown;
  };
  zones: ZoneMap;
  lesions: import("./lesion").LesionRow[];
  media?: Record<
    string,
    { dataUrl?: string; type?: string; name?: string; size?: number }
  >;
}

export interface ClinicalState {
  age: number;
  bmi: number;
  psa: number;
  vol: number;
  psad: number;
  gg: number;
  cores: number;
  maxcore: number;
  linear_mm: number;
  pct45: number;
  cribriform_bx: number;
  idc_bx: number;
  pni_bx: number;
  bilateral: number;
  laterality: "left" | "right" | "bilateral";
  pirads: number;
  mri_epe: number;
  mri_svi: number;
  primus: number;
  mus_ece: number;
  mus_svi: number;
  psma_avail: number;
  suv: number;
  psma_epe: number;
  psma_svi: number;
  psma_ln: number;
  dec: number | null;
  decipher: string;
  shim: number;
  ipss: number;
  pfmt: string;
  exercise: string;
  smoking: string;
  pde5: string;
  dm: boolean;
  htn: boolean;
  cad: boolean;
  statin: boolean;
  alcohol: string;
  diet: string;
  leftMaxScore: number;
  rightMaxScore: number;
  mri_size: number;
  mri_abutment: number;
  mri_adc: number;
  psma_lesion_count: number;
  psma_multifocal: number;
  psma_at_base: number;
  psma_side: string;
  ev_size: number;
  ev_abutment: number;
  ev_n_lesions: number;
  ev_at_base: number;
  gg_left: number;
  gg_right: number;
  cores_left: number;
  cores_right: number;
  mc_left: number;
  mc_right: number;
  linear_left: number;
  linear_right: number;

  // ── Anatomy / history for the surgical-plan + inflammation-risk models ──
  median_lobe_grade: number;
  prior_turp: boolean;
  prior_urolift: boolean;
  prior_greenlight: boolean;
  prior_holep: boolean;
  prior_rezum: boolean;
  prior_pelvic_radiation: boolean;
  urinary_retention: boolean;
  recurrent_uti: boolean;
  treated_prostatitis: boolean;
  biopsy_shows_inflammation: boolean;
  biopsy_sessions: number;
  crohns: boolean;
  ulcerative_colitis: boolean;
  diverticulitis: boolean;
  pelvic_abscess: boolean;
  hernia_mesh: boolean;
  rectal_fistula: boolean;
  radiation_proctitis: boolean;
  mri_periprostatic_inflammation: "none" | "equivocal" | "present";
  mri_periprostatic_fat_stranding: boolean;
  intraop_inflammation_l: number;
  intraop_inflammation_r: number;
  // Side-specific MRI plane phenotype (PIPS-H) — 0 = normal.
  mri_capsule_interface_l: number;
  mri_capsule_interface_r: number;
  mri_nvb_plane_l: number;
  mri_nvb_plane_r: number;
  mri_post_treatment_distortion_l: number;
  mri_post_treatment_distortion_r: number;
  mri_nonmass_inflammatory_signal_l: number;
  mri_nonmass_inflammatory_signal_r: number;
  mri_fat_stranding_l: number;
  mri_fat_stranding_r: number;
  prior_focal_ablation_l: number;
  prior_focal_ablation_r: number;
  prior_pelvic_surgery: "none" | "bladder_fracture_urethroplasty" | "rectal_denonvilliers";
  penile_prosthesis_reservoir: "none" | "present" | "prior_infection_or_revision";
  catheter_prolonged_or_traumatic: boolean;
  biopsy_recent_or_complicated: boolean;
  crp: number | null;
  nlr: number | null;
  flag_active_infection: boolean;
  flag_imaging_discordant: boolean;
  flag_mri_artifact: boolean;
  flag_key_data_missing: boolean;

  // ── Surgeon's editable operative plan (null / "auto" = follow the model) ──
  plan_ns_override_l: number | null;
  plan_ns_override_r: number | null;
  plan_hood: "auto" | "none" | "unilateral" | "bilateral";
  plan_bnp: boolean | null;
  plan_sv_preservation_l: boolean | null;
  plan_sv_preservation_r: boolean | null;
  plan_hydrodissection_l: boolean | null;
  plan_hydrodissection_r: boolean | null;
}

export function defaultClinicalState(): ClinicalState {
  return {
    age: 64,
    bmi: 27,
    psa: 6.5,
    vol: 45,
    psad: 0.144,
    gg: 2,
    cores: 4,
    maxcore: 40,
    linear_mm: 0,
    pct45: 0,
    cribriform_bx: 0,
    idc_bx: 0,
    pni_bx: 0,
    bilateral: 0,
    laterality: "right",
    pirads: 4,
    mri_epe: 0,
    mri_svi: 0,
    primus: 0,
    mus_ece: 0,
    mus_svi: 0,
    psma_avail: 0,
    suv: 12,
    psma_epe: 0,
    psma_svi: 0,
    psma_ln: 0,
    dec: null,
    decipher: "na",
    shim: 21,
    ipss: 8,
    pfmt: "basic",
    exercise: "moderate",
    smoking: "never",
    pde5: "prn",
    dm: false,
    htn: false,
    cad: false,
    statin: false,
    alcohol: "moderate",
    diet: "average",
    leftMaxScore: 0,
    rightMaxScore: 0,
    mri_size: 0,
    mri_abutment: -1,
    mri_adc: 0,
    psma_lesion_count: 0,
    psma_multifocal: 0,
    psma_at_base: 0,
    psma_side: "none",
    ev_size: 0,
    ev_abutment: 0,
    ev_n_lesions: 0,
    ev_at_base: 0,
    gg_left: 0,
    gg_right: 0,
    cores_left: 0,
    cores_right: 0,
    mc_left: 0,
    mc_right: 0,
    linear_left: 0,
    linear_right: 0,

    median_lobe_grade: 0,
    prior_turp: false,
    prior_urolift: false,
    prior_greenlight: false,
    prior_holep: false,
    prior_rezum: false,
    prior_pelvic_radiation: false,
    urinary_retention: false,
    recurrent_uti: false,
    treated_prostatitis: false,
    biopsy_shows_inflammation: false,
    biopsy_sessions: 1,
    crohns: false,
    ulcerative_colitis: false,
    diverticulitis: false,
    pelvic_abscess: false,
    hernia_mesh: false,
    rectal_fistula: false,
    radiation_proctitis: false,
    mri_periprostatic_inflammation: "none",
    mri_periprostatic_fat_stranding: false,
    intraop_inflammation_l: 0,
    intraop_inflammation_r: 0,
    mri_capsule_interface_l: 0,
    mri_capsule_interface_r: 0,
    mri_nvb_plane_l: 0,
    mri_nvb_plane_r: 0,
    mri_post_treatment_distortion_l: 0,
    mri_post_treatment_distortion_r: 0,
    mri_nonmass_inflammatory_signal_l: 0,
    mri_nonmass_inflammatory_signal_r: 0,
    mri_fat_stranding_l: 0,
    mri_fat_stranding_r: 0,
    prior_focal_ablation_l: 0,
    prior_focal_ablation_r: 0,
    prior_pelvic_surgery: "none",
    penile_prosthesis_reservoir: "none",
    catheter_prolonged_or_traumatic: false,
    biopsy_recent_or_complicated: false,
    crp: null,
    nlr: null,
    flag_active_infection: false,
    flag_imaging_discordant: false,
    flag_mri_artifact: false,
    flag_key_data_missing: false,

    plan_ns_override_l: null,
    plan_ns_override_r: null,
    plan_hood: "auto",
    plan_bnp: null,
    plan_sv_preservation_l: null,
    plan_sv_preservation_r: null,
    plan_hydrodissection_l: null,
    plan_hydrodissection_r: null,
  };
}
