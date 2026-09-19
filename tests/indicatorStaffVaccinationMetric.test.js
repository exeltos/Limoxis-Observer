import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { indicatorDefinitionRows } from '../src/features/indicators/indicatorDemoData'
import { employeeVaccinations } from '../src/features/employees/employeeDemoData'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

function storage() {
  const values = new Map()
  return {
    get length() { return values.size },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    values,
  }
}

describe('Staff vaccination coverage indicator counts influenza only (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
  })

  it('the demo seed has at least one non-influenza vaccination that must not count', () => {
    expect(employeeVaccinations.some(x => !/γρίπ|influenza|flu/i.test(x.vaccine))).toBe(true)
  })

  it('only counts employees with an influenza vaccination record', () => {
    const metrics = collectIndicatorMetrics()
    const expectedFluVaccinated = new Set(
      employeeVaccinations.filter(x => /γρίπ|influenza|flu/i.test(x.vaccine)).map(x => x.employeeId)
    ).size
    expect(expectedFluVaccinated).toBeGreaterThan(0)
    expect(expectedFluVaccinated).toBeLessThan(new Set(employeeVaccinations.map(x => x.employeeId)).size + 1)
    expect(metrics.active_staff_with_vaccination).toBe(expectedFluVaccinated)
  })

  it('excludes the employee whose only record is a non-influenza vaccine', () => {
    const hepBOnly = employeeVaccinations.find(x => x.vaccine === 'Hepatitis B')
    const hasFluToo = employeeVaccinations.some(x => x.employeeId === hepBOnly.employeeId && /γρίπ|influenza|flu/i.test(x.vaccine))
    expect(hasFluToo).toBe(false)
  })

  it('labels the system indicator definition as influenza-specific coverage', () => {
    const def = indicatorDefinitionRows.find(row => row.indicator_key === 'staff-vaccination')
    expect(def.title_el).toContain('αντιγριπικός')
    expect(def.title_en.toLowerCase()).toContain('influenza')
    expect(def.numerator_metric).toBe('active_staff_with_vaccination')
    expect(def.denominator_metric).toBe('active_staff')
  })
})
