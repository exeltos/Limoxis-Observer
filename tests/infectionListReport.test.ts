// «Αναφορά λοιμώξεων» (owner, 19/11/2026): the printed report of the infections from Surveillance and the Laboratory.
import { describe, expect, it } from 'vitest'
import { countChange, groupItems, infectionComparePeriod, infectionDocument, infectionPeriod, itemsInPeriod, laboratoryItems, patientDaysIn, surveillanceItems } from '../src/features/surveillance/infectionReport'
import { buildReportHtml } from '../src/core/export/reportDocument'
import { readSource } from './helpers/readSource'
import type { InfectionItem } from '../src/features/surveillance/infectionReport'

const item = (id: string, date: string, extra: Partial<InfectionItem> = {}): InfectionItem => ({ id, code: `P-${id}`, date, department: 'ΜΕΘ', organism: 'Klebsiella pneumoniae', group: 'Βακτηριαιμία', patientKey: `p${id}`, positives: 1, ...extra })
const items: InfectionItem[] = [
  item('1', '2026-10-03', { resistance: 'CRE', hai: true }),
  item('2', '2026-10-15', { organism: 'Staphylococcus aureus', resistance: 'MRSA', department: 'Χειρουργική', group: 'Λοίμωξη χειρουργικού πεδίου' }),
  item('3', '2026-11-02', { organism: 'Escherichia coli', group: 'Ουρολοίμωξη', hai: true, positives: 2 }),
  item('4', '2025-10-10', { organism: 'Escherichia coli' }),
  item('5', '2026-09-20', {}),
]
const sectionTitles = (doc: ReturnType<typeof infectionDocument>) => (doc.sections || []).map(section => section.title)

describe('Infection report: periods and groups', () => {
  it('cuts the period and finds the period to compare with', () => {
    expect(itemsInPeriod(items, { from: '2026-10-01', to: '2026-10-31' }).map(row => row.id)).toEqual(['1', '2'])
    expect(infectionPeriod(items, null)).toEqual({ from: '2025-10-10', to: '2026-11-02' })
    expect(infectionComparePeriod('previous', { from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' })
    expect(infectionComparePeriod('lastYear', { from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2025-10-01', to: '2025-10-31' })
    expect(infectionComparePeriod('custom', null, { from: '2026-01-01', to: '2026-01-31' })).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(infectionComparePeriod('none', { from: '2026-10-01', to: '2026-10-31' })).toBeNull()
  })
  it('groups by a field, the most first, an empty one as «not recorded»', () => {
    const groups = groupItems([...items, item('6', '2026-10-20', { organism: '' })], row => row.organism, 'Χωρίς στοιχείο')
    // A tie goes in the order of the names.
    expect(groups.slice(0, 2).map(group => [group.key, group.count])).toEqual([['Escherichia coli', 2], ['Klebsiella pneumoniae', 2]])
    expect(groups.find(group => group.key === 'Χωρίς στοιχείο')?.count).toBe(1)
    expect(countChange(5, 3, 'el')).toBe('3 · +2')
    expect(countChange(5, null)).toBe('—')
  })
  it('reads the patient days of the department, or of the hospital, inside the period only', () => {
    const entries = [{ from: '2026-10-01', to: '2026-10-31', value: 900 }, { from: '2026-10-01', to: '2026-10-31', value: 300, department: 'ΜΕΘ' }, { from: '2026-09-01', to: '2026-10-31', value: 999 }]
    expect(patientDaysIn(entries, { from: '2026-10-01', to: '2026-10-31' })).toBe(900)
    expect(patientDaysIn(entries, { from: '2026-10-01', to: '2026-10-31' }, 'ΜΕΘ')).toBe(300)
    expect(patientDaysIn(entries, { from: '2026-11-01', to: '2026-11-30' })).toBeNull()
  })
})

describe('Infection report: the document', () => {
  it('summary with a comparison: microorganism, resistance, site, department and the change', () => {
    const doc = infectionDocument({ source: 'surveillance', items, period: { from: '2026-10-01', to: '2026-11-30' }, compare: 'lastYear', filters: ['Τμήμα: ΜΕΘ'], patientDays: [{ from: '2026-10-01', to: '2026-11-30', value: 2000 }] })
    expect(doc.title).toBe('Αναφορά λοιμώξεων')
    expect(sectionTitles(doc)).toEqual(['Σύνοψη', 'Ανά μικροοργανισμό', 'Ανά αντοχή', 'Ανά σημείο λοίμωξης', 'Ανά τμήμα', 'Ανά μήνα', 'Πώς διαβάζεται'])
    const html = buildReportHtml(doc)
    expect(html).toContain('Τμήμα: ΜΕΘ')
    expect(html).toContain('01/10/2025 – 30/11/2025')
    // Three episodes now, one last year: «1 · +2»; two HAI over 2,000 patient days: 1 per 1,000.
    expect(html).toContain('1 · +2')
    expect(html).toContain('ΛΣΦΥ ανά 1.000 κλινοημέρες')
    expect(html).toContain('MRSA')
    expect(html).not.toContain('Επεισόδια της περιόδου')
  })
  it('detailed adds the list of the episodes with codes, never names', () => {
    const doc = infectionDocument({ source: 'surveillance', items, period: { from: '2026-10-01', to: '2026-11-30' }, detail: 'full', language: 'en' })
    expect(sectionTitles(doc)).toContain('Episodes of the period')
    const list = doc.sections?.find(section => section.title === 'Episodes of the period')
    expect(list?.table?.rows?.map(row => row[0])).toEqual(['P-3', 'P-2', 'P-1'])
  })
  it('without the classification on the rows, no HAI line and the rate is per episode', () => {
    const plain = items.map(row => ({ ...row, hai: undefined }))
    const html = buildReportHtml(infectionDocument({ source: 'surveillance', items: plain, period: { from: '2026-10-01', to: '2026-11-30' }, patientDays: [{ from: '2026-10-01', to: '2026-11-30', value: 3000 }] }))
    expect(html).not.toContain('(ΛΣΦΥ)')
    expect(html).toContain('Επεισόδια ανά 1.000 κλινοημέρες')
  })
  it('an empty period prints a clear document', () => {
    const doc = infectionDocument({ source: 'laboratory', items: [], detail: 'full' })
    expect(doc.sections?.[0].text).toContain('Δεν υπάρχουν δεδομένα για την περίοδο')
    expect(() => buildReportHtml(doc)).not.toThrow()
  })
})

describe('Infection report: the lines from the screens', () => {
  it('Surveillance: the episodes with their positive cultures and HAI classification', () => {
    const rows = surveillanceItems([
      { id: 'c1', patientId: 'P1', startedAt: '2026-10-03T08:00:00Z', department: 'ΜΕΘ', haiClassification: { status: 'confirmed', type: 'bloodstreamInfection' }, samples: [{ organism: 'K. pneumoniae', resistance: 'CRE', result: 'positive' }, { result: 'negative' }] },
      { id: 'c2', patientId: 'P2', department: 'ΜΕΘ' },
      { id: 'c3', patientId: 'P3', startedAt: '2026-10-04', department: 'ΜΕΘ' },
    ], { siteOf: () => 'Βακτηριαιμία' })
    expect(rows).toHaveLength(2)
    // A row without the field says nothing about the classification.
    expect(rows[1].hai).toBeUndefined()
    expect(rows[0]).toMatchObject({ code: 'P1', date: '2026-10-03', organism: 'K. pneumoniae', resistance: 'CRE', hai: true, positives: 1, group: 'Βακτηριαιμία' })
  })
  it('Laboratory: only the positive samples, by their collection day in Athens time', () => {
    const rows = laboratoryItems([
      { id: 's1', collectedAt: '2026-10-02T22:30:00Z', result: 'positive', organism: 'E. coli', department: 'ΜΕΘ' },
      { id: 's2', collectedAt: '2026-10-02T08:00:00Z', result: 'negative' },
    ], { typeOf: () => 'Ούρα' })
    expect(rows.map(row => [row.id, row.date, row.group])).toEqual([['s1', '2026-10-03', 'Ούρα']])
  })
  it('both screens offer the report in «Εξαγωγή» with the list’s filters', () => {
    const surveillance = readSource('src/features/surveillance/SurveillanceCanonicalPage.tsx')
    expect(surveillance).toContain("id: 'infection-report'")
    expect(surveillance).toContain("department: department === 'all' ? '' : department")
    const lab = readSource('src/features/laboratory/LaboratoryWorkspace.tsx')
    expect(lab).toContain("source: 'laboratory'")
    expect(lab).toContain("sample.subjectType !== 'employee' && sample.subjectType !== 'environment'")
  })
})
