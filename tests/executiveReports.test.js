import { describe, expect, it } from 'vitest'
import { boardReportDocument, departmentReportDocument } from '../src/features/executive/executiveReports'
import { departmentGrid, departmentProfile } from '../src/features/executive/executiveInsights'

const kpis = [
  { id: 'handHygiene', label: ['Υγιεινή χεριών', 'Hand hygiene'], unit: '%', value: 79.1, target: '≥ 80%', tone: 'warning', status: 'judged', delta: { diff: 5.1, good: true, previous: 74 } },
  { id: 'training', label: ['Ολοκλήρωση εκπαίδευσης', 'Training'], unit: '%', value: null, status: 'missing' },
]
const snapshot = { domains: { handHygiene: { byDepartment: [['ΜΕΘ', 100, 60], ['ΤΕΠ', 100, 90]] } } }

describe('the documents of the hospital overview', () => {
  it('the report to the Board: what changed, the measures with the comparison, the departments and, last, what has no data', () => {
    const grid = departmentGrid(snapshot, null, { handHygiene: 80 })
    const doc = boardReportDocument({ kpis, sentences: [{ id: 'handHygiene', good: true, text: 'Υγιεινή χεριών: 79,1% από 74%' }], grid, hospital: 'Νοσοκομείο', periodLine: '2026', compareLabel: 'Πέρσι', language: 'el' })
    expect(doc.sections.map((section) => section.title)).toEqual(['Τι άλλαξε', 'Δείκτες', 'Τμήματα με μια ματιά', 'Χωρίς δεδομένα ακόμη'])
    expect(doc.sections[1].table.columns).toEqual(['Δείκτης', 'Τιμή', 'Πέρσι', 'Μεταβολή', 'Στόχος', 'Κατάσταση'])
    expect(doc.sections[1].table.rows[1][2].text).toBe('74%')
    expect(doc.sections[3].text).toBe('Ολοκλήρωση εκπαίδευσης')
  })

  it('the department report: the department against the departments\' average', () => {
    const grid = departmentGrid(snapshot, null, { handHygiene: 80 })
    const profile = departmentProfile(grid, 'ΜΕΘ')
    expect(profile[0]).toMatchObject({ value: 60, average: 75, versus: false })
    const doc = departmentReportDocument({ department: 'ΜΕΘ', profile, hospital: 'Νοσοκομείο', periodLine: '2026', compareLabel: 'Πέρσι', language: 'el' })
    expect(doc.title).toBe('Αναφορά τμήματος · ΜΕΘ')
    expect(doc.sections[0].table.rows[0][4].text).toBe('Χειρότερα από τον μέσο όρο')
  })
})
