// Μητρώα (owner, 18/11/2026): the printed indicators and entries on the shared document, with the
// period to compare with (none, previous, last year, any dates), a summary or a detailed layout, and
// tables whose columns line up.
import { describe, expect, it } from 'vitest'
import { registerFromTemplate } from '../src/features/registers/registerTemplates'
import { indicatorReport, periodOf } from '../src/features/registers/registerEngine'
import { changeText, comparePeriod, comparisonFor, entriesDocument, entriesInRange, indicatorsDocument } from '../src/features/registers/registerReport'
import { listFields, registerExport } from '../src/features/registers/RegisterRecordPage'
import type { Register, RegisterEntry } from '../src/features/registers/registerTypes'

const nicu = registerFromTemplate('nicu') as Register
const at = (id: string, day: string) => ({ id, registerId: nicu.id, entryDate: day, values: { admission_date: day, discharge_date: day, outcome: 'discharged', breast_milk: 'kept' } }) as unknown as RegisterEntry
const entries = [at('a', '2026-07-10'), at('b', '2026-08-02'), at('c', '2026-04-05')]
const period = periodOf('quarter', '2026-07-01')
const rows = indicatorReport(nicu, entries, period)
const widths = (doc: ReturnType<typeof indicatorsDocument>) => (doc.sections?.[0]?.table?.columns || []).map(cell => Number(String((cell as { width?: string }).width).replace('%', '')))

describe('printed indicators', () => {
  it('chooses the period to compare with', () => {
    expect(comparePeriod('none', period)).toBeNull()
    expect(comparePeriod('previous', period)?.from).toBe('2026-04-01')
    expect(comparePeriod('lastYear', period)?.from).toBe('2025-07-01')
    expect(comparePeriod('custom', period, { from: '2025-01-01', to: '2025-12-31' })).toMatchObject({ from: '2025-01-01', to: '2025-12-31' })
    expect(comparePeriod('custom', period, { from: '2025-12-31', to: '2025-01-01' })).toBeNull()
    expect(comparisonFor(nicu, entries, comparePeriod('custom', period, { from: '2025-01-01', to: '2025-12-31' })!).label).toBe('01/01/2025 – 31/12/2025')
  })

  it('has a summary and a detailed layout whose columns always add up to the whole width', () => {
    const summary = indicatorsDocument({ register: nicu, rows, period, detail: 'summary' })
    const full = indicatorsDocument({ register: nicu, rows, period, detail: 'full', comparisons: [comparisonFor(nicu, entries, comparePeriod('previous', period)!)] })
    expect(summary.sections?.[0]?.table?.columns).toHaveLength(2)
    expect(full.sections?.[0]?.table?.columns).toHaveLength(6)
    for (const doc of [summary, full]) expect(widths(doc).reduce((sum, width) => sum + width, 0)).toBe(100)
    // Every table of the document has the same columns, so they line up.
    const tables = full.sections?.filter(section => section.table).map(section => JSON.stringify(section.table?.columns))
    expect(new Set(tables).size).toBe(1)
  })

  it('writes the change in points for a percent and in % otherwise', () => {
    expect(changeText(30, 25, { unit: '%' } as never)).toBe('+5 μον.')
    expect(changeText(12, 10, { unit: 'ημέρες' } as never)).toBe('+20%')
  })
})

describe('printed entries', () => {
  it('keeps the entries of the chosen dates and the columns of the list in the summary', () => {
    expect(entriesInRange(nicu, entries, '2026-07-01', '2026-09-30').map(entry => entry.id)).toEqual(['a', 'b'])
    expect(entriesInRange(nicu, entries)).toHaveLength(3)
    const summary = registerExport(nicu, entries, { detail: 'summary' })
    expect(summary.headers.slice(1)).toEqual(listFields(nicu).map(field => field.label))
    expect(registerExport(nicu, entries, { detail: 'full' }).headers.length).toBeGreaterThan(summary.headers.length)
    const doc = entriesDocument({ register: nicu, headers: summary.headers, rows: summary.rows, from: '2026-07-01', to: '2026-09-30' })
    expect(doc.title).toContain('01/07/2026 – 30/09/2026')
    expect(doc.orientation).toBe('landscape')
  })
})
