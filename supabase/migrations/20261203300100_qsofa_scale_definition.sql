-- N3 · qSOFA as a governed clinical scale of the existing scales system
-- (clinical_scale_definitions, scored by src/features/clinical-scales/clinicalScaleEngine.js).
-- One point each: respiratory rate ≥ 22/min, altered mentation (GCS < 15),
-- systolic BP ≤ 100 mmHg. Score 0–3; ≥ 2 = higher risk of poor outcome, a prompt to
-- assess for sepsis (decision support, not a diagnosis). SSC 2021 recommends
-- against qSOFA alone as a single screening tool, so it sits next to NEWS2 and SOFA.
insert into public.clinical_scale_definitions
(scale_key, version, name_el, name_en, category, population, min_age_years, max_age_years, settings, definition, source_authority, source_reference, status)
values (
  'qsofa', 'QSOFA-2016',
  'qSOFA — Γρήγορη εκτίμηση SOFA', 'qSOFA — quick Sequential Organ Failure Assessment',
  'organ_dysfunction', array['adult'], 18, null, array['ward', 'icu', 'ed', 'acute_care'],
  jsonb_build_object('engine', 'deterministic', 'scoringStatus', 'ready', 'engineVersion', '1.0', 'inputPolicy', 'explicit_values_only', 'scoreRange', jsonb_build_array(0, 3), 'threshold', 2, 'decisionSupportOnly', true, 'sourceChecked', '2026-10-20'),
  'Sepsis-3 / Seymour et al.',
  'Seymour CW et al. JAMA 2016;315(8):762–774 · Singer M et al. JAMA 2016;315(8):801–810 · Surviving Sepsis Campaign 2021 (not as a single screening tool)',
  'approved'
)
on conflict (scale_key, version) do nothing;
