import { describe, expect, it } from 'vitest'
import { EODY_CATALOGUE, EODY_FOOTNOTES, deadlineStatusText, deadlineWords, eodyEntry, eodyEntryByName } from '../src/features/reporting/eodyCatalogue'
import { NOTIFIABLE_RULE_LIST, catalogueEntryFor, notifiableRuleFor } from '../src/features/reporting/notifiableFindings'
import { demoLibrarySeed } from '../src/features/management/managementData'

// Counted by hand from docs/reference/eody-katalogos-nosimaton-2022.pdf (Υ.Α. Δ1α/Γ.Π.οικ. 16711/2022).
describe('ΕΟΔΥ catalogue of notifiable diseases', () => {
  it('has the 57 numbered, unique entries of the official list', () => {
    expect(EODY_CATALOGUE).toHaveLength(57)
    expect(EODY_CATALOGUE.map(entry => entry.n)).toEqual(Array.from({ length: 57 }, (_, index) => index + 1))
    expect(new Set(EODY_CATALOGUE.map(entry => entry.id)).size).toBe(57)
    expect(new Set(EODY_CATALOGUE.map(entry => entry.el)).size).toBe(57)
    expect(EODY_CATALOGUE.every(entry => entry.el && entry.en)).toBe(true)
  })

  it('has 19 diseases per deadline (Αμέσως, 24ωρο, Εβδομάδα)', () => {
    const count = deadline => EODY_CATALOGUE.filter(entry => entry.deadline === deadline).length
    expect([count('immediate'), count('24h'), count('weekly')]).toEqual([19, 19, 19])
    const numbers = deadline => EODY_CATALOGUE.filter(entry => entry.deadline === deadline).map(entry => entry.n)
    expect(numbers('immediate')).toEqual([2, 4, 5, 6, 7, 8, 12, 13, 15, 19, 21, 34, 35, 39, 41, 44, 51, 53, 57])
    expect(numbers('24h')).toEqual([11, 14, 16, 17, 18, 22, 25, 26, 27, 28, 29, 36, 37, 40, 43, 45, 48, 52, 54])
    expect(numbers('weekly')).toEqual([1, 3, 9, 10, 20, 23, 24, 30, 31, 32, 33, 38, 42, 46, 47, 49, 50, 55, 56])
  })

  it('carries the footnotes of the catalogue', () => {
    expect(eodyEntry('covid19').notes).toEqual(['covid'])
    expect(eodyEntry('haemorrhagic_fevers').notes).toEqual(['haemorrhagic'])
    expect(eodyEntry('arboviral_encephalitis').notes).toEqual(['encephalitis'])
    expect(Object.keys(EODY_FOOTNOTES).sort()).toEqual(['biothreat', 'covid', 'encephalitis', 'haemorrhagic'])
  })

  it('feeds the notifiable diseases library with every entry as a system row', () => {
    const rows = demoLibrarySeed.notifiableDiseases
    expect(rows).toHaveLength(57)
    expect(rows.every(row => row[2].system && row[2].locked && /ΕΟΔΥ/.test(row[2].source))).toBe(true)
    expect(eodyEntryByName(rows[24][0]).n).toBe(25)
  })

  it('says the deadline in plain words and counts the time left or overdue', () => {
    expect(deadlineWords('immediate')).toBe('Δήλωση αμέσως')
    expect(deadlineWords('24h')).toBe('Δήλωση εντός 24 ωρών')
    expect(deadlineWords('weekly', 'en')).toBe('Notify within a week')
    const start = '2026-10-01T10:00:00Z'
    const at = hours => Date.parse(start) + hours * 3600000
    expect(deadlineStatusText('24h', start, { now: at(3) })).toEqual({ overdue: false, text: 'απομένουν 21 ώρες' })
    expect(deadlineStatusText('24h', start, { now: at(30) })).toEqual({ overdue: true, text: 'καθυστέρηση 6 ώρες' })
    expect(deadlineStatusText('weekly', start, { now: at(24 * 3) })).toEqual({ overdue: false, text: 'απομένουν 4 ημέρες' })
    expect(deadlineStatusText('weekly', start, { now: at(24 * 9), language: 'en' })).toEqual({ overdue: true, text: '2 days overdue' })
    expect(deadlineStatusText('immediate', start, { now: at(5) }).overdue).toBe(false)
  })
})

describe('laboratory rules against the catalogue', () => {
  it('maps every laboratory rule id to an entry of the catalogue (except the national plan and invasive isolates)', () => {
    for (const rule of NOTIFIABLE_RULE_LIST) {
      if (rule.nationalPlan) { expect(rule.catalogueId).toBeUndefined(); continue }
      if (rule.csfCatalogueId || rule.id === 'invasive_gas') { expect(eodyEntry(rule.csfCatalogueId || 'meningitis')).toBeTruthy(); continue }
      expect(eodyEntry(rule.id), rule.id).toBeTruthy()
      expect(rule.catalogueId).toBe(rule.id)
      expect(rule.deadline).toBe(eodyEntry(rule.id).deadline)
    }
    expect(NOTIFIABLE_RULE_LIST.filter(rule => rule.nationalPlan).map(rule => rule.id)).toEqual(['carbapenem_resistant_bacteraemia'])
  })

  it('maps clear organisms to their catalogue disease', () => {
    const ruleOf = organism => notifiableRuleFor({ type: 'other' }, { organism })?.id
    expect(ruleOf('Bacillus anthracis')).toBe('anthrax')
    expect(ruleOf('Francisella tularensis')).toBe('tularaemia')
    expect(ruleOf('Coxiella burnetii')).toBe('q_fever')
    expect(ruleOf('Chlamydia trachomatis')).toBe('chlamydia')
    expect(ruleOf('Neisseria gonorrhoeae')).toBe('gonorrhoea')
    expect(ruleOf('Treponema pallidum')).toBe('syphilis')
    expect(ruleOf('Trichinella spiralis')).toBe('trichinellosis')
    expect(ruleOf('Yersinia pestis')).toBe('plague')
    expect(ruleOf('Rickettsia conorii')).toBe('lyme_tickborne')
    expect(ruleOf('Leptospira interrogans')).toBe('leptospirosis')
    expect(ruleOf('Leishmania infantum')).toBe('leishmaniasis')
    expect(ruleOf('Plasmodium falciparum')).toBe('malaria')
    expect(ruleOf('Echinococcus granulosus')).toBe('echinococcosis')
    expect(ruleOf('Burkholderia pseudomallei')).toBe('melioidosis_glanders')
    expect(ruleOf('Toxoplasma gondii')).toBeUndefined()
  })

  it('takes the deadline of a finding from the catalogue, meningitis for CSF isolates', () => {
    expect(catalogueEntryFor(notifiableRuleFor({ type: 'other' }, { organism: 'Vibrio cholerae' }), 'OTHER').deadline).toBe('immediate')
    const pneumococcus = notifiableRuleFor({ type: 'other', source: 'CSF' }, { organism: 'Streptococcus pneumoniae' })
    expect(catalogueEntryFor(pneumococcus, 'CSF').id).toBe('meningitis')
    expect(catalogueEntryFor(pneumococcus, 'BLOOD')).toBeNull()
  })
})
