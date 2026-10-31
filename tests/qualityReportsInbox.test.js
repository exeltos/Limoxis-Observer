import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { staleReports, filterRegister, registerRows } from '../src/features/quality/qualityRegister'

const report = (id, date, extra = {}) => ({ id, title: id, date, status: 'reported', reportKind: 'report', category: 'other', department: 'ΤΕΠ', ...extra })
const classified = (id, date) => ({ id, title: id, date, status: 'reported', reportKind: 'clinical', category: 'fall' })

describe('reports inbox', () => {
  it('reminds only of unclassified reports that waited the days asked', () => {
    const rows = [report('A', '2026-10-20'), report('B', '2026-10-21'), report('C', '2026-10-25'), classified('D', '2026-10-01')]
    expect(staleReports(rows, { today: '2026-10-27' }).map(row => row.id).sort()).toEqual(['A'])
    expect(staleReports(rows, { today: '2026-10-27', days: 2 }).map(row => row.id).sort()).toEqual(['A', 'B', 'C'])
    expect(staleReports([], { today: '2026-10-27' })).toEqual([])
  })

  it('finds a report by its reporter, and keeps anonymous ones nameless', () => {
    const rows = registerRows([report('A', '2026-10-20', { reportedBy: 'Μαρία Π.' }), report('B', '2026-10-20', { anonymous: true, reportedBy: 'Μαρία Π.' })])
    expect(rows.find(row => row.id === 'B').reporter).toBe('')
    expect(filterRegister(rows, { query: 'μαρία' }).map(row => row.id)).toEqual(['A'])
  })

  it('keeps the filters closed in the usual «Filters» popover, and sends the reminder to the bell once a day', () => {
    const view = fs.readFileSync('src/features/quality/QualityReportRegister.jsx', 'utf8')
    expect(view).toContain('<FilterSelect label={en?\'Period\':\'Περίοδος\'}')
    expect(view).toContain("const popover=inbox?inboxSelects:<>")
    const bell = fs.readFileSync('src/core/notifications/NotificationContext.jsx', 'utf8')
    expect(bell).toContain('`reports-waiting:${new Date(clock).toISOString().slice(0,10)}:${staleReportCount}`')
    expect(bell).toContain("const REPORT_REMINDER_ROLES=['hospital_admin','quality_manager']")
  })
})
