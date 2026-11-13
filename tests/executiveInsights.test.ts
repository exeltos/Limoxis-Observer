import { describe, expect, it } from 'vitest'
import type { ExecKpi } from '../src/features/executive/executiveModel'
import { assessmentOf, changeText, departmentGrid, notStartedReason, sparkPoints, summaryHighlights, yearAgoRange } from '../src/features/executive/executiveInsights'

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

  it('lists what needs attention and what got better, with the figure of the comparison, never «from 0»', () => {
    const kpis = [
      { id: 'handHygiene', label: ['Υγιεινή χεριών', 'Hand hygiene'], unit: '%', value: 70, target: '≥ 80%', status: 'judged', tone: 'danger', delta: { diff: -5, change: -6.7, good: false, previous: 75 }, tab: 'prevention' },
      { id: 'training', label: ['Εκπαίδευση', 'Training'], unit: '%', value: 95, delta: { diff: 3, change: 3.2, good: true, previous: 92 } },
      { id: 'incidents', label: ['Συμβάντα', 'Incidents'], value: 7, delta: { diff: 7, change: null, good: false, previous: 0 } },
      { id: 'bundles', label: ['Δέσμες', 'Bundles'], unit: '%', value: 60, target: '≥ 90%', status: 'judged', tone: 'danger', delta: null },
      { id: 'decisions', label: ['Αποφάσεις', 'Decisions'], value: 4, delta: null },
    ] as ExecKpi[]
    const snapshot = { domains: { handHygiene: { byDepartment: [['ΜΕΘ', 40, 20], ['ΤΕΠ', 40, 36]] } } }
    const { attention, improved } = summaryHighlights(kpis, snapshot, { against: '2025' })
    expect(attention.map((s) => s.id)).toEqual(['handHygiene', 'bundles'])
    expect(attention[0].text).toBe('Υγιεινή χεριών: 70% (2025: 75%) — κυρίως ΜΕΘ (50%)')
    expect(attention[1].text).toBe('Δέσμες: 60% — εκτός στόχου (≥ 90%)')
    expect(improved.map((s) => s.id)).toEqual(['training'])
    expect(changeText(kpis[2]).text).toBe('—')
    expect(changeText(kpis[0]).text).toBe('−5 μον.')
    expect(assessmentOf(kpis[0]).text).toBe('Εκτός στόχου')
    expect(assessmentOf(kpis[1]).text).toBe('Καλύτερα')
    expect(assessmentOf({ value: null } as never).text).toBe('Δεν έχει ξεκινήσει')
    expect(notStartedReason({ id: 'haiRate' } as never)).toBe('λείπουν οι κλινοημέρες της περιόδου')
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

describe('rates per 1,000 patient days', () => {
  it('takes the share of each hospital period that falls in the range, never a department\'s', async () => {
    const { patientDaysIn, rateMeasures } = await import('../src/features/executive/executiveInsights')
    const periods = [{ scope: 'hospital', from: '2026-01-01', to: '2026-12-31', value: 36500 }, { scope: 'department', from: '2026-01-01', to: '2026-12-31', value: 999 }]
    expect(patientDaysIn(periods, { from: '2026-01-01', to: '2026-01-10' })).toBe(1000)
    expect(patientDaysIn([], { from: '2026-01-01', to: '2026-01-10' })).toBeNull()
    const [hai] = rateMeasures([{ id: 'hai', value: 3 } as never], 1000)
    expect(hai).toMatchObject({ id: 'haiRate', value: 3 })
    expect(rateMeasures([{ id: 'hai', value: 3 } as never], null)[0].value).toBeNull()
  })
  it('leaves the departments counted apart out of the hospital rate, and a department uses its own days', async () => {
    const { patientDaysIn, rateMeasures, separateHai } = await import('../src/features/executive/executiveInsights')
    const snapshot = { domains: { surveillance: { haiByDepartment: [['Παιδιατρική', 'BSI', 2], ['ΜΕΘ', 'BSI', 3]] } } }
    expect(separateHai(snapshot, ['Παιδιατρική'])).toBe(2)
    const [hai, mdro] = rateMeasures([{ id: 'hai', value: 5 } as never, { id: 'mdro', value: 4 } as never], 1000, { hai: 2, mdro: 1, names: ['Παιδιατρική'] })
    expect(hai.value).toBe(3)
    expect(mdro.value).toBe(3)
    expect(hai.hint[0]).toContain('χωρίς Παιδιατρική')
    const periods = [{ scope: 'department', departmentId: 'icu', from: '2026-01-01', to: '2026-01-31', value: 310 }]
    expect(patientDaysIn(periods, { from: '2026-01-01', to: '2026-01-31' }, 'icu')).toBe(310)
    expect(rateMeasures([{ id: 'hai', value: 1 } as never], null)[0].missing[0]).toBe('λείπουν οι κλινοημέρες της περιόδου')
  })
})
