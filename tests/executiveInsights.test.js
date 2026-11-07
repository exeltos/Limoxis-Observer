import { describe, expect, it } from 'vitest'
import { changeSentences, departmentGrid, sparkPoints, yearAgoRange } from '../src/features/executive/executiveInsights'

describe('hospital overview · summary', () => {
  it('compares with the same period a year before', () => {
    expect(yearAgoRange({ from: '2026-01-01', to: '2026-11-07' })).toEqual({ from: '2025-01-01', to: '2025-11-07' })
  })

  it('overlays this year and the comparison by calendar month', () => {
    const now = { domains: { handHygiene: { monthly: [['2026-01', 100, 80], ['2026-02', 50, 45]] } } }
    const before = { domains: { handHygiene: { monthly: [['2025-01', 100, 70]] } } }
    const points = sparkPoints('handHygiene', now, before, { from: '2026-01-01', to: '2026-03-31' })
    expect(points).toEqual([{ month: 1, now: 80, before: 70 }, { month: 2, now: 90, before: null }, { month: 3, now: null, before: null }])
    expect(sparkPoints('decisions', now, before, { from: '2026-01-01', to: '2026-03-31' })).toBeNull()
  })

  it('says what changed, the worse first, with the department that pulls it down', () => {
    const kpis = [
      { id: 'handHygiene', label: ['Υγιεινή χεριών', 'Hand hygiene'], unit: '%', value: 70, delta: { diff: -5, change: -6.7, good: false, previous: 75 }, tab: 'prevention' },
      { id: 'training', label: ['Εκπαίδευση', 'Training'], unit: '%', value: 95, delta: { diff: 3, change: 3.2, good: true, previous: 92 } },
      { id: 'decisions', label: ['Αποφάσεις', 'Decisions'], value: 4, delta: null },
    ]
    const snapshot = { domains: { handHygiene: { byDepartment: [['ΜΕΘ', 40, 20], ['ΤΕΠ', 40, 36]] } } }
    const sentences = changeSentences(kpis, snapshot)
    expect(sentences.map((s) => s.id)).toEqual(['handHygiene', 'training'])
    expect(sentences[0].text).toBe('Υγιεινή χεριών: 70% από 75% · κυρίως ΜΕΘ (50%)')
  })

  it('shows the departments at a glance, coloured against the target, the worst first', () => {
    const snapshot = { domains: { handHygiene: { byDepartment: [['ΜΕΘ', 100, 60], ['ΤΕΠ', 100, 90]] }, surveillance: { haiByDepartment: [['ΜΕΘ', 'BSI', 1], ['ΜΕΘ', 'UTI', 1]] } } }
    const previous = { domains: { handHygiene: { byDepartment: [['ΜΕΘ', 100, 70]] } } }
    const grid = departmentGrid(snapshot, previous, { handHygiene: 80 })
    expect(grid.columns.map((c) => c.key)).toEqual(['handHygiene', 'hai'])
    expect(grid.rows[0].name).toBe('ΜΕΘ')
    expect(grid.rows[0].cells[0]).toMatchObject({ value: 60, previous: 70, tone: 'danger', trend: 'down', good: false })
    expect(grid.rows[1].cells[0].tone).toBe('good')
  })
})
