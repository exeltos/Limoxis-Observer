// Monthly shift roster: the rules and the checker (pure, no I/O); rosterEngine builds a roster that keeps them.
// Codes: M morning 07-15, I intermediate 11-19, A afternoon 15-23, N night 23-07, R day off;
// anything else (L, S, H, U) is a leave given by hand.
//
// Hard rules (owner, 8/11/2026): at most `maxConsecutive` shifts in a row; at most `maxConsecutiveNights` nights in a
// row; after one night `restAfterNight` days off, after two or more `restAfterTwoNights`; 11 hours of rest between
// shifts (no afternoon -> morning); no morning/intermediate -> night; at least `weeklyRestDays` days off in every full
// Monday-Sunday week; at least `minWeekendOff` whole weekends off.
// Soft goals: every shift covered, wishes kept (earlier in the list = higher priority), days off in pairs (a single one
// is avoided), each person's shifts near their target (weekdays minus leave), nights and weekends shared evenly.
// The days before the period (`history`, the end of the previous roster) count for streaks and rest.

import type { AnyRecord } from '../../types/featureTypes'

// A day of the period.
export interface RosterDay { date: string, weekday: number, weekend: boolean }
// Each person's codes by date: { employeeId: { '2026-11-21': 'M' } }.
export type Assignments = Record<string, Record<string, string>>
// The people each shift needs (weekday / weekend defaults, a day's own numbers, the other shifts).
export type RosterDemand = AnyRecord
export type RosterRules = typeof DEFAULT_RULES & { longStretchExceptions?: number, [key: string]: unknown }
// A person as the rules read them: id, limits, fixed codes and wishes.
export interface RosterEmployee { id: string, name?: string, active?: boolean, fixed?: Record<string, string>, wishes?: Record<string, string>, allowed?: string[], extra?: boolean, noWeekends?: boolean, maxNights?: unknown, percent?: unknown }
export interface RosterViolation { rule: string, employeeId?: string, date?: string, detail?: string }
export type RosterHistory = Record<string, string[]>

// The four kinds of shift.
export const SHIFT_CODES = ['M', 'I', 'A', 'N']
const DAY_MS = 86400000

export const DEFAULT_RULES = {
  maxConsecutive: 5,
  maxConsecutiveNights: 2,
  restAfterNight: 1,
  restAfterTwoNights: 2,
  weeklyRestDays: 2,
  minWeekendOff: 1,
  forbidMorningToNight: true,
  balanceTolerance: 2
}

// The department's other shifts (owner, 9/11/2026) are stored with their kind: «M:1» is the hospital's shift 1
// (08:00-16:00) counted as a morning. The rules read the kind.
export const kindOf = <T extends string | null | undefined>(code: T): T | string => (typeof code === 'string' && code.length > 2 && code[1] === ':' ? code[0] : code)
// The kind of a shift by its start: before 10:00 a morning, before 13:00 an intermediate, before 20:00 an afternoon,
// else a night.
export function kindFromStart(from: unknown) {
  const hour = Number(String(from || '').split(':')[0])
  if (!Number.isFinite(hour)) return 'M'
  if (hour >= 20 || hour < 4) return 'N'
  if (hour < 10) return 'M'
  if (hour < 13) return 'I'
  return 'A'
}
export const isShift = (code: string | null | undefined) => {
  const kind = kindOf(code)
  return kind === 'M' || kind === 'I' || kind === 'A' || kind === 'N'
}
const isDay = (code: string | undefined) => code === 'M' || code === 'I'
export const isLeave = (code: string | null | undefined) => Boolean(code) && !isShift(code) && code !== 'R'
// Days off of a week: leave stands for the working days (five a week), so only leave beyond five counts as days off
// (owner, 9/11/2026); a public holiday is a day off.
export const weekOff = (week: string[]) => {
  const leave = week.filter((code) => isLeave(code) && code !== 'H').length
  return week.filter((code) => !isShift(code) && !(isLeave(code) && code !== 'H')).length + Math.max(0, leave - 5)
}

function parseISO(iso: unknown) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const toISO = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function periodDays(startISO: string, endISO: string) {
  const days: RosterDay[] = []
  const end = parseISO(endISO)
  for (let t = parseISO(startISO); t <= end; t += DAY_MS) {
    const weekday = new Date(t).getUTCDay()
    days.push({ date: toISO(t), weekday, weekend: weekday === 0 || weekday === 6 })
  }
  return days
}

// Every date from `from` to `to` (inclusive) inside the period: a leave entered «from - to».
export function datesBetween(from: string | null | undefined, to: string | null | undefined, days: RosterDay[]) {
  if (!from) return []
  const end = to && to >= from ? to : from
  return days.map((day) => day.date).filter((date) => date >= from && date <= end)
}

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The people each shift needs on a day: the day's own numbers when set, else the weekday / weekend defaults.
export function demandFor(demand: RosterDemand | null | undefined, day: RosterDay): Record<string, number> {
  const row = { ...((day.weekend ? demand?.weekend : demand?.weekday) || {}), ...(demand?.overrides?.[day.date] || {}) }
  const need: Record<string, number> = { M: Number(row.M) || 0, I: Number(row.I) || 0, A: Number(row.A) || 0, N: Number(row.N) || 0 }
  // The department's other shifts add their people to their kind.
  for (const shift of customShifts(demand)) need[kindOf(shift.code)] += customNeed(shift, day)
  return need
}
// The department's other shifts: [{ code: 'M:1', label, weekday, weekend }].
export const customShifts = (demand: RosterDemand | null | undefined): AnyRecord[] => (Array.isArray(demand?.custom) ? demand.custom.filter((shift: AnyRecord) => isShift(shift?.code) && String(shift.code).includes(':')) : [])
export const customNeed = (shift: AnyRecord, day: RosterDay) => Math.max(0, Number(day.weekend ? shift.weekend : shift.weekday) || 0)
// The same roster in kinds only (what the rules read).
const asKinds = (assignments: Assignments | null | undefined): Assignments => Object.fromEntries(Object.entries(assignments || {}).map(([id, row]) => [id, Object.fromEntries(Object.entries(row || {}).map(([date, code]) => [date, kindOf(code)]))]))

export function weekendPairs(days: RosterDay[]) {
  const pairs: [number, number][] = []
  for (let i = 0; i < days.length - 1; i += 1) if (days[i].weekday === 6 && days[i + 1].weekday === 0) pairs.push([i, i + 1])
  return pairs
}
// The first day of every full Monday-Sunday week inside the period.
export function fullWeeks(days: RosterDay[]) {
  const weeks: number[] = []
  for (let i = 0; i + 6 < days.length; i += 1) if (days[i].weekday === 1) weeks.push(i)
  return weeks
}

// Each person's target: the weekdays of the period minus their leave on weekdays (five days a week).
export function shiftTargets(days: RosterDay[], employees: RosterEmployee[] | null | undefined, weeklyRestDays = DEFAULT_RULES.weeklyRestDays) {
  // Each person's target follows the days off the roster keeps (owner, 9/11/2026): every Monday-Sunday week
  // `weeklyRestDays` days off (a part week its whole share), the rest work, less leave.
  const segments: [number, number][] = []
  for (let i = 0, from = 0; i <= days.length; i += 1) {
    if (i === days.length || (i > from && days[i].weekday === 1)) {
      segments.push([from, i])
      from = i
    }
  }
  const targets: Record<string, number> = {}
  for (const employee of employees || []) {
    const fixed: Record<string, string> = employee.fixed || {}
    let work = 0
    for (const [from, to] of segments) {
      const length = to - from
      const quota = length === 7 ? weeklyRestDays : Math.floor((length * weeklyRestDays) / 7)
      const leave = days.slice(from, to).filter((day) => isLeave(fixed[day.date])).length
      work += Math.max(0, length - quota - leave)
    }
    // Part-time: a share of the full target.
    const percent = Number(employee.percent) > 0 && Number(employee.percent) < 100 ? Number(employee.percent) : 100
    targets[employee.id] = Math.round((work * percent) / 100)
  }
  return targets
}

// The hard-rule problems of one person's row; `prefix` holds their last days before the period.
export function rowProblems(codes: string[], prefix: string[], days: RosterDay[], r: RosterRules) {
  const all = prefix.length ? [...prefix, ...codes] : codes
  const offset = prefix.length
  const problems: { rule: string, index: number }[] = []
  let streak = 0
  let nights = 0
  let restNeeded = 0
  // One stretch of a single extra shift (six in a row) is allowed once in a roster (owner, 9/11/2026).
  let exceptions = Number.isFinite(r.longStretchExceptions) ? r.longStretchExceptions as number : 1
  for (let k = 0; k < all.length; k += 1) {
    const code = all[k]
    const inside = k >= offset
    const index = k - offset
    if (isShift(code)) {
      streak += 1
      if (inside && streak === r.maxConsecutive + 1) {
        if (exceptions > 0) exceptions -= 1
        else problems.push({ rule: 'maxConsecutive', index })
      } else if (inside && streak === r.maxConsecutive + 2) problems.push({ rule: 'maxConsecutive', index })
    } else streak = 0
    const prev = all[k - 1]
    if (inside && prev === 'A' && code === 'M') problems.push({ rule: 'restHours', index })
    if (inside && r.forbidMorningToNight && isDay(prev) && code === 'N') problems.push({ rule: 'morningToNight', index })
    if (code === 'N') {
      if (nights === 0 && restNeeded > 0 && inside) problems.push({ rule: 'restAfterNight', index })
      restNeeded = 0
      nights += 1
      if (inside && nights === r.maxConsecutiveNights + 1) problems.push({ rule: 'nightsInRow', index })
      continue
    }
    if (nights > 0) {
      restNeeded = nights >= 2 ? r.restAfterTwoNights : r.restAfterNight
      nights = 0
    }
    if (isShift(code)) {
      if (restNeeded > 0 && inside) problems.push({ rule: 'restAfterNight', index })
      restNeeded = 0
    } else if (restNeeded > 0) restNeeded -= 1
  }
  if (r.weeklyRestDays > 0) {
    // Two days off a week; a week may have one more and another one less (owner, 9/11/2026), never fewer than one,
    // and the full weeks together keep two each.
    let total = 0
    let weeks = 0
    for (const start of fullWeeks(days)) {
      if (start + 6 >= codes.length) continue
      const off = weekOff(codes.slice(start, start + 7))
      total += off
      weeks += 1
      if (off < r.weeklyRestDays - 1) problems.push({ rule: 'weeklyRest', index: start + 6 })
    }
    if (total < weeks * r.weeklyRestDays) problems.push({ rule: 'weeklyRest', index: -1 })
  }
  const pairs = weekendPairs(days)
  if (pairs.length && r.minWeekendOff > 0) {
    const off = pairs.filter(([sat, sun]) => !isShift(codes[sat]) && !isShift(codes[sun])).length
    if (off < Math.min(r.minWeekendOff, pairs.length)) problems.push({ rule: 'weekendOff', index: -1 })
  }
  return problems
}

// A person's own limits (owner, 8/11/2026): `allowed` lists the shifts they may take (e.g. mornings only); none = all.
export const allowedOf = (employee: RosterEmployee | null | undefined): string[] => (Array.isArray(employee?.allowed) && employee.allowed.length ? employee.allowed as string[] : SHIFT_CODES)
// More of a person's limits: no weekends, at most so many nights in the period.
export const maxNightsOf = (employee: RosterEmployee | null | undefined) => (Number.isFinite(Number(employee?.maxNights)) && employee?.maxNights !== '' && employee?.maxNights !== null && employee?.maxNights !== undefined ? Number(employee.maxNights) : Infinity)
// May the person work `code` on `day` by their own limits?
export const personalOk = (employee: RosterEmployee | null | undefined, allowed: string[], day: RosterDay, code: string) => !isShift(code) || (allowed.includes(code) && !(employee?.noWeekends && day.weekend))
// A supernumerary person (the head of the department, owner 8/11/2026) is not counted in the shifts: mornings on
// weekdays, and a shift only where the roster cannot be made otherwise.
export const defaultExtraCode = (employee: RosterEmployee | null | undefined, day: RosterDay) => {
  const allowed = allowedOf(employee)
  if (day.weekend) return 'R'
  return allowed.includes('M') ? 'M' : allowed[0]
}

export const historyOf = (history: RosterHistory | null | undefined, id: string): string[] => (Array.isArray(history?.[id]) ? (history as RosterHistory)[id].slice(-7) : [])

export interface RosterInput { days: RosterDay[], employees: RosterEmployee[] | null | undefined, assignments: Assignments | null | undefined, demand: RosterDemand | null | undefined, rules?: Partial<RosterRules> | null, history?: RosterHistory }
export function checkRoster({ days, employees, assignments: given, demand, rules, history = {} }: RosterInput) {
  const r: RosterRules = { ...DEFAULT_RULES, ...rules }
  const violations: RosterViolation[] = []
  // Each of the department's other shifts has its own people too.
  const active0 = (employees || []).filter((employee) => employee.active !== false)
  // Intermediates are given only from the people left over after mornings, afternoons and nights (owner,
  // 9/11/2026): one missing is no problem.
  for (const shift of customShifts(demand).filter((shift) => kindOf(shift.code) !== 'I')) {
    days.forEach((day) => {
      const need = customNeed(shift, day)
      const have = active0.filter((employee) => given?.[employee.id]?.[day.date] === shift.code).length
      if (have < need && active0.some((employee) => isShift(given?.[employee.id]?.[day.date]))) violations.push({ rule: 'coverage', date: day.date, detail: `${shift.code} ${have}/${need}` })
    })
  }
  const assignments = asKinds(given)
  const active = (employees || []).filter((employee) => employee.active !== false)
  const rows = active.map((employee) => ({ employee, codes: days.map((day) => assignments?.[employee.id]?.[day.date] || '') }))
  // An empty roster (only leave and wishes entered) has nothing to check yet.
  if (!rows.some((row) => row.codes.some(isShift))) return violations
  days.forEach((day, i) => {
    const need = demandFor(demand, day)
    for (const shift of SHIFT_CODES.filter((code) => code !== 'I')) {
      const have = rows.filter((row) => row.codes[i] === shift).length
      if (have < need[shift]) violations.push({ rule: 'coverage', date: day.date, detail: `${shift} ${have}/${need[shift]}` })
    }
  })
  for (const { employee, codes } of rows) {
    const allowed = allowedOf(employee)
    codes.forEach((code, i) => {
      if (!personalOk(employee, allowed, days[i], code) && !employee.fixed?.[days[i].date]) violations.push({ rule: 'personal', employeeId: employee.id, date: days[i].date })
    })
    if (codes.filter((code) => code === 'N').length > maxNightsOf(employee)) violations.push({ rule: 'maxNights', employeeId: employee.id })
    for (const problem of rowProblems(codes, historyOf(history, employee.id), days, r)) {
      violations.push({ rule: problem.rule, employeeId: employee.id, date: problem.index >= 0 ? days[problem.index].date : undefined })
    }
  }
  // Fair share: each person's distance from their target, compared with the group's (a department with more people
  // than shifts leaves everyone a little under target, evenly).
  const targets = shiftTargets(days, active, r.weeklyRestDays)
  const gaps = rows.filter(({ employee }) => !employee.extra).map(({ employee, codes }) => ({ employee, gap: codes.filter(isShift).length - targets[employee.id] }))
  const meanGap = gaps.reduce((sum, row) => sum + row.gap, 0) / (gaps.length || 1)
  for (const { employee, gap } of gaps) {
    if (Math.abs(gap - meanGap) > r.balanceTolerance) violations.push({ rule: 'balance', employeeId: employee.id, detail: `${gap + targets[employee.id]}/${targets[employee.id]}` })
  }
  return violations
}
