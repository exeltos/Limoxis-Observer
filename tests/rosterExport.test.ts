import { describe, expect, it } from 'vitest'
import { periodDays } from '../src/features/rosters/rosterEngine'
import { rosterDocument, rosterSheet, rosterSummary } from '../src/features/rosters/rosterExport'
import type { RosterExportInput } from '../src/features/rosters/rosterExport'
import type { RosterDepartment } from '../src/features/rosters/rosterService'
import { buildXlsx, XLSX_STYLE } from '../src/core/export/xlsxExport'
import type { XlsxStyledCell } from '../src/core/export/xlsxExport'

const days = periodDays('2026-11-21', '2026-11-27')
const codes = { a: ['R', 'R', 'M', 'A', 'N', 'N', 'R'], b: ['M', 'M', 'R', 'R', 'A', 'I:11', 'L'] }
const input = {
  en: false,
  department: { name: 'ΜΕΘ' } as RosterDepartment,
  period: { start: '2026-11-21', end: '2026-11-27' },
  status: 'published',
  days,
  members: [{ employeeId: 'a', name: 'Α & Β', head: true }, { employeeId: 'b', name: 'Γ' }],
  codeAt: (id, date) => codes[id][days.findIndex(d => d.date === date)],
  shortOf: code => (!code ? '' : String(code).includes(':') ? code.split(':')[1] : { M: '4', A: '19', N: '20', I: '12', R: 'R', L: 'Α' }[code]),
  kinds: ['M', 'A', 'N'],
  kindLabel: kind => ({ M: 'Πρωί', A: 'Απόγευμα', N: 'Νύχτα' })[kind],
  need: () => 1,
  targets: { a: 4, b: 4 },
  hours: 8,
  legend: [['4', 'Πρωί', '']],
} as RosterExportInput

describe('roster export (owner, 9/11/2026)', () => {
  it('counts each person’s shifts by kind, days off and hours', () => {
    const [a, b] = rosterSummary(input)
    expect(a.perKind).toEqual([1, 1, 2])
    expect([a.rests, a.shifts, a.hours]).toEqual([3, 4, 32])
    expect(b.perKind).toEqual([2, 1, 0])
    expect(b.shifts).toBe(4)
  })
  it('prints one landscape sheet with the weekends shaded, the codes coloured and the signatures', () => {
    const doc = rosterDocument(input)
    expect(doc.orientation).toBe('landscape')
    expect(doc.body).toContain('Α &amp; Β')
    expect(doc.body).toContain('class="c n"')
    expect(doc.body).toContain('class="c r we"')
    expect(doc.body).toContain('Δημοσιευμένο')
    expect(doc.signatures).toHaveLength(2)
  })
  it('gives Excel the same sheet with coloured cells on one page', () => {
    const sheet = rosterSheet(input)
    expect(sheet.fit).toBe(true)
    expect(sheet.rows[0][5]).toEqual({ v: '20', s: XLSX_STYLE.night })
    expect((sheet.rows.at(-1)[0] as XlsxStyledCell).v).toBe('Νύχτα')
    const text = new TextDecoder().decode(buildXlsx([sheet]))
    expect(text).toContain('fitToPage="1"')
    expect(text).toContain('xSplit="1"')
  })
})
