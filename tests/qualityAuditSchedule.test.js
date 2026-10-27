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

describe('audit round: the month\'s audits spread over three working days', () => {
  it('skips the weekend and splits the audits evenly in the departments\' order', async () => {
    const { spreadAuditRound, workingDays } = await import('../src/features/quality/audits/auditModel')
    expect(workingDays('2026-11-13', 3)).toEqual(['2026-11-13', '2026-11-16', '2026-11-17'])
    const rows = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ', 'Ζ'].map(name => audit(name, 'planned', '2026-11-15', { plannedMonthOnly: true }))
    rows.push(audit('Άλλο μήνα', 'planned', '2026-12-15'))
    const { days, assignments } = spreadAuditRound(rows, '2026-11-10', 3)
    expect(assignments).toHaveLength(7)
    const perDay = days.map(day => assignments.filter(item => item.plannedDate === day).length)
    expect(perDay.reduce((a, b) => a + b, 0)).toBe(7)
    expect(Math.max(...perDay) - Math.min(...perDay)).toBeLessThanOrEqual(1)
    expect(assignments.find(item => item.audit.department === 'Άλλο μήνα')).toBeUndefined()
  })
})
