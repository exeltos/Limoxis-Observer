import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { controlDefinitionRows } from '../src/features/controls/controlDemoData'
import { controlTypeCode } from '../src/features/controls/controlVocabulary'
import { programmeCalendar } from '../src/features/controls/controlCalendar'

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('the annual culture plan of the environmental surveillance', () => {
  it('has its own tab beside the samples, and the Controls no longer list the culture programme', () => {
    const page = source('src/features/surveillance/SurveillanceCanonicalPage.jsx')
    expect(page).toContain("mode === 'environmental' && envView === 'plan' ? <EnvironmentalAnnualPlan />")
    const controls = source('src/features/controls/ControlsPage.jsx')
    expect(controls).not.toContain('setKind')
    expect(controls).toContain("controlTypeCode(item.category)!=='CTRL-ENV'")
    expect(source('src/features/surveillance/EnvironmentalAnnualPlan.jsx')).toContain("controlTypeCode(item.category) === 'CTRL-ENV'")
  })
  it('puts the culture controls on a month-by-month calendar for every department', () => {
    const cultures = controlDefinitionRows.filter(row => controlTypeCode(row.category) === 'CTRL-ENV')
    expect(cultures.length).toBe(1)
    const item = { id: 'c1', title: 'Καλλιέργειες επιφανειών', frequency: { kind: 'monthly', interval: 1 }, assignments: { ΜΕΘ: { frequency: { kind: 'monthly', interval: 1 }, history: [], nextDueAt: '2026-12-10T08:00:00Z', createdAt: '2026-01-01T00:00:00Z' } } }
    const lines = programmeCalendar([{ item, departments: ['ΜΕΘ'] }], 2026, new Date('2026-11-05T10:00:00Z'))
    expect(lines).toHaveLength(1)
    expect(lines[0].months).toHaveLength(12)
    expect(lines[0].months[11].planned).toContain(10)
  })
})
