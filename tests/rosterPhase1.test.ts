// Shift roster, phase 1 (owner, 18/11/2026): public holidays, «no nights», a shift the person must not work, a wished
// shift, the weekly hours and the checks in three groups.
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { checkRoster, demandFor, generateRoster, periodDays } from '../src/features/rosters/rosterEngine'
import { greekHolidays, holidayName, markHolidays, orthodoxEaster } from '../src/features/rosters/rosterHolidays'
import { personalOk, shiftHours, weeklyHoursLimit, weeklyHoursProblems } from '../src/features/rosters/rosterRules'
import { violationGroup } from '../src/features/rosters/rosterPageModel'
import { readSource } from './helpers/readSource'
import type { RosterEmployee } from '../src/features/rosters/rosterEngine'

vi.setConfig({ testTimeout: 30_000 })
const root = path.resolve(__dirname, '..')
const read = (file: string) => readSource(path.join(root, file))

describe('public holidays', () => {
  it('finds the Orthodox Easter and the movable holidays', () => {
    expect(orthodoxEaster(2025)).toBe('2025-04-20')
    expect(orthodoxEaster(2026)).toBe('2026-04-12')
    expect(orthodoxEaster(2027)).toBe('2027-05-02')
    const holidays = greekHolidays(2026)
    expect(holidays['2026-02-23']?.[0]).toBe('Καθαρά Δευτέρα')
    expect(holidays['2026-04-10']?.[0]).toBe('Μεγάλη Παρασκευή')
    expect(holidays['2026-04-13']?.[0]).toBe('Δευτέρα του Πάσχα')
    expect(holidays['2026-06-01']?.[0]).toBe('Αγίου Πνεύματος')
    expect(Object.keys(holidays)).toHaveLength(13)
  })

  it('marks holidays and the local feast as weekend days, with their own numbers of people', () => {
    const days = markHolidays(periodDays('2026-12-21', '2027-01-10'), { date: '01-07', name: 'Αγίου Ιωάννου' })
    const christmas = days.find(day => day.date === '2026-12-25')!
    expect(christmas).toMatchObject({ holiday: 'Χριστούγεννα', weekend: true })
    expect(days.find(day => day.date === '2027-01-07')).toMatchObject({ holiday: 'Αγίου Ιωάννου', weekend: true })
    expect(days.find(day => day.date === '2026-12-23')?.holiday).toBeUndefined()
    expect(holidayName('2026-12-25', null, 'en')).toBe('Christmas Day')
    const demand = { weekday: { M: 4, A: 3, N: 2 }, weekend: { M: 2, A: 2, N: 2 } }
    expect(demandFor(demand, christmas)).toMatchObject({ M: 2, A: 2, N: 2 })
    expect(demandFor({ ...demand, holiday: { M: 1, A: 1, N: 1 } }, christmas)).toMatchObject({ M: 1, A: 1, N: 1 })
  })
})

describe('the person’s hard limits', () => {
  const [day] = periodDays('2026-12-01', '2026-12-01')
  const later = periodDays('2027-02-01', '2027-02-01')[0]
  it('gives no night while «no nights» holds, and none of a shift the person must not work that day', () => {
    const employee: RosterEmployee = { id: 'a', noNights: { reason: 'pregnancy', until: '2027-01-31' }, forbid: { '2026-12-01': ['A'] } }
    expect(personalOk(employee, ['M', 'I', 'A', 'N'], day, 'N')).toBe(false)
    expect(personalOk(employee, ['M', 'I', 'A', 'N'], later, 'N')).toBe(true)
    expect(personalOk(employee, ['M', 'I', 'A', 'N'], day, 'A')).toBe(false)
    expect(personalOk(employee, ['M', 'I', 'A', 'N'], day, 'M')).toBe(true)
    expect(personalOk({ id: 'b', noNights: { reason: 'medical' } }, ['M', 'I', 'A', 'N'], later, 'N')).toBe(false)
  })

  it('keeps them in an automatic roster', () => {
    const days = periodDays('2026-12-07', '2026-12-20')
    const people: RosterEmployee[] = Array.from({ length: 8 }, (_, index) => ({ id: `p${index}`, active: true, fixed: {}, wishes: {} }))
    people[0].noNights = { reason: 'breastfeeding' }
    people[1].forbid = { '2026-12-09': ['M', 'A'] }
    const result = generateRoster({ days, employees: people, demand: { weekday: { M: 2, A: 2, N: 1 }, weekend: { M: 1, A: 1, N: 1 } }, seed: 3, attempts: 1, iterations: 3000 })
    expect(days.some(d => result.assignments.p0[d.date] === 'N')).toBe(false)
    expect(['M', 'A']).not.toContain(result.assignments.p1['2026-12-09'])
    expect(result.violations.filter(v => v.rule === 'personal')).toEqual([])
  })
})

describe('a wished shift', () => {
  it('is given where the roster allows', () => {
    const days = periodDays('2026-12-07', '2026-12-13')
    const people: RosterEmployee[] = Array.from({ length: 4 }, (_, index) => ({ id: `w${index}`, active: true, fixed: {}, wishes: {} }))
    people[0].wishes = { '2026-12-09': 'A' }
    const result = generateRoster({ days, employees: people, demand: { weekday: { M: 1, A: 1, N: 0 }, weekend: { M: 1, A: 1, N: 0 } }, seed: 5, attempts: 2, iterations: 4000 })
    expect(result.assignments.w0['2026-12-09']).toBe('A')
  })
})

describe('weekly hours', () => {
  it('counts eight hours a shift and the department’s other shifts by their times', () => {
    expect(shiftHours('M')).toBe(8)
    expect(shiftHours('R')).toBe(0)
    expect(shiftHours('M:1', { custom: [{ code: 'M:1', label: '07:00–19:00' }] })).toBe(12)
    expect(shiftHours('N:2', { custom: [{ code: 'N:2', label: '19:00–07:00' }] })).toBe(12)
  })

  it('allows one week of one shift more, never an average above the limit; part-time in proportion', () => {
    const days = periodDays('2026-12-07', '2026-12-20')
    const six = ['M', 'M', 'M', 'M', 'M', 'M', 'R']
    const four = ['M', 'M', 'M', 'M', 'R', 'R', 'R']
    expect(weeklyHoursProblems([...six, ...four], days, 40)).toEqual([])
    expect(weeklyHoursProblems([...six, ...six], days, 40)).toContain(-1)
    expect(weeklyHoursProblems(['M', 'M', 'M', 'M', 'M', 'M', 'M', ...four], days, 40)).toContain(6)
    expect(weeklyHoursLimit({ id: 'x', percent: 50 }, { maxWeeklyHours: 40 })).toBe(24)
    expect(weeklyHoursLimit({ id: 'x' }, { maxWeeklyHours: 0 })).toBe(0)
  })

  it('reports a week over the limit as a hard breach', () => {
    const days = periodDays('2026-12-07', '2026-12-13')
    const assignments = { a: Object.fromEntries(days.map(day => [day.date, 'M:1'])) }
    const violations = checkRoster({ days, employees: [{ id: 'a', active: true }], assignments, demand: { custom: [{ code: 'M:1', label: '07:00–19:00' }] }, rules: { maxWeeklyHours: 40 } })
    expect(violations.some(v => v.rule === 'weeklyHours')).toBe(true)
    expect(violationGroup('weeklyHours')).toBe('hard')
    expect(violationGroup('coverage')).toBe('coverage')
    expect(violationGroup('balance')).toBe('advice')
  })
})

describe('the screen', () => {
  it('has the holidays column, «no nights», the new kinds of wishes and the three groups of checks', () => {
    const panels = read('src/features/rosters/RosterPanels.tsx')
    expect(panels).toContain("(['weekday', 'weekend', 'holiday'] as const)")
    expect(panels).toContain("tx('Χωρίς νύχτες', 'No nights')")
    const page = read('src/features/rosters/RostersPage.tsx')
    expect(page).toContain("tx('Όχι βάρδια (υποχρεωτικό)', 'Not this shift (mandatory)')")
    expect(page).toContain("tx('Επιθυμία βάρδιας', 'Wishes a shift')")
    // The groups renamed (owner, 19/11/2026): binding conflict, short of staff, recommendation, and «Πλήρης κάλυψη».
    const sheet = read('src/features/rosters/RosterSheet.tsx')
    expect(sheet).toContain("tx('Υποχρεωτική σύγκρουση', 'Binding conflict')")
    expect(sheet).toContain("tx('Έλλειψη στελέχωσης', 'Short of staff')")
    expect(sheet).toContain("tx('Πλήρης κάλυψη', 'Full cover')")
  })
})

describe('Roster Phase 1: review fixes', () => {
  it('a mandatory restriction is reported even on a shift entered by hand', async () => {
    const { mandatoryOk } = await import('../src/features/rosters/rosterRules')
    const day = { date: '2026-12-25', weekend: false } as never
    expect(mandatoryOk({ noNights: { reason: 'medical' } } as never, day, 'N')).toBe(false)
    expect(mandatoryOk({ forbid: { '2026-12-25': ['M'] } } as never, day, 'M')).toBe(false)
    expect(mandatoryOk({ forbid: { '2026-12-25': ['M'] } } as never, day, 'A')).toBe(true)
    const rules = readSource('src/features/rosters/rosterRules.ts')
    expect(rules).toContain('(!employee.fixed?.[days[i].date] || !mandatoryOk(employee, days[i], code))')
  })
  it('the local feast keeps «25/1» as typed and entering a restriction again removes it', () => {
    const panels = readSource('src/features/rosters/RosterPanels.tsx')
    expect(panels).toContain('done ? /^(\\d{1,2})\\/(\\d{1,2})$/ : /^(\\d{1,2})\\/(\\d{2})$/')
    const page = readSource('src/features/rosters/RostersPage.tsx')
    expect(page).toContain("const removing = leave.code === 'forbid' && dates.every(")
  })
})
