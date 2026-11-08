import { describe, it, expect } from 'vitest'
import { periodDays, generateRoster, checkRoster } from '../src/features/rosters/rosterEngine'

const SHIFTS = ['M', 'A', 'N']
const days = periodDays('2026-10-21', '2026-11-20')
const demand = { weekday: { M: 2, A: 2, N: 1 }, weekend: { M: 2, A: 2, N: 1 } }

const leaveDays = periodDays('2026-11-11', '2026-11-17').map((day) => day.date)
const employees = [
  ...Array.from({ length: 9 }, (_, index) => ({ id: `n${index + 1}`, name: `Nurse ${index + 1}`, active: true, fixed: {}, wishes: {} })),
  { id: 'n10', name: 'Inactive nurse', active: false, fixed: {}, wishes: {} }
]
employees[2].fixed = Object.fromEntries(leaveDays.map((date) => [date, 'L']))
employees[4].wishes = { '2026-10-30': 'R' }
employees[5].fixed = { '2026-10-25': 'M' }

const activeIds = employees.filter((employee) => employee.active).map((employee) => employee.id)
const run = (seed = 7) => generateRoster({ days, employees, demand, seed })

describe('periodDays', () => {
  it('spans 21/10/2026 to 20/11/2026 with weekend flags', () => {
    expect(days).toHaveLength(31)
    expect(days[0]).toEqual({ date: '2026-10-21', weekday: 3, weekend: false })
    expect(days[30].date).toBe('2026-11-20')
    expect(days.find((day) => day.date === '2026-10-24')).toMatchObject({ weekday: 6, weekend: true })
    expect(days.find((day) => day.date === '2026-10-25')).toMatchObject({ weekday: 0, weekend: true })
    expect(days.filter((day) => day.weekend)).toHaveLength(8)
  })
})

describe('generateRoster (ICU-like ward)', () => {
  const result = run()
  const codesOf = (id) => days.map((day) => result.assignments[id][day.date])

  it('produces no violations and full coverage', () => {
    expect(result.violations).toEqual([])
    for (const day of days) {
      const need = day.weekend ? demand.weekend : demand.weekday
      for (const shift of SHIFTS) expect(result.coverage[day.date][shift]).toBeGreaterThanOrEqual(need[shift])
    }
  })

  it('gives every active nurse a code for every day', () => {
    for (const id of activeIds) {
      for (const code of codesOf(id)) expect(['M', 'A', 'N', 'R', 'L']).toContain(code)
      expect(result.totals[id]).toBe(codesOf(id).filter((code) => SHIFTS.includes(code)).length)
    }
  })

  it('respects transition and consecutive rules', () => {
    for (const id of activeIds) {
      const codes = codesOf(id)
      let streak = 0
      codes.forEach((code, i) => {
        if (code === 'N') expect(codes[i + 1]).not.toBe('M')
        if (code === 'M') expect(codes[i + 1]).not.toBe('N')
        streak = SHIFTS.includes(code) ? streak + 1 : 0
        expect(streak).toBeLessThanOrEqual(5)
      })
    }
  })

  it('gives each active nurse at least one full weekend off', () => {
    for (const id of activeIds) {
      const codes = codesOf(id)
      const off = days.some((day, i) => day.weekday === 6 && i + 1 < days.length
        && !SHIFTS.includes(codes[i]) && !SHIFTS.includes(codes[i + 1]))
      expect(off).toBe(true)
    }
  })

  it('balances shifts and gives fewer to the nurse on leave', () => {
    const others = activeIds.filter((id) => id !== 'n3').map((id) => result.totals[id])
    expect(Math.max(...others) - Math.min(...others)).toBeLessThanOrEqual(2)
    expect(result.totals.n3).toBeLessThan(Math.min(...others))
  })

  it('keeps fixed codes, honours the wish and leaves the inactive nurse empty', () => {
    for (const date of leaveDays) expect(result.assignments.n3[date]).toBe('L')
    expect(result.assignments.n6['2026-10-25']).toBe('M')
    expect(result.assignments.n5['2026-10-30']).toBe('R')
    expect(result.assignments.n10).toEqual({})
    expect(result.totals.n10).toBe(0)
  })

  it('is deterministic for the same seed', () => {
    expect(run(7)).toEqual(result)
  })

  it('runs fast for 30 employees', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({ id: `e${index}`, active: true, fixed: {}, wishes: {} }))
    const bigDemand = { weekday: { M: 6, A: 5, N: 4 }, weekend: { M: 5, A: 4, N: 4 } }
    const started = performance.now()
    const big = generateRoster({ days, employees: many, demand: bigDemand, seed: 3 })
    expect(performance.now() - started).toBeLessThan(500)
    expect(big.violations.filter((violation) => violation.rule === 'coverage')).toEqual([])
  })
})

describe('checkRoster', () => {
  it('detects a manual night-to-morning and a 6-day streak', () => {
    const { assignments } = run()
    const edited = JSON.parse(JSON.stringify(assignments))
    edited.n1['2026-10-21'] = 'N'
    edited.n1['2026-10-22'] = 'M'
    for (const day of days.slice(10, 16)) edited.n2[day.date] = 'A'
    const violations = checkRoster({ days, employees, assignments: edited, demand })
    expect(violations).toContainEqual(expect.objectContaining({ rule: 'nightToMorning', employeeId: 'n1', date: '2026-10-22' }))
    expect(violations).toContainEqual(expect.objectContaining({ rule: 'maxConsecutive', employeeId: 'n2' }))
  })

  it('reports coverage instead of throwing when staff is too few', () => {
    const few = employees.slice(0, 3)
    const result = generateRoster({ days, employees: few, demand, seed: 1 })
    expect(result.violations.some((violation) => violation.rule === 'coverage')).toBe(true)
    for (const employee of few) expect(Object.keys(result.assignments[employee.id])).toHaveLength(31)
  })
})

describe('intermediate shift (I, 11-19)', () => {
  const withI = { weekday: { M: 2, I: 1, A: 2, N: 1 }, weekend: { M: 2, I: 0, A: 2, N: 1 } }
  const staff = Array.from({ length: 11 }, (_, index) => ({ id: `i${index + 1}`, name: `Nurse ${index + 1}`, active: true, fixed: {}, wishes: {} }))
  const result = generateRoster({ days, employees: staff, demand: withI, seed: 3 })

  it('covers the intermediate shift on weekdays only', () => {
    for (const day of days) expect(result.coverage[day.date].I).toBeGreaterThanOrEqual(day.weekend ? 0 : 1)
    expect(result.violations.filter((v) => v.rule === 'coverage')).toEqual([])
  })

  it('never puts an intermediate shift next to a night', () => {
    for (const { id } of staff) {
      const codes = days.map((day) => result.assignments[id][day.date])
      codes.forEach((code, i) => {
        if (code === 'N') expect(codes[i + 1]).not.toBe('I')
        if (code === 'I') expect(codes[i + 1]).not.toBe('N')
      })
    }
  })

  it('reports night followed by intermediate', () => {
    const assignments = { x: { [days[0].date]: 'N', [days[1].date]: 'I' } }
    const found = checkRoster({ days: days.slice(0, 2), employees: [{ id: 'x', active: true }], assignments, demand: {}, rules: { minWeekendOff: 0 } })
    expect(found.map((v) => v.rule)).toContain('nightToMorning')
  })
})
