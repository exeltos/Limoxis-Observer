// Shift roster, phase A (owner, 19/11/2026): real rest from the shifts' times, basic and supplementary shifts, the
// breaches and the shortages decided first, a fair share by availability, and «enough people?» before a roster.
import { describe, expect, it, vi } from 'vitest'
import { better, checkRoster, generateRoster, isShift, kindOf, periodDays } from '../src/features/rosters/rosterEngine'
import { basicDemandFor, restMinutes, rosterFeasibility, rowProblems, shiftTimesOf, DEFAULT_RULES } from '../src/features/rosters/rosterRules'
import { violationGroup } from '../src/features/rosters/rosterPageModel'
import { readSource } from './helpers/readSource'
import type { RosterEmployee } from '../src/features/rosters/rosterEngine'

vi.setConfig({ testTimeout: 60_000 })
const days = periodDays('2026-11-21', '2026-12-20')
const icuDemand = { custom: [{ code: 'I:11', label: '10:00–18:00', weekday: 1, weekend: 0 }], weekday: { A: 2, I: 0, M: 2, N: 2 }, weekend: { A: 2, I: 0, M: 2, N: 2 }, overrides: {} }
const icuStaff = (): RosterEmployee[] => Array.from({ length: 10 }, (_, k) => ({ id: `e${k}`, name: `e${k}`, active: true, ...(k === 0 ? { allowed: ['M'], extra: true, noWeekends: true } : {}) }))

describe('11 hours of real rest between shifts', () => {
  const check = (codes: string, demand = {}) => rowProblems(codes.split(''), [], days.slice(0, codes.length), { ...DEFAULT_RULES, weeklyRestDays: 0, minWeekendOff: 0, shiftTimes: shiftTimesOf(demand) }).map((p) => p.rule)
  it('reads the rest from the times of the shifts', () => {
    expect(restMinutes('A', 'M')).toBe(8 * 60)
    expect(restMinutes('A', 'I')).toBe(11 * 60)
    expect(check('AMRR')).toContain('restHours')
    expect(check('AIRR')).not.toContain('restHours')
  })
  it('a department whose afternoon ends at 20:00 may work the morning after it', () => {
    const early = { custom: [{ code: 'A:1', label: '12:00–20:00', weekday: 2, weekend: 2 }] }
    expect(shiftTimesOf(early).A).toEqual([720, 1200])
    expect(check('AMRR', early)).not.toContain('restHours')
    const late = { custom: [{ code: 'A:1', label: '14:00–22:00', weekday: 2, weekend: 2 }] }
    expect(check('AMRR', late)).toContain('restHours')
  })
})

describe('basic and supplementary shifts', () => {
  const day = days.find((d) => !d.weekend)!
  it('an intermediate is supplementary unless set basic; only a basic shift is a shortage', () => {
    expect(basicDemandFor(icuDemand, day).I).toBe(0)
    const basicI = { ...icuDemand, custom: [{ ...icuDemand.custom[0], optional: false }] }
    expect(basicDemandFor(basicI, day).I).toBe(1)
    const staff = icuStaff()
    const assignments = Object.fromEntries(staff.map((e, k) => [e.id, { [day.date]: ['M', 'M', 'A', 'A', 'N', 'N', 'R', 'R', 'R', 'R'][k] }]))
    staff[0].extra = false
    const short = (demand: object) => checkRoster({ days: [day], employees: staff, assignments, demand, rules: { weeklyRestDays: 0, minWeekendOff: 0 } }).filter((v) => v.rule === 'coverage').map((v) => v.detail)
    expect(short(icuDemand)).toEqual([])
    expect(short(basicI)).toEqual(['I:11 0/1', 'I 0/1'])
  })
})

describe('the levels: breaches, then shortages, then the rest', () => {
  it('one person less missing beats any number of smaller costs', () => {
    expect(better([0, 1, 0, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0, 0])).toBe(true)
    expect(better([0, 1, 1e6, 1e6, 1e6, 1e6, 1e6], [0, 2, 0, 0, 0, 0, 0])).toBe(true)
    expect(better([0, 5, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0])).toBe(true)
    expect(better([0, 0, 0, 0, 10, 0, 0], [0, 0, 0, 0, 20, 0, 0])).toBe(true)
  })
  it('the exceptions are recommendations, shown apart from the breaches', () => {
    for (const rule of ['thirdNight', 'shortRestAfterNights', 'longStretch', 'leaveRest', 'weekendOff']) expect(violationGroup(rule)).toBe('advice')
    for (const rule of ['restHours', 'nightsInRow', 'maxConsecutive', 'restAfterNight']) expect(violationGroup(rule)).toBe('hard')
  })
})

describe('enough people? (the ICU example)', () => {
  it('needs 180 shifts and the nine nurses give 180: no margin', () => {
    const f = rosterFeasibility(days, icuStaff(), icuDemand)
    expect(f.need).toEqual({ M: 60, I: 0, A: 60, N: 60 })
    expect(f.total).toBe(180)
    expect(f.available).toBe(180)
    expect(f.margin).toBe(0)
    expect(f.hours).toBe(false)
  })
})

describe('the ICU roster', () => {
  const made = generateRoster({ days, employees: icuStaff(), demand: icuDemand, seed: 1 })
  const regular = icuStaff().slice(1)
  it('keeps every rule that binds and covers the basic shifts', () => {
    const hard = made.violations.filter((v) => violationGroup(v.rule) === 'hard')
    expect(hard).toEqual([])
    const short = made.violations.filter((v) => v.rule === 'coverage').length
    expect(short).toBeLessThanOrEqual(2)
  })
  it('shares nights, Saturdays and Sundays by availability (within two)', () => {
    const count = (id: string, test: (code: string, i: number) => boolean) => days.filter((d, i) => test(made.assignments[id][d.date], i)).length
    for (const pick of [(c: string) => kindOf(c) === 'N', (c: string, i: number) => isShift(c) && days[i].weekday === 6, (c: string, i: number) => isShift(c) && days[i].weekday === 0]) {
      const counts = regular.map((e) => count(e.id, pick))
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(3)
    }
  })
  it('the engine compares by levels, not by one sum', () => {
    const engine = readSource('src/features/rosters/rosterEngine.ts')
    expect(engine).toContain('export const rank = (score: Score) => [score[0], score[1],')
    expect(engine).toContain('if (x[0] !== y[0] || x[1] !== y[1]) return false')
  })
})

describe('review fixes (PR #666)', () => {
  it('the checker reads the real rest from the real shifts, not their kinds', () => {
    const demand = { weekday: { M: 0, A: 0, N: 0 }, weekend: { M: 0, A: 0, N: 0 }, custom: [{ code: 'A:1', label: '15:00–00:00', weekday: 0, weekend: 0 }, { code: 'A:2', label: '12:00–20:00', weekday: 0, weekend: 0 }, { code: 'I:1', label: '10:00–18:00', weekday: 0, weekend: 0 }] }
    const two = days.slice(2, 4)
    const assignments = { x: { [two[0].date]: 'A:1', [two[1].date]: 'I:1' } }
    const rules = (v: { rule: string }[]) => v.map((item) => item.rule)
    expect(rules(checkRoster({ days: two, employees: [{ id: 'x', active: true }], assignments, demand, rules: { weeklyRestDays: 0, minWeekendOff: 0 } }))).toContain('restHours')
    const fine = { x: { [two[0].date]: 'A:2', [two[1].date]: 'I:1' } }
    expect(rules(checkRoster({ days: two, employees: [{ id: 'x', active: true }], assignments: fine, demand, rules: { weeklyRestDays: 0, minWeekendOff: 0 } }))).not.toContain('restHours')
  })
  it('a basic shift takes its people before a supplementary one of the same kind', () => {
    const day = days.find((d) => !d.weekend)!
    const demand = { weekday: { M: 0, A: 0, N: 0 }, weekend: { M: 0, A: 0, N: 0 }, custom: [{ code: 'M:2', label: '08:00–14:00', weekday: 1, weekend: 0, optional: true }, { code: 'M:1', label: '07:00–15:00', weekday: 1, weekend: 0, optional: false }] }
    const made = generateRoster({ days: [day], employees: [{ id: 'a', active: true, allowed: ['M'] }], demand, rules: { weeklyRestDays: 0, minWeekendOff: 0, maxWeeklyHours: 0 }, seed: 1, attempts: 1, iterations: 200 })
    expect(made.assignments.a[day.date]).toBe('M:1')
    expect(made.violations.filter((v) => v.rule === 'coverage')).toEqual([])
    // A supplementary shift does not count for the basic one of the same kind.
    const wrong = checkRoster({ days: [day], employees: [{ id: 'a', active: true }], assignments: { a: { [day.date]: 'M:2' } }, demand, rules: { weeklyRestDays: 0, minWeekendOff: 0 } })
    expect(wrong.filter((v) => v.rule === 'coverage').map((v) => v.detail)).toContain('M 0/1')
  })
  it('availability follows the department’s days off a week', () => {
    const staff = icuStaff()
    expect(rosterFeasibility(days, staff, icuDemand, 3).available).toBeLessThan(rosterFeasibility(days, staff, icuDemand).available)
    expect(readSource('src/features/rosters/RostersPage.tsx')).toContain('rosterFeasibility(days, engineEmployees.map(m => ({ ...m, extra: Boolean(m.extra) })), roster?.demand, rules.weeklyRestDays)')
  })
})
