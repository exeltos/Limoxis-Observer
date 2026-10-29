// The key figures of each Prevention tab: hand hygiene and bundles over 30 days,
// waste and antiseptics for the latest month against the month before.
import { describe, expect, it } from 'vitest'
import { ABHR_TARGET, antisepticKpis, bundleKpis, handHygieneKpis, wasteKpis } from '../src/features/prevention/preventionKpis'
import { wastePeriodLabel } from '../src/features/prevention/wasteVisuals'

const now = Date.parse('2026-10-28T12:00:00Z')

describe('prevention key figures', () => {
  it('pools hand-hygiene opportunities and counts departments below 80%', () => {
    const k = handHygieneKpis([
      { date: '2026-10-20', departmentEl: 'ΜΕΘ', observations: 10, compliant: 9 },
      { date: '2026-10-10', departmentEl: 'ΤΕΠ', observations: 10, compliant: 6 },
      { date: '2026-08-01', departmentEl: 'ΤΕΠ', observations: 50, compliant: 0 },
    ], { now })
    expect(k).toEqual({ rate: 75, opportunities: 20, sessions: 2, departments: 2, below: 1, latest: '2026-10-20' })
    const empty = handHygieneKpis([{ date: '2026-08-01', departmentEl: 'ΤΕΠ', observations: 5, compliant: 4 }], { now })
    expect(empty).toMatchObject({ rate: null, sessions: 0, below: 0, latest: '2026-08-01' })
  })

  it('compares the latest month of waste and antiseptics with the month before, per 1.000 patient days', () => {
    const waste = wasteKpis([
      { periodStart: '2026-10-01', departmentEl: 'ΜΕΘ', weight: 100, patientDays: 500 },
      { periodStart: '2026-09-01', departmentEl: 'ΜΕΘ', weight: 80, patientDays: 400 },
      { periodStart: '2026-09-01', departmentEl: 'ΤΕΠ', weight: 20, patientDays: 100 },
    ])
    expect(waste.month).toBe('2026-10')
    expect(waste.current).toEqual({ total: 100, perThousand: 200, departments: 1 })
    expect(waste.before).toEqual({ total: 100, perThousand: 200, departments: 2 })
    expect(waste.allDepartments).toBe(2)
    const abhr = antisepticKpis([
      { period: '2026-10', departmentEl: 'ΜΕΘ', litres: 12, patientDays: 600, indicatorEligible: true },
      { period: '2026-10', departmentEl: 'ΜΕΘ', litres: 5, patientDays: 600, indicatorEligible: false },
    ])
    expect(abhr.current.perThousand).toBe(20)
    expect(abhr.current.total).toBe(17)
    expect(ABHR_TARGET).toBe(20)
  })

  it('reads bundles all or none', () => {
    expect(bundleKpis([
      { date: '2026-10-27', allOrNone: true, failedCount: 0 },
      { date: '2026-10-26', allOrNone: false, failedCount: 2 },
    ], { now })).toEqual({ rate: 50, assessments: 2, deviations: 2 })
  })

  it('names a whole-month waste period by its month', () => {
    const fmt = value => value
    expect(wastePeriodLabel({ periodStart: '2026-10-01', periodEnd: '2026-10-31', date: '2026-10-31' }, fmt)).toBe('10/2026')
    expect(wastePeriodLabel({ periodStart: '2026-10-05', periodEnd: '2026-10-12' }, fmt)).toBe('2026-10-05 – 2026-10-12')
    expect(wastePeriodLabel({ periodStart: '2026-10-05', periodEnd: '2026-10-05', date: '2026-10-05' }, fmt)).toBe('2026-10-05')
  })
})
