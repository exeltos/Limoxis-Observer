import { describe, expect, it } from 'vitest'
import { indicatorTrend, suggestIndicators } from '../src/features/quality/risk/riskIndicators'

const all = [
  'hai-prevalence-pps',
  'hh-compliance',
  'bundle-compliance',
  'clabsi-per-1000-cvc-days',
  'vap-per-1000-ventilator-days',
  'mdro-bsi-rate',
  'mdr-active-share',
  'bacteremia-incidence-rate',
  'patient-falls-per-1000-patient-days',
  'medication-incidents-per-1000-patient-days',
  'antibiotic-ddd-per-100-patient-days',
  'vaccination-coverage',
  'patient-satisfaction',
]

describe('indicators that measure a risk', () => {
  it('proposes only meaningful indicators from the wording of Risk 2025', () => {
    expect(suggestIndicators({ hazard: 'Λοίμωξη αίματος από κεντρικό φλεβικό καθετήρα (CLABSI)' }, all)).toEqual([
      'clabsi-per-1000-cvc-days',
      'bundle-compliance',
      'hh-compliance',
    ])
    expect(suggestIndicators({ hazard: 'Κίνδυνος Διασποράς Λοιμογόνου Παράγοντα (π.χ PAM)', indicator: 'ΔΕΙΚΤΗΣ ΕΕΛ' }, all)).toEqual([
      'mdro-bsi-rate',
      'mdr-active-share',
      'hh-compliance',
    ])
    expect(suggestIndicators({ hazard: 'Πτώση ασθενή', indicator: 'Δείκτης Συμβάντος' }, all)).toEqual(['patient-falls-per-1000-patient-days'])
    expect(suggestIndicators({ hazard: 'Εμφάνιση ανεπιθύμητης ενέργειας λόγω λανθασμένης φαρμακευτικής αγωγής', indicator: 'Δείκτης Συμβάντος' }, all)).toEqual(['medication-incidents-per-1000-patient-days'])
    expect(suggestIndicators({ hazard: 'Μείωση αριθμού ασθενών λόγω μη ικανοποίησης αναγκών και προσδοκιών ενδιαφερομένων μερών' }, all)).toEqual(['patient-satisfaction'])
  })

  it('does not turn the generic Risk 2025 incident label into a KPI by itself', () => {
    expect(suggestIndicators({ hazard: 'Εμφάνιση Πυρκαγιάς', indicator: 'Δείκτης Συμβάντος' }, all)).toEqual([])
    expect(suggestIndicators({ hazard: 'Απώλεια / Κλοπή προσωπικών αντικειμένων', indicator: 'Δείκτης Συμβάντος' }, all)).toEqual([])
  })

  it('proposes only indicators the organization has and leaves out linked ones', () => {
    expect(suggestIndicators({ hazard: 'Πνευμονία σε αναπνευστήρα', indicatorKeys: ['vap-per-1000-ventilator-days'] }, all)).toEqual(['bundle-compliance', 'hh-compliance'])
    expect(suggestIndicators({ hazard: 'Πνευμονία σε αναπνευστήρα' }, ['hh-compliance'])).toEqual(['hh-compliance'])
  })

  it('reads the trend with the direction of the indicator', () => {
    expect(indicatorTrend(1.2, 2.0, 'lower')).toBe('better')
    expect(indicatorTrend(80, 90, 'higher')).toBe('worse')
    expect(indicatorTrend(3, 3, 'lower')).toBe('steady')
    expect(indicatorTrend(3, null, 'lower')).toBe('steady')
  })
})
