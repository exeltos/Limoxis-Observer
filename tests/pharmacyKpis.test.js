// The Pharmacy key figures: the latest month against the one before, the WHO
// AWaRe shares of use and how many departments recorded that month.
import { describe, expect, it } from 'vitest'
import { ACCESS_TARGET, pharmacyConsumptionKpis } from '../src/features/pharmacy/pharmacyKpis'

const row = (period, productEn, grams, department = 'ΜΕΘ') => ({ periodStart: `${period}-01`, productEn, quantityGrams: grams, departmentEl: department })

describe('pharmacyConsumptionKpis', () => {
  it('compares the latest month with the month before', () => {
    const kpis = pharmacyConsumptionKpis([
      row('2026-10', 'Cefazolin', 600), row('2026-10', 'Meropenem', 300), row('2026-10', 'Linezolid', 100, 'Χειρουργική'),
      row('2026-09', 'Cefazolin', 400), row('2026-09', 'Meropenem', 600),
      row('2026-08', 'Cefazolin', 100, 'ΤΕΠ'),
    ])
    expect(kpis.month).toBe('2026-10')
    expect(kpis.previous).toBe('2026-09')
    expect(kpis.current).toEqual({ grams: 1000, basis: 'grams', access: 60, reserve: 10, departments: 2 })
    expect(kpis.before).toEqual({ grams: 1000, basis: 'grams', access: 40, reserve: 0, departments: 1 })
    expect(kpis.allDepartments).toBe(3)
    expect(ACCESS_TARGET).toBe(60)
  })

  it('counts the AWaRe shares in DDD when every antibiotic of the month has one', () => {
    const rows = [{ ...row('2026-10', 'Cefazolin', 300), productCode: 'CFZ' }, { ...row('2026-10', 'Piperacillin/tazobactam', 1400), productCode: 'TZP' }]
    const byDdd = pharmacyConsumptionKpis(rows, { ddd: { CFZ: 3, TZP: 14 } }).current
    expect(byDdd).toMatchObject({ basis: 'ddd', access: 50 })
    const byGrams = pharmacyConsumptionKpis(rows, { ddd: { CFZ: 3 } }).current
    expect(byGrams.basis).toBe('grams')
    expect(byGrams.access).toBe(17.6)
  })

  it('crosses the year and gives nothing without records', () => {
    expect(pharmacyConsumptionKpis([row('2026-01', 'Cefazolin', 10)]).previous).toBe('2025-12')
    expect(pharmacyConsumptionKpis([row('2026-01', 'Cefazolin', 10)]).before).toBeNull()
    expect(pharmacyConsumptionKpis([]).current).toBeNull()
  })
})
