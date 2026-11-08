import { describe, it, expect } from 'vitest'
import { checkRoster, datesBetween, demandFor, generateRoster, isShift, periodDays, shiftTargets } from '../src/features/rosters/rosterEngine'

// The department's shift roster (owner, 8/11/2026): rules and the automatic generator.
const SHIFTS = ['M', 'I', 'A', 'N']
const days = periodDays('2026-10-21', '2026-11-20')
const demand = { weekday: { M: 2, A: 2, N: 1 }, weekend: { M: 2, A: 2, N: 1 } }
const leaveDays = datesBetween('2026-11-11', '2026-11-17', days)
const employees = [
  ...Array.from({ length: 10 }, (_, index) => ({ id: `n${index + 1}`, name: `Nurse ${index + 1}`, active: true, fixed: {}, wishes: {} })),
  { id: 'n11', name: 'Inactive nurse', active: false, fixed: {}, wishes: {} }
]
employees[2].fixed = Object.fromEntries(leaveDays.map((date) => [date, 'L']))
employees[4].wishes = { '2026-10-30': 'R' }
employees[5].fixed = { '2026-10-25': 'M' }
const activeIds = employees.filter((employee) => employee.active).map((employee) => employee.id)
const result = generateRoster({ days, employees, demand, seed: 7 })
const codesOf = (id) => days.map((day) => result.assignments[id][day.date])

describe('periodDays and leave ranges', () => {
  it('spans 21/10/2026 to 20/11/2026 with weekend flags', () => {
    expect(days).toHaveLength(31)
    expect(days[0]).toEqual({ date: '2026-10-21', weekday: 3, weekend: false })
    expect(days.filter((day) => day.weekend)).toHaveLength(8)
  })
  it('turns a leave «from - to» into the dates inside the period', () => {
    expect(leaveDays).toHaveLength(7)
    expect(datesBetween('2026-11-19', '2026-11-25', days)).toEqual(['2026-11-19', '2026-11-20'])
  })
  it('takes the day’s own numbers over the defaults', () => {
    expect(demandFor({ ...demand, overrides: { '2026-10-21': { M: 4 } } }, days[0])).toEqual({ M: 4, I: 0, A: 2, N: 1 })
  })
  it('sets each target to the weekdays minus the leave', () => {
    const targets = shiftTargets(days, employees)
    expect(targets.n1).toBe(23)
    expect(targets.n3).toBe(18)
  })
})

describe('generateRoster', () => {
  it('covers every shift and keeps every rule', () => {
    expect(result.violations).toEqual([])
    for (const day of days) for (const shift of SHIFTS) expect(result.coverage[day.date][shift]).toBeGreaterThanOrEqual(demandFor(demand, day)[shift])
  })

  it('keeps the leave, the hand-set shift and the wish', () => {
    for (const date of leaveDays) expect(result.assignments.n3[date]).toBe('L')
    expect(result.assignments.n6['2026-10-25']).toBe('M')
    expect(isShift(result.assignments.n5['2026-10-30'])).toBe(false)
  })

  it('gives at most two nights in a row, then the days off', () => {
    for (const id of activeIds) {
      const codes = codesOf(id).join('')
      expect(codes).not.toMatch(/NNN/)
      expect(codes).not.toMatch(/N[MIA]/)
      expect(codes).not.toMatch(/NNR[MIAN]/)
      expect(codes).not.toMatch(/AM/)
      expect(codes).not.toMatch(/[MI]N/)
      expect(codes).not.toMatch(/[MIAN]{6}/)
    }
  })

  it('never gives an intermediate shift to a department without them', () => {
    for (const id of activeIds) expect(codesOf(id)).not.toContain('I')
  })

  it('shares the shifts evenly and keeps days off mostly in pairs', () => {
    const totals = activeIds.filter((id) => id !== 'n3').map((id) => result.totals[id])
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(2)
    const singles = activeIds.reduce((count, id) => count + (codesOf(id).join('').match(/[MIAN]R(?=[MIAN])/g) || []).length, 0)
    expect(singles).toBeLessThanOrEqual(18)
  })

  it('covers the intermediate shift when the department asks for it', () => {
    const withI = { weekday: { M: 2, I: 1, A: 2, N: 1 }, weekend: { M: 2, A: 2, N: 1 } }
    const staff = Array.from({ length: 11 }, (_, index) => ({ id: `i${index}`, active: true }))
    const made = generateRoster({ days, employees: staff, demand: withI, seed: 3 })
    expect(made.violations).toEqual([])
    for (const day of days) {
      if (day.weekend) expect(made.coverage[day.date].I).toBe(0)
      else expect(made.coverage[day.date].I).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('checkRoster', () => {
  const one = [{ id: 'x', active: true }]
  const check = (codes, history = []) =>
    checkRoster({ days: days.slice(0, codes.length), employees: one, assignments: { x: Object.fromEntries(codes.split('').map((code, i) => [days[i].date, code])) }, demand: {}, rules: { minWeekendOff: 0, weeklyRestDays: 0 }, history: { x: history } }).map((v) => v.rule)

  it('flags three nights, a shift right after a night and only one day off after two nights', () => {
    expect(check('NNNRR')).toContain('nightsInRow')
    expect(check('NMRR')).toContain('restAfterNight')
    expect(check('NNRMR')).toContain('restAfterNight')
    expect(check('NNRRM')).not.toContain('restAfterNight')
  })
  it('flags afternoon then morning, and morning then night', () => {
    expect(check('AMRR')).toContain('restHours')
    expect(check('MNRR')).toContain('morningToNight')
  })
  it('reads the end of the previous roster', () => {
    expect(check('MRR', ['N', 'N'])).toContain('restAfterNight')
    expect(check('MRR', ['N', 'N', 'R', 'R'])).toEqual([])
    expect(check('MMMR', ['M', 'M', 'M'])).toContain('maxConsecutive')
  })
  it('flags a week with fewer than two days off', () => {
    const rules = { minWeekendOff: 0 }
    const monday = days.findIndex((day) => day.weekday === 1)
    const week = days.slice(monday, monday + 7)
    const codes = 'MMMMMMR'
    const found = checkRoster({ days: week, employees: one, assignments: { x: Object.fromEntries(codes.split('').map((code, i) => [week[i].date, code])) }, demand: {}, rules }).map((v) => v.rule)
    expect(found).toContain('weeklyRest')
  })
})

describe('a person’s own limits (owner, 8/11/2026)', () => {
  it('gives the head mornings only and someone else no nights', () => {
    const staff = Array.from({ length: 11 }, (_, index) => ({ id: `p${index}`, active: true }))
    staff[0].allowed = ['M']
    staff[1].allowed = ['M', 'A']
    const made = generateRoster({ days, employees: staff, demand, seed: 5 })
    const codes = (id) => days.map((day) => made.assignments[id][day.date])
    expect(codes('p0').filter(isShift).every((code) => code === 'M')).toBe(true)
    expect(codes('p1')).not.toContain('N')
    expect(made.violations.filter((v) => v.rule === 'personal')).toEqual([])
  })
  it('flags a shift a person may not take', () => {
    const found = checkRoster({ days: days.slice(0, 2), employees: [{ id: 'x', active: true, allowed: ['M'] }], assignments: { x: { [days[0].date]: 'N' } }, demand: {}, rules: { minWeekendOff: 0, weeklyRestDays: 0 } })
    expect(found.map((v) => v.rule)).toContain('personal')
  })
})

describe('supernumerary and other personal limits (owner, 8/11/2026)', () => {
  const p = periodDays('2026-11-21', '2026-12-20')
  const staff = Array.from({ length: 9 }, (_, index) => ({ id: `s${index}`, active: true }))
  staff[0] = { ...staff[0], extra: true, allowed: ['M'] }
  staff[1] = { ...staff[1], noWeekends: true }
  staff[2] = { ...staff[2], maxNights: 2 }
  staff[3] = { ...staff[3], percent: 50 }
  const made = generateRoster({ days: p, employees: staff, demand, seed: 9 })
  const row = (id) => p.map((day) => made.assignments[id][day.date])
  it('keeps the supernumerary on weekday mornings and the others near two days off a week', () => {
    expect(row('s0').filter((code) => code === 'M').length).toBeGreaterThanOrEqual(18)
    for (const id of ['s4', 's5', 's6']) expect(row(id).filter((code) => code === 'R').length).toBeLessThanOrEqual(11)
  })
  it('keeps no weekends, the night cap and part-time', () => {
    p.forEach((day, i) => { if (day.weekend) expect(isShift(row('s1')[i])).toBe(false) })
    expect(row('s2').filter((code) => code === 'N').length).toBeLessThanOrEqual(2)
    expect(shiftTargets(p, staff).s3).toBe(Math.round(shiftTargets(p, [{ id: 'x' }]).x / 2))
    expect(made.violations.filter((v) => ['personal', 'maxNights'].includes(v.rule))).toEqual([])
  })
})

describe('days off around a leave (owner, 8/11/2026)', () => {
  it('gives two days off before and after a leave where the roster allows', () => {
    const staff = Array.from({ length: 11 }, (_, index) => ({ id: `l${index}`, active: true, fixed: {} }))
    staff[3].fixed = Object.fromEntries(datesBetween('2026-11-02', '2026-11-06', days).map((date) => [date, 'L']))
    const made = generateRoster({ days, employees: staff, demand, seed: 4 })
    for (const date of ['2026-10-31', '2026-11-01', '2026-11-07', '2026-11-08']) expect(isShift(made.assignments.l3[date])).toBe(false)
  })
})
