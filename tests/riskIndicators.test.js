import { describe, expect, it } from 'vitest'
import { indicatorTrend, suggestIndicators } from '../src/features/quality/risk/riskIndicators'

const all = ['hai-prevalence-pps', 'who-hh', 'clabsi-rate', 'cauti-rate', 'vap-rate', 'mdr-introduction-index', 'mdro-bsi-per-1000', 'open-high-incidents']

describe('indicators that measure a risk', () => {
  it('proposes indicators from the wording of the risk', () => {
    expect(suggestIndicators({ hazard: 'Λοίμωξη αίματος από κεντρικό φλεβικό καθετήρα (CLABSI)' }, all)).toEqual(['clabsi-rate', 'hai-prevalence-pps', 'who-hh'])
    expect(suggestIndicators({ hazard: 'Κίνδυνος Διασποράς Λοιμογόνου Παράγοντα (π.χ PAM)', indicator: ' ΔΕΙΚΤΗΣ ΕΕΛ' }, all)).toEqual(['mdr-introduction-index', 'mdro-bsi-per-1000', 'hai-prevalence-pps'])
    expect(suggestIndicators({ hazard: 'Πτώση ασθενή', indicator: 'Δείκτης Συμβάντος' }, all)).toEqual(['open-high-incidents'])
  })
  it('proposes only indicators the organization has and leaves out the linked ones', () => {
    expect(suggestIndicators({ hazard: 'Πνευμονία σε αναπνευστήρα', indicatorKeys: ['vap-rate'] }, all)).toEqual([])
    expect(suggestIndicators({ hazard: 'Πνευμονία σε αναπνευστήρα' }, ['who-hh'])).toEqual([])
  })
  it('reads the trend with the direction of the indicator', () => {
    expect(indicatorTrend(1.2, 2.0, 'lower')).toBe('better')
    expect(indicatorTrend(80, 90, 'higher')).toBe('worse')
    expect(indicatorTrend(3, 3, 'lower')).toBe('steady')
    expect(indicatorTrend(3, null, 'lower')).toBe('steady')
  })
})
