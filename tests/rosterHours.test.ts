// Shift roster, phase 2 (owner, 18/11/2026): the automatic roster counts each shift by its real hours, so a
// department of twelve-hour shifts gets fewer shifts a week and keeps the weekly hours.
import { describe, expect, it, vi } from 'vitest'
import { generateRoster, isShift, periodDays } from '../src/features/rosters/rosterEngine'
import { shiftHours, weeklyHoursProblems } from '../src/features/rosters/rosterRules'
import { readSource } from './helpers/readSource'
import type { RosterEmployee } from '../src/features/rosters/rosterEngine'

vi.setConfig({ testTimeout: 60_000 })
const days = periodDays('2026-12-07', '2027-01-03')
const people = (count: number): RosterEmployee[] => Array.from({ length: count }, (_, k) => ({ id: `e${k}`, name: `Μέλος ${k}`, active: true }))

describe('twelve-hour shifts', () => {
  const demand = { weekday: { M: 0, A: 0, N: 0 }, weekend: { M: 0, A: 0, N: 0 }, custom: [{ code: 'M:1', label: '07:00–19:00', weekday: 2, weekend: 2 }, { code: 'N:1', label: '19:00–07:00', weekday: 2, weekend: 2 }] }
  const made = generateRoster({ days, employees: people(10), demand, rules: { maxWeeklyHours: 40 }, seed: 3, attempts: 2, iterations: 6000 })

  it('keeps every full-time person within the weekly hours', () => {
    expect(made.violations.filter((v) => v.rule === 'weeklyHours')).toEqual([])
    for (const id of Object.keys(made.assignments)) {
      const codes = days.map((day) => made.assignments[id][day.date] || '')
      expect(weeklyHoursProblems(codes, days, 40, (code) => shiftHours(code, demand))).toEqual([])
      const average = codes.reduce((sum, code) => sum + shiftHours(code, demand), 0) / 4
      expect(average).toBeGreaterThanOrEqual(30)
      expect(average).toBeLessThanOrEqual(40)
      // Most shifts are the department's own twelve-hour ones (a plain kind is a person beyond the need).
      expect(codes.filter((code) => code.includes(':')).length).toBeGreaterThanOrEqual(codes.filter(isShift).length - 3)
    }
  })

  it('an eight-hour department keeps five shifts a week', () => {
    const eight = generateRoster({ days, employees: people(14), demand: { weekday: { M: 3, A: 3, N: 2 }, weekend: { M: 2, A: 2, N: 2 } }, rules: { maxWeeklyHours: 40 }, seed: 5, attempts: 1, iterations: 4000 })
    expect(eight.violations.filter((v) => v.rule === 'weeklyHours')).toEqual([])
    const shifts = Object.values(eight.assignments).map((row) => Object.values(row).filter(isShift).length)
    expect(Math.max(...shifts)).toBeGreaterThanOrEqual(19)
  })

  it('the engine reads the real hours while it builds, not eight a shift', () => {
    const engine = readSource('src/features/rosters/rosterEngine.ts')
    expect(engine).toContain('const hours = kindHoursOf(days, demand)')
    expect(engine).toContain('weeklyHoursProblems(s.codes, days, s.hoursLimit, (code, i) =>')
  })
})
