import { describe, expect, it } from 'vitest'
import { auditCoverage, missingNextAudits } from '../src/features/quality/audits/auditModel'

const audit = (department, status, day, extra = {}) => ({ id: `${department}-${day}`, department, status, auditType: 'internal', standard: 'iso9001', plannedDate: day, completedDate: status === 'completed' ? day : null, ...extra })

describe('audit programme: two a year per department, the next always planned', () => {
  it('counts the departments with 2, 1 and no audit this year and those without a next one', () => {
    const rows = [
      audit('ΜΕΘ', 'completed', '2026-02-10'), audit('ΜΕΘ', 'planned', '2026-11-15'),
      audit('Παθολογική', 'completed', '2026-03-05'),
      audit('Χειρουργική', 'completed', '2025-05-16'),
    ]
    const coverage = auditCoverage(rows, '2026')
    expect(coverage.full).toBe(1)
    expect(coverage.half).toBe(1)
    expect(coverage.none).toBe(1)
    expect(coverage.noNext).toBe(2)
  })

  it('plans the next audit six months after the last one, never in the past, as a month', () => {
    const planned = missingNextAudits([audit('Παθολογική', 'completed', '2026-05-10'), audit('Χειρουργική', 'completed', '2025-05-16'), audit('ΜΕΘ', 'completed', '2026-02-10'), audit('ΜΕΘ', 'planned', '2026-08-15')], '2026-10-27')
    const byDepartment = Object.fromEntries(planned.map(item => [item.department, item]))
    expect(byDepartment['Παθολογική'].plannedDate).toBe('2026-11-15')
    expect(byDepartment['Χειρουργική'].plannedDate).toBe('2026-11-15')
    expect(byDepartment['Χειρουργική'].plannedMonthOnly).toBe(true)
    expect(byDepartment['ΜΕΘ']).toBeUndefined()
  })
})
