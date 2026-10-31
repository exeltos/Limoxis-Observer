import { describe, expect, it } from 'vitest'
import { historyChartHtml, objectiveSection, objectivesDossier } from '../src/features/quality/review/objectiveDossier'

const objective = (extra = {}) => ({ id: 'o1', code: 'QO-2026-01', year: 2026, title: 'Μέση διάρκεια νοσηλείας έως 12 ημέρες', direction: 'lower', target: 12, unit: 'ημέρες', ownerLabel: 'Διευθυντής', dueDate: '2026-12-31', indicator: null, register: null, current: { value: 24.4, status: 'missed' }, ...extra })
const history = [{ month: 1, value: 25.9 }, { month: 2, value: 21.1 }, { month: 3, value: 11 }]

describe('the quality objectives file for the auditor', () => {
  it('has the objective, its months and a chart with the target', () => {
    const section = objectiveSection(objective(), history, 'el')
    expect(section.title).toContain('QO-2026-01')
    expect(section.table.rows).toHaveLength(3)
    expect(section.table.rows[2][2].text).toBe('Επιτυγχάνεται')
    expect(historyChartHtml(objective(), history, 'el')).toContain('stroke-dasharray')
    expect(historyChartHtml(objective(), [history[0]], 'el')).toBe('')
  })
  it('lists the year\'s objectives with their counts and the last decided review', () => {
    const doc = objectivesDossier({ objectives: [objective(), objective({ id: 'o2', code: 'QO-2025-01', year: 2025 })], histories: new Map([['o1', history]]), reviews: [{ code: 'MR-1', status: 'draft', reviewDate: '2026-12-01', actions: [] }, { code: 'MR-2', status: 'completed', reviewDate: '2026-06-01', summary: 'Σύνοψη', actions: [{ title: 'Ενέργεια', ownerLabel: 'Υπεύθυνος', dueDate: '2026-09-01', status: 'open' }] }], year: 2026, language: 'el' })
    expect(doc.title).toBe('Στόχοι ποιότητας 2026')
    expect(doc.meta[0]).toEqual(['Στόχοι', '1'])
    expect(doc.sections[0].table.rows).toHaveLength(1)
    expect(doc.sections.at(-1).title).toContain('MR-2')
    expect(objectivesDossier({ objectives: [], histories: new Map(), reviews: [], year: 2026, language: 'en' }).sections.at(-1).text).toMatch(/No management review/)
  })
})
