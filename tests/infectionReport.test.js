import { describe, expect, it } from 'vitest'
import { infectionDefinitions, infectionReportDocument } from '../src/features/analysis/infectionReport'

const def = (id, category, extra = {}) => ({ id, category, titleEl: id, titleEn: id, unit: '%', ...extra })

describe('the annual infections report', () => {
  it('takes only the infection, microbiology, prevention and antimicrobial indicators', () => {
    const all = [def('clabsi-per-1000-cvc-days', 'surveillance'), def('mdr-isolation-ecoli', 'surveillance'), def('bacteremia-ecoli-rate', 'laboratory'), def('amr-ecoli-ceftriaxone-rate', 'laboratory'), def('hh-compliance', 'prevention'), def('antibiotic-ddd-per-100-patient-days', 'pharmacy'), def('patient-satisfaction', 'quality'), def('training-completion', 'workforce')]
    expect(infectionDefinitions(all).map(item => item.id)).not.toContain('patient-satisfaction')
    expect(infectionDefinitions(all)).toHaveLength(6)
  })

  it('has a section per group and a last page of what is missing', () => {
    const rows = [
      { def: def('clabsi-per-1000-cvc-days', 'surveillance'), value: 8.7, numerator: 10, denominator: 1143, evidence: [10, 1143] },
      { def: def('mdr-isolation-ecoli', 'surveillance'), value: null, missing: 'manual' },
      { def: def('hh-compliance', 'prevention'), value: 79.1, evidence: [311, 393] },
    ]
    const doc = infectionReportDocument({ rows, year: 2026, language: 'el' })
    expect(doc.sections.map(section => section.title)).toEqual(['Λοιμώξεις συνδεόμενες με τη φροντίδα', 'Πολυανθεκτικά στελέχη (MDR)', 'Πρόληψη: υγιεινή χεριών και δέσμες μέτρων', 'Δεδομένα που λείπουν'])
    expect(doc.sections[0].table.rows[0][2]).toBe('10 / 1.143')
    expect(doc.meta).toEqual([['Δείκτες', '3'], ['Με τιμή', '2'], ['Χωρίς τιμή', '1']])
  })
})
