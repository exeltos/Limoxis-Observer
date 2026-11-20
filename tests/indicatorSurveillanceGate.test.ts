import { describe, expect, it } from 'vitest'
import { SURVEILLANCE_INDICATOR_KEYS, indicatorNeedsSurveillance, indicatorsForModules } from '../src/features/indicators/indicatorModules'
import { indicatorDefinitionRows } from '../src/features/indicators/indicatorDemoData'
import { moduleEnabled, profileModules } from '../src/core/organization/operatingProfile'
import { readSource } from './helpers/readSource'

// The shared indicators of production (their key and numerator/denominator metrics) and a hospital-made one.
const production = [
  { indicator_key: 'hai-per-1000', numerator_metric: 'active_surveillance', denominator_metric: 'patient_days' },
  { indicator_key: 'mdr-active-share', numerator_metric: 'resistant_active_surveillance', denominator_metric: 'active_surveillance' },
  { indicator_key: 'mdr-isolation-new-cases', numerator_metric: 'mdr_isolation_total', denominator_metric: null },
  { indicator_key: 'mdr-isolation-klebsiella', numerator_metric: 'mdr_isolation_klebsiella', denominator_metric: null },
  { indicator_key: 'clabsi-per-1000-cvc-days', numerator_metric: 'clabsi_events', denominator_metric: 'central_line_days' },
  { indicator_key: 'cauti-per-1000-catheter-days', numerator_metric: 'cauti_events', denominator_metric: 'urinary_catheter_days' },
  { indicator_key: 'vap-per-1000-ventilator-days', numerator_metric: 'vap_events', denominator_metric: 'ventilator_days' },
  { indicator_key: 'ssi-rate', numerator_metric: 'ssi_episodes', denominator_metric: 'patient_days' },
  { indicator_key: 'bacteremia-incidence-rate', numerator_metric: 'bacteremia_total', denominator_metric: 'patient_days' },
  { indicator_key: 'bacteremia-ecoli-rate', numerator_metric: 'bacteremia_ecoli', denominator_metric: 'patient_days' },
  { indicator_key: 'mdro-bsi-per-1000-patient-days', numerator_metric: 'mdro_bsi', denominator_metric: 'patient_days' },
  { indicator_key: 'amr-klebsiella-meropenem-rate', numerator_metric: 'amr_resistant_klebsiella', denominator_metric: 'amr_tested_klebsiella' },
  { indicator_key: 'hh-compliance', numerator_metric: 'hh_compliant_actions', denominator_metric: 'hh_opportunities' },
  { indicator_key: 'hai-prevalence-pps', numerator_metric: 'pps_patients_with_hai', denominator_metric: 'pps_patients_total' },
  { indicator_key: 'my-icu-clabsi', numerator_metric: 'clabsi_events', denominator_metric: 'central_line_days' },
]
const keys = (list: { indicator_key?: string | null }[]) => list.map(item => item.indicator_key)
const noSurveillance = { operating_profile: 'custom', enabled_modules: profileModules('surveillance').filter(module => module !== 'surveillance') }
const full = { operating_profile: 'full' }
const enabledFor = (organization: object) => (module: string) => moduleEnabled(organization, module)

describe('indicators that need the Surveillance module', () => {
  it('marks the surveillance indicators by key, also by key alone', () => {
    for (const key of ['hai-per-1000', 'mdr-active-share', 'mdr-isolation-new-cases', 'mdr-isolation-acinetobacter', 'mdr-isolation-saureus', 'clabsi-per-1000-cvc-days', 'cauti-per-1000-catheter-days', 'vap-per-1000-ventilator-days', 'ssi-rate', 'clabsi-rate-le750', 'clabsi-rate-gt2500'])
      expect(indicatorNeedsSurveillance(key), key).toBe(true)
    expect(SURVEILLANCE_INDICATOR_KEYS).toContain('hai-per-1000')
  })
  it('keeps the laboratory, patient-day and other indicators', () => {
    for (const key of ['bacteremia-incidence-rate', 'bacteremia-saureus-rate', 'mdro-bsi-per-1000-patient-days', 'mdro-bsi-rate', 'amr-ecoli-ceftriaxone-rate', 'amr-enterococcus-vancomycin-rate', 'hh-compliance', 'who-aware-access-share', 'hai-prevalence-pps', 'patient-falls-per-1000-patient-days', ''])
      expect(indicatorNeedsSurveillance(key), key).toBe(false)
    expect(indicatorNeedsSurveillance(null)).toBe(false)
  })
  it('marks a hospital-made indicator computed from surveillance metrics', () => {
    expect(indicatorNeedsSurveillance({ indicator_key: 'my-icu-clabsi', numerator_metric: 'clabsi_events' })).toBe(true)
    expect(indicatorNeedsSurveillance({ id: 'x', numerator: 'bacteremia_total', denominator: 'patient_days' })).toBe(false)
    // A Management definition: id is the row's id, key the indicator's key.
    expect(indicatorNeedsSurveillance({ id: '7d1f', key: 'vap-per-1000-ventilator-days' })).toBe(true)
  })
})

describe('the indicator list of a hospital without Surveillance', () => {
  it('hides clabsi, hai-per-1000 and mdr-isolation-* and keeps bacteremia and amr-*', () => {
    const shown = keys(indicatorsForModules(production, enabledFor(noSurveillance)))
    for (const hidden of ['hai-per-1000', 'mdr-active-share', 'mdr-isolation-new-cases', 'mdr-isolation-klebsiella', 'clabsi-per-1000-cvc-days', 'cauti-per-1000-catheter-days', 'vap-per-1000-ventilator-days', 'ssi-rate', 'my-icu-clabsi'])
      expect(shown).not.toContain(hidden)
    expect(shown).toEqual(['bacteremia-incidence-rate', 'bacteremia-ecoli-rate', 'mdro-bsi-per-1000-patient-days', 'amr-klebsiella-meropenem-rate', 'hh-compliance', 'hai-prevalence-pps'])
  })
  it('a full hospital, and a screen without a tenant, sees every indicator', () => {
    expect(indicatorsForModules(production, enabledFor(full))).toEqual(production)
    expect(indicatorsForModules(production)).toEqual(production)
    expect(indicatorsForModules(indicatorDefinitionRows, enabledFor(full))).toHaveLength(indicatorDefinitionRows.length)
  })
  it('the demo catalogue keeps its laboratory indicators without Surveillance', () => {
    const shown = keys(indicatorsForModules(indicatorDefinitionRows, enabledFor(noSurveillance)))
    expect(shown).toContain('bacteremia-incidence-rate')
    expect(shown.filter(key => /^amr-.*-rate$/.test(String(key))).length).toBe(8)
    expect(shown).not.toContain('clabsi-rate')
    expect(shown).not.toContain('clabsi-rate-bw751-1000')
  })
})

describe('every list of indicators applies the filter', () => {
  it('the screens read the tenant modules', () => {
    const page = readSource('src/features/indicators/IndicatorsPage.tsx')
    expect(page).toContain('indicatorsForModules(shownDefs')
    expect(page).toContain("t('indicatorsRecords.surveillanceIndicatorsHidden')")
    for (const file of ['src/features/management/IndicatorsPanel.tsx', 'src/features/committees/CommitteeRecordDialogs.tsx', 'src/features/quality/review/QualityObjectives.tsx', 'src/features/quality/risk/riskIndicators.ts', 'src/features/analysis/infectionReport.ts'])
      expect(readSource(file), file).toContain('indicatorsForModules(')
    expect(readSource('src/features/executive/ExecutiveDashboardPage.tsx')).toContain('loadInfectionReportRows(organizationId,year,moduleEnabled)')
  })
})
