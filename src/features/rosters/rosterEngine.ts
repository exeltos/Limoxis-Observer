// Monthly shift roster generator (pure, no I/O): builds a roster that keeps the rules of rosterRules.
// The rules, the checker and the calendar helpers live in rosterRules; this module re-exports them.
import { allowedOf, basicDemandFor, checkRoster, isOptionalShift, DEFAULT_RULES, customNeed, customShifts, defaultExtraCode, demandFor, fullWeeks, historyOf, isLeave, isShift, kindOf, maxNightsOf, mulberry32, personalOk, rowProblems, SHIFT_CODES, shiftHours, shiftTargets, shiftTimesOf, weekendPairs, weekOff, weeklyHoursLimit, weeklyHoursProblems } from './rosterRules'

import type { Assignments, RosterDay, RosterDemand, RosterEmployee, RosterHistory, RosterRules, RosterViolation } from './rosterRules'

export type { Assignments, RosterDay, RosterDemand, RosterEmployee, RosterHistory, RosterRules, RosterViolation } from './rosterRules'
export { SHIFT_CODES, DEFAULT_RULES, kindOf, kindFromStart, isShift, isLeave, periodDays, datesBetween, demandFor, customShifts, customNeed, shiftTargets, defaultExtraCode, checkRoster } from './rosterRules'

// One person during the build: their codes and what the search reads (the totals are set by scoreOf).
interface Staff {
  employee: RosterEmployee
  extra: boolean
  pattern: string[]
  nightsCap: number
  codes: string[]
  locked: boolean[]
  prefix: string[]
  wish: boolean[]
  // A shift the person would like that day (owner, 18/11/2026), or ''.
  wishShift: string[]
  wishWeight: number
  // Weekly hours limit (0 = not checked).
  hoursLimit: number
  // The hours of each kind of shift on each day (8, or the department's own shift of that kind, e.g. 12).
  hours: Record<string, number>[]
  target: number
  allowed: string[]
  reserved: boolean[]
  gap: number
  nights: number
  weekendWork: number
  kinds: Record<string, number>
  weekendNights: number
  carry?: number
  longUsed?: boolean
  borrowed?: boolean
  keep?: Set<number>
}
// Days off chosen for a week, with their cost; `long` uses the one allowed stretch of six.
interface Combo { days: number[], value: number, long: boolean }
interface Move { score: Score, codes: string[][] }
interface BuildState { staff: Staff[], days: RosterDay[], dailyNeed: Record<string, number>[], dailyBasic: Record<string, number>[], r: RosterRules, weekendIdx: Set<number>, weeks: number[] }
export interface RosterResult { assignments: Assignments, violations: RosterViolation[], score: number, levels?: number[], [key: string]: unknown }

// The score of a whole roster, by levels compared in order (owner, 19/11/2026): a lower level never outweighs a
// higher one, so many small preferences cannot cost a shift its people.
//   0 breaches of the rules that bind (they make the roster not allowed)
//   1 people missing from the basic shifts (a missing night counts double)
//   2 distance from each person's target
//   3 a fair share: shifts, mornings, afternoons, nights, Saturdays, Sundays, holidays, by each person's availability
//   4 the quality of the rest: single days off, day off–shift–day off, weeks of one or four days off, the days around
//     a leave, nights in pairs, a sixth day or a third night
//   5 wishes
//   6 supplementary shifts, people beyond the need and the supernumerary's own pattern
// The breaches and the shortages decide strictly, in that order; below them the levels are weighed together, each
// far more than the next (the target ×10), as the owner's levels allow within one level.
export type Score = number[]
export const LEVELS = 7
export const rank = (score: Score) => [score[0], score[1], score[2] * 10 + score[3] + score[4] + score[5] + score[6]]
// Is `a` better than `b`? The first rank where they differ decides.
export function better(a: Score, b: Score) {
  const x = rank(a)
  const y = rank(b)
  for (let k = 0; k < x.length; k += 1) {
    if (x[k] < y[k] - 1e-9) return true
    if (x[k] > y[k] + 1e-9) return false
  }
  return false
}
// The exceptions (owner, 19/11/2026: one day off after two nights, a third night, a second stretch of six) are taken
// only to cover a basic shift: they weigh at the level of the shortages, less than a person missing.
const EXCEPTION_COST: Record<string, number> = { shortRestAfterNights: 0.5, thirdNight: 0.6, longStretch: 0.4 }
const ADVICE_COST: Record<string, number> = { weekendOff: 300 }
function scoreOf(state: BuildState): Score {
  const { staff, days, dailyNeed, dailyBasic, r, weekendIdx } = state
  const L = [0, 0, 0, 0, 0, 0, 0]
  for (const s of staff) {
    // A single day off after two nights, a third night, a second stretch of six: recommendations, kept when needed.
    for (const problem of rowProblems(s.codes, s.prefix, days, r)) {
      if (problem.rule in EXCEPTION_COST) L[1] += EXCEPTION_COST[problem.rule]
      else if (problem.rule in ADVICE_COST) L[4] += ADVICE_COST[problem.rule]
      else L[0] += 1
    }
    if (s.nightsCap < Infinity) L[0] += Math.max(0, s.codes.filter((code) => code === 'N').length - s.nightsCap)
    let shifts = 0
    let nights = 0
    let weekendWork = 0
    const kinds: Record<string, number> = { M: 0, I: 0, A: 0, N: 0 }
    const days7: Record<string, number> = { sat: 0, sun: 0, holiday: 0 }
    let weekendNights = 0
    L[0] += weeklyHoursProblems(s.codes, days, s.hoursLimit, (code, i) => (isShift(code) ? s.hours[i][code] ?? 8 : 0)).length
    for (let i = 0; i < days.length; i += 1) {
      const code = s.codes[i]
      if (s.wishShift[i] && !s.locked[i] && code !== s.wishShift[i]) L[5] += s.wishWeight
      if (!isShift(code)) {
        if (s.extra && !s.locked[i] && code !== s.pattern[i]) L[6] += 200
        if (code === 'R' && isShift(i === 0 ? s.prefix[s.prefix.length - 1] : s.codes[i - 1]) && isShift(s.codes[i + 1])) L[4] += 60
        // Shift, day off, shift, day off: never (owner, 9/11/2026).
        if (code === 'R' && isShift(s.codes[i + 1]) && s.codes[i + 2] === 'R' && isShift(i === 0 ? s.prefix[s.prefix.length - 1] : s.codes[i - 1])) L[4] += 80
        continue
      }
      shifts += 1
      // A single shift between two days off (day off, shift, day off): avoided (owner, 19/11/2026). A night is not
      // one: its days off after it are the rule.
      if (!s.locked[i] && code !== 'N') {
        const prev = i === 0 ? s.prefix[s.prefix.length - 1] : s.codes[i - 1]
        const next = s.codes[i + 1]
        if (prev !== undefined && next !== undefined && !isShift(prev) && !isShift(next) && prev !== '' && next !== '') L[4] += 400
      }
      // Nights in pairs: a single night costs the same days off as two (owner, 8/11/2026).
      if (code === 'N' && s.codes[i - 1] !== 'N' && s.codes[i + 1] !== 'N' && i < days.length - 1 && !(i === 0 && s.prefix[s.prefix.length - 1] === 'N')) L[4] += 40
      if (!s.locked[i] && !personalOk(s.employee, s.allowed, days[i], code)) L[0] += 1
      // The supernumerary keeps their pattern unless a shift needs them.
      if (s.extra && !s.locked[i] && code !== s.pattern[i]) L[6] += 200
      if (code === 'N') nights += 1
      kinds[code] = (kinds[code] || 0) + 1
      if (days[i].holiday) days7.holiday += 1
      else if (days[i].weekday === 6) days7.sat += 1
      else if (days[i].weekday === 0) days7.sun += 1
      if (weekendIdx.has(i)) weekendWork += 1
      if (weekendIdx.has(i) && code === 'N') weekendNights += 1
      if (s.wish[i]) L[5] += s.wishWeight
    }
    // Two days off before and after a leave, where the roster allows (owner, 8/11/2026; a preference, 19/11/2026).
    for (let i = 0; i < days.length; i += 1) {
      if (!isLeave(s.codes[i]) || s.codes[i] === 'H') continue
      const startsHere = i === 0 || !isLeave(s.codes[i - 1])
      const endsHere = i === days.length - 1 || !isLeave(s.codes[i + 1])
      for (const k of [startsHere && i - 1, startsHere && i - 2, endsHere && i + 1, endsHere && i + 2]) {
        if (typeof k !== 'number' || k < 0 || k >= days.length || s.locked[k]) continue
        if (isShift(s.codes[k])) L[4] += 300
      }
    }
    // Exactly `weeklyRestDays` days off in every full Monday-Sunday week (owner, 8/11/2026): a week with more costs,
    // the shifts it lacks go to another week. Leave and holidays are not days off.
    for (const start of state.weeks) {
      const week = s.codes.slice(start, start + 7)
      const rests = week.filter((code) => code === 'R').length
      const off = weekOff(week)
      // Two a week is the rule; a week of three (or one) is allowed but avoided.
      // A week of four days off (or of one) is avoided much more (owner, 18/11/2026: the days off beyond two a week
      // that the working-day target brings are spread, one week of three at a time).
      L[4] += rests > r.weeklyRestDays ? (rests - r.weeklyRestDays) * 40 + Math.max(0, rests - r.weeklyRestDays - 1) * 400 : off < r.weeklyRestDays ? (r.weeklyRestDays - off) * 200 : 0
    }
    // The one allowed stretch of six still costs a little, so it is used only when it helps.
    {
      let run = 0
      for (const code of s.codes) {
        run = isShift(code) ? run + 1 : 0
        if (run === r.maxConsecutive + 1) L[4] += 60
      }
    }
    s.gap = shifts - s.target
    // Each person works their target (the working days, owner 18/11/2026): below it or above it (overtime).
    if (!s.extra) L[2] += s.gap < 0 ? -s.gap * 4 : s.gap * 5
    s.nights = nights
    s.weekendWork = weekendWork
    s.kinds = { ...kinds, ...days7 }
    s.weekendNights = weekendNights
  }
  const regular = staff.filter((s) => !s.extra)
  const mean = (key: 'gap' | 'weekendWork') => regular.reduce((sum, s) => sum + s[key], 0) / (regular.length || 1)
  const nightStaff = regular.filter((s) => s.allowed.includes('N'))
  const meanGap = mean('gap')
  // A fair share (owner, 19/11/2026): each kind of shift, Saturdays, Sundays and holidays shared out among those who
  // may work them, in proportion to each person's target (someone with leave is not made equal to the others).
  for (const [key, weight] of [['M', 15], ['A', 15], ['I', 3], ['N', 40], ['sat', 20], ['sun', 20], ['holiday', 20]] as [string, number][]) {
    const able = regular.filter((s) => s.target > 0 && (['sat', 'sun', 'holiday'].includes(key) ? !s.employee.noWeekends : s.allowed.includes(key)))
    const share = able.reduce((sum, s) => sum + s.kinds[key], 0) / (able.reduce((sum, s) => sum + s.target, 0) || 1)
    // A difference of one shift is fair enough (owner, 19/11/2026: 1–2 shifts where possible).
    for (const s of able) L[3] += Math.max(0, Math.abs(s.kinds[key] - share * s.target) - 1) * weight
  }
  const meanWeekendNights = nightStaff.reduce((sum, s) => sum + s.weekendNights, 0) / (nightStaff.length || 1)
  for (const s of nightStaff) L[3] += Math.max(0, Math.abs(s.weekendNights - meanWeekendNights) - 1) * 8
  for (const s of regular) L[3] += Math.max(0, Math.abs(s.gap - meanGap) - 1) * 30
  const spreadWeight = 6
  for (let i = 0; i < days.length; i += 1) {
    for (const shift of SHIFT_CODES) {
      let have = 0
      let extra = 0
      for (const s of staff) if (s.codes[i] === shift) { if (s.extra) extra += 1; else have += 1 }
      const need = dailyNeed[i][shift]
      const basic = dailyBasic[i][shift]
      // The basic shifts first (owner, 19/11/2026); the supernumerary does not count (owner, 18/11/2026); a missing
      // night counts double.
      if (have < basic) L[1] += (basic - have) * (shift === 'N' ? 2 : 1)
      // A shift the day does not ask for at all (an intermediate on a Sunday) is never given.
      if (need === 0) { L[6] += (have + extra) * 1000; continue }
      // A supplementary intermediate costs as much as one more person on a morning or afternoon, so the search
      // neither adds nor removes them (owner, 9/11/2026: given only to people left over).
      if (shift === 'I' && basic === 0) { L[6] += Math.min(have + extra, need) * 40 + Math.max(0, have + extra - need) * 1000; continue }
      if (have > need) L[6] += have - need
      // People beyond the need are spread over the morning and the afternoon (owner, 9/11/2026: 3/3 rather than
      // 4/2): each further extra person on the same shift costs more. Nights stay in pairs before two days off.
      if ((shift === 'M' || shift === 'A') && have > need) L[6] += (have - need) ** 2 * spreadWeight
      // Lighter weekends (owner, 9/11/2026): the people left over work the weekdays.
      if (weekendIdx.has(i) && have > need) L[6] += (have - need) * 25
      if (shift === 'N' && have + extra > need + 1) L[6] += (have + extra - need - 1) * 60
    }
  }
  return L
}
// One number for a score, for reports: the levels weighted far apart.
export const scoreValue = (score: Score) => { const [hard, short, rest] = rank(score); return hard * 1e9 + short * 1e6 + rest }

// May the person take `code` on day i? Looks backwards only (the days after are still free).
function allowedBackward(s: Staff, i: number, code: string, r: RosterRules, days: RosterDay[]) {
  if (!personalOk(s.employee, s.allowed, days[i], code)) return false
  if (code === 'N' && s.codes.slice(0, i).filter((c) => c === 'N').length >= s.nightsCap) return false
  const codes = [...s.codes.slice(0, i), code]
  if (rowProblems(codes, s.prefix, days.slice(0, i + 1), { ...r, weeklyRestDays: 0, minWeekendOff: 0 }).some((p) => p.index === i)) return false
  if (!isShift(code)) return true
  // Days off of the week so far: the week cannot end with fewer than `weeklyRestDays`.
  const sinceMonday = (days[i].weekday + 6) % 7
  let worked = 1
  for (let back = 1; back <= sinceMonday; back += 1) {
    const k = i - back
    const prev = k >= 0 ? s.codes[k] : s.prefix[s.prefix.length + k]
    if (isShift(prev)) worked += 1
  }
  if (worked > 7 - r.weeklyRestDays) return false
  // Hours of the week so far, each shift by its real hours (owner, 18/11/2026): at most the limit and one more shift.
  if (!s.hoursLimit) return true
  let hours = s.hours[i][code] ?? 8
  for (let back = 1; back <= sinceMonday; back += 1) {
    const k = i - back
    const prev = k >= 0 ? s.codes[k] : s.prefix[s.prefix.length + k]
    if (isShift(prev)) hours += k >= 0 ? s.hours[k][prev] ?? 8 : 8
  }
  return hours <= s.hoursLimit + 8
}

export interface GenerateInput { days: RosterDay[], employees: RosterEmployee[] | null | undefined, demand: RosterDemand | null | undefined, rules?: Partial<RosterRules> | null, history?: RosterHistory, seed?: number, attempts?: number, iterations?: number }
export function generateRoster({ days, employees, demand, rules, history = {}, seed = 1, attempts = 6, iterations = 15000 }: GenerateInput): RosterResult {
  const r: RosterRules = { ...DEFAULT_RULES, ...rules, shiftTimes: shiftTimesOf(demand) }
  const seeds = mulberry32(seed)
  // The rules work on kinds; the department's other shifts set by hand come back afterwards.
  const byKind = (employees || []).map((employee) => ({ ...employee, fixed: Object.fromEntries(Object.entries(employee.fixed || {}).map(([date, code]) => [date, kindOf(code)])) }))
  const kindHistory: RosterHistory = Object.fromEntries(Object.entries(history || {}).map(([id, row]) => [id, (row || []).map(kindOf)]))
  // Each shift by its real hours (owner, 18/11/2026): a kind's hours on a day are those of the shifts that ask for
  // it (12 for a department of 07:00–19:00 / 19:00–07:00). Longer shifts mean fewer of them a week: more days off.
  const hours = kindHoursOf(days, demand)
  // The extra days off follow the shortest shift asked for, so that a department mixing 8- and 12-hour shifts keeps
  // its 8-hour people at five shifts (the hours checks limit the rest); none when the weekly limit is off (0).
  let shortest = Infinity
  days.forEach((day, i) => { const need = demandFor(demand, day); for (const kind of SHIFT_CODES) if (need[kind] > 0) shortest = Math.min(shortest, hours[i][kind]) })
  const limit = Number(r.maxWeeklyHours) || 0
  const build: RosterRules = limit > 0 && Number.isFinite(shortest) && shortest > 8 ? { ...r, weeklyRestDays: Math.max(r.weeklyRestDays, 7 - Math.max(1, Math.floor(limit / shortest))) } : r
  let best: RosterResult | null = null
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    const result = buildRoster({ days, employees: byKind, demand, r: build, check: r, hours, history: kindHistory, random: mulberry32(Math.floor(seeds() * 4294967296)), iterations })
    if (!best || better(result.levels as Score, best.levels as Score)) best = result
    if (result.violations.length === 0) break
  }
  const custom = customShifts(demand)
  const hasCustomFixed = (employees || []).some((employee) => Object.values(employee.fixed || {}).some((code) => String(code).includes(':')))
  if (!custom.length && !hasCustomFixed) return best as RosterResult
  const found = best as RosterResult
  const random = mulberry32(seed + 17)
  const assignments: Assignments = Object.fromEntries(Object.entries(found.assignments).map(([id, row]) => [id, { ...row }]))
  for (const employee of employees || []) {
    for (const [date, code] of Object.entries(employee.fixed || {})) if (assignments[employee.id]) assignments[employee.id][date] = code
  }
  // Each of the department's other shifts takes its people from its kind on the day, sharing it out; the basic ones
  // first, so that a supplementary shift never takes the person a basic one needs (owner, 19/11/2026).
  const given: Record<string, number> = {}
  for (const shift of [...custom.filter((item) => !isOptionalShift(item)), ...custom.filter(isOptionalShift)]) {
    for (const day of days) {
      let need = customNeed(shift, day) - (employees || []).filter((employee) => assignments[employee.id]?.[day.date] === shift.code).length
      const options = (employees || [])
        .filter((employee) => employee.active !== false && !employee.extra && !employee.fixed?.[day.date] && assignments[employee.id]?.[day.date] === kindOf(shift.code))
        .sort((a, b) => (given[a.id] || 0) - (given[b.id] || 0) || random() - 0.5)
      for (const employee of options) {
        if (need <= 0) break
        assignments[employee.id][day.date] = shift.code
        given[employee.id] = (given[employee.id] || 0) + 1
        need -= 1
      }
    }
  }
  return { ...found, assignments, violations: checkRoster({ days, employees, assignments, demand, rules: r, history }) }
}

// The hours of each kind on each day: the department's own shifts of the kind by their times, the rest eight.
function kindHoursOf(days: RosterDay[], demand: RosterDemand | null | undefined): Record<string, number>[] {
  const custom = customShifts(demand)
  return days.map((day) => {
    const need = demandFor(demand, day)
    const row: Record<string, number> = { M: 8, I: 8, A: 8, N: 8 }
    for (const kind of SHIFT_CODES) {
      const own = custom.filter((shift) => kindOf(shift.code) === kind && customNeed(shift, day) > 0)
      if (!own.length || !need[kind]) continue
      const ownNeed = own.reduce((sum, shift) => sum + customNeed(shift, day), 0)
      row[kind] = (own.reduce((sum, shift) => sum + customNeed(shift, day) * shiftHours(shift.code, demand), 0) + Math.max(0, need[kind] - ownNeed) * 8) / need[kind]
    }
    return row
  })
}

function buildRoster({ days, employees, demand, r, check = r, hours, history, random, iterations }: { days: RosterDay[], employees: RosterEmployee[], demand: RosterDemand | null | undefined, r: RosterRules, check?: RosterRules, hours?: Record<string, number>[], history: RosterHistory, random: () => number, iterations: number }): RosterResult {
  const n = days.length
  const active = (employees || []).filter((employee) => employee.active !== false)
  const targets = shiftTargets(days, active, r.weeklyRestDays)
  const pairs = weekendPairs(days)
  // Public holidays are shared out like the weekends (owner, 18/11/2026).
  const weekendIdx = new Set([...pairs.flat(), ...days.flatMap((day, i) => (day.holiday ? [i] : []))])
  const staff = active.map((employee, order): Staff => {
    const fixed = employee.fixed || {}
    const wishes = employee.wishes || {}
    const extra = Boolean(employee.extra)
    const pattern = days.map((day) => (extra ? defaultExtraCode(employee, day) : ''))
    // The supernumerary starts from their pattern (weekday mornings); the search moves them only to fill a gap.
    const codes = days.map((day, i) => fixed[day.date] || pattern[i])
    return {
      employee,
      extra,
      pattern,
      nightsCap: maxNightsOf(employee),
      codes,
      locked: days.map((day) => Boolean(fixed[day.date])),
      prefix: historyOf(history, employee.id),
      wish: days.map((day) => wishes[day.date] === 'R'),
      wishShift: days.map((day) => (isShift(wishes[day.date]) ? kindOf(wishes[day.date]) as string : '')),
      hoursLimit: weeklyHoursLimit(employee, r),
      hours: hours || days.map(() => ({ M: 8, I: 8, A: 8, N: 8 })),
      // Earlier in the list, higher priority for wishes.
      wishWeight: 250 + Math.max(0, active.length - order) * 4,
      target: targets[employee.id],
      allowed: allowedOf(employee),
      reserved: new Array(n).fill(false)
    } as Staff
  })
  const dailyNeed = days.map((day) => demandFor(demand, day))
  const dailyBasic = days.map((day) => basicDemandFor(demand, day))
  const state: BuildState = { staff, days, dailyNeed, dailyBasic, r, weekendIdx, weeks: fullWeeks(days) }

  const restLike = (code: string) => code === 'R' || isLeave(code)
  const regular = staff.filter((s) => !s.extra)

  // 1. Days off first (as in the hospital's own rosters): exactly `weeklyRestDays` in every Monday-Sunday week
  //    (a part week at the start or end of the period gets its share), in pairs where possible, one whole weekend
  //    each, wishes and the days around a leave first, spread so that every day keeps enough people at work.
  const segments: [number, number][] = []
  for (let i = 0, from = 0; i <= n; i += 1) {
    if (i === n || (i > from && days[i].weekday === 1)) {
      segments.push([from, i])
      from = i
    }
  }
  const segmentOf: number[] = new Array(n)
  segments.forEach(([from, to], index) => { for (let i = from; i < to; i += 1) segmentOf[i] = index })
  const resting = new Array(n).fill(0)
  // How many days off start on each day: a night is worked only right before days off, so every day needs at least
  // as many days off starting the next day as it has nights.
  const restStarts = new Array(n + 1).fill(0)
  for (const s of regular) for (let i = 0; i < n; i += 1) if (restLike(s.codes[i])) resting[i] += 1
  const aroundLeave = (s: Staff, i: number) => [i - 2, i - 1, i + 1, i + 2].some((k) => k >= 0 && k < n && isLeave(s.codes[k]) && s.codes[k] !== 'H')
  const weekendLoad = pairs.map(() => 0)
  for (const s of regular.slice().sort(() => random() - 0.5)) {
    const rest = (i: number) => {
      s.codes[i] = 'R'
      resting[i] += 1
    }
    // One whole weekend off, on the least taken weekend: a strong preference inside its week's choice below.
    const wantedWeekend = new Set<number>()
    const already = pairs.filter(([sat, sun]) => restLike(s.codes[sat]) && restLike(s.codes[sun])).length
    if (already < r.minWeekendOff) {
      // Only a weekend of a full week (a part week at the start has fewer days off).
      const fullWeek = (i: number) => segments.some(([from, to]) => i >= from && i < to && to - from === 7)
      const options = pairs.map((pair, index) => ({ pair, index })).filter(({ pair: [sat, sun] }) => !s.locked[sat] && !s.locked[sun] && fullWeek(sat))
      // A week with a wished day off or a leave keeps its two days off for those: the weekend goes to another week.
      const busyWeek = ({ pair: [sat] }: { pair: [number, number] }) => {
        const [from, to] = segments[segmentOf[sat]]
        for (let i = from; i < to; i += 1) if (s.wish[i] || isLeave(s.codes[i])) return 1
        return 0
      }
      options.sort((a, b) => busyWeek(a) - busyWeek(b) || weekendLoad[a.index] - weekendLoad[b.index] || random() - 0.5)
      for (const { pair, index } of options.slice(0, r.minWeekendOff - already)) {
        pair.forEach((i) => wantedWeekend.add(i))
        weekendLoad[index] += 1
      }
    }
    for (const [from, to] of segments) {
      const length = to - from
      // A part week at the start belongs to a week begun in the previous roster: its days off count there first
      // (owner, 9/11/2026); without one, only whole shares of days off (none in a two-day weekend).
      let quota = length === 7 ? r.weeklyRestDays : Math.floor((length * r.weeklyRestDays) / 7)
      if (length < 7 && from === 0 && s.prefix.length >= 7 - length) {
        const before = s.prefix.slice(-(7 - length)).filter((code) => !isShift(code)).length
        quota = Math.max(0, r.weeklyRestDays - before)
      }
      if (s.carry && length === 7) {
        quota -= s.carry
        s.carry = 0
      }
      let need = quota - s.codes.slice(from, to).filter((code) => code === 'R').length
      const free = (i: number) => i >= from && i < to && !s.locked[i] && !s.codes[i]
      // A day off that leaves fewer people at work than the day's shifts need costs most.
      const totalNeed = (i: number) => dailyNeed[i].M + dailyNeed[i].A + dailyNeed[i].N
      const cost = (i: number) => (regular.length - resting[i] - 1 < totalNeed(i) ? 80 : 0) + resting[i] * 2 - (wantedWeekend.has(i) ? 40 : 0) - ((days[i].weekday === 6 && wantedWeekend.has(i + 7)) || (days[i].weekday === 0 && wantedWeekend.has(i + 6)) ? 18 : 0) - (s.wish[i] ? 100 : 0) - (aroundLeave(s, i) ? 40 : 0) - (s.codes[i - 1] === 'R' || s.codes[i + 1] === 'R' ? 1.5 : 0) + random()
      // (A whole weekend off leaves Monday to Friday at work: with the days before it, the one allowed six in a row.)
      // Every way to place the week's days off (one or two days); kept only if no stretch of work from the last day
      // off before this week to the end of it is longer than `maxConsecutive`.
      const freeDays: number[] = []
      for (let i = from; i < to; i += 1) if (free(i)) freeDays.push(i)
      const lastRest = (() => {
        for (let k = from - 1; k >= 0; k -= 1) if (restLike(s.codes[k])) return k
        for (let k = s.prefix.length - 1; k >= 0; k -= 1) if (!isShift(s.prefix[k])) return k - s.prefix.length
        // No day off known before: the stretch runs from the start of the period (or of the known previous days).
        return -1 - s.prefix.length
      })()
      // 0: fine; 1: needs the one allowed stretch of six; 2: too long.
      const stretchOk = (chosen: number[]) => {
        let run = from - lastRest - 1
        let over = 0
        for (let i = from; i < to; i += 1) {
          if (chosen.includes(i) || restLike(s.codes[i])) run = 0
          else if ((run += 1) > r.maxConsecutive) {
            if (run > r.maxConsecutive + 1 || s.longUsed) return 2
            over = 1
          }
        }
        return over
      }
      const combos: number[][] = []
      const size = Math.min(need, freeDays.length, 2)
      if (size === 1) freeDays.forEach((a) => combos.push([a]))
      if (size === 2) freeDays.forEach((a, x) => freeDays.slice(x + 1).forEach((b) => combos.push([a, b])))
      let bestCombo: Combo | null = null
      for (const combo of combos) {
        const starts = combo.filter((d) => d > 0 && !combo.includes(d - 1) && !restLike(s.codes[d - 1]))
        const nightRoom = starts.reduce((sum, d) => sum + (restStarts[d] < dailyNeed[d - 1].N * 1.5 ? -5 : 1), 0)
        const stretch = stretchOk(combo)
        const value = combo.reduce((sum, i) => sum + cost(i), 0) - (combo.length === 2 && combo[1] === combo[0] + 1 ? 12 : 0) + nightRoom + (stretch === 2 ? 1000 : stretch === 1 ? 25 : 0)
        if (!bestCombo || value < bestCombo.value) bestCombo = { days: combo, value, long: stretch === 1 }
      }
      // The weekend wanted off does not fit in two days off without too long a stretch: once in the roster, the week
      // takes a third day off and the next week gives one back (owner, 9/11/2026).
      const wanted = freeDays.filter((i) => wantedWeekend.has(i))
      // (Not when the next week has a leave or a wished day off: it keeps its two days off for those.)
      const nextFull = segments.some(([a, b]) => a === to && b - a === 7 && !s.codes.slice(a, b).some((code, x) => isLeave(code) || s.wish[a + x]))
      if (size === 2 && wanted.length === 2 && nextFull && !s.borrowed && !(bestCombo && wanted.every((i) => (bestCombo as Combo).days.includes(i)) && !bestCombo.long)) {
        let best3: Combo | null = null
        for (const x of freeDays) {
          if (wanted.includes(x)) continue
          const combo = [...wanted, x].sort((p, q) => p - q)
          const stretch = stretchOk(combo)
          if (stretch === 2) continue
          const value = combo.reduce((sum, i) => sum + cost(i), 0) + (stretch === 1 ? 25 : 0) + (combo.includes(x - 1) || combo.includes(x + 1) ? -6 : 0)
          if (!best3 || value < best3.value) best3 = { days: combo, value, long: stretch === 1 }
        }
        if (best3 && (!bestCombo || !wanted.every((i) => (bestCombo as Combo).days.includes(i)) || !best3.long)) {
          bestCombo = best3
          need = 3
          s.borrowed = true
          s.carry = 1
        }
      }
      while (need > 0) {
        const pick = bestCombo
        bestCombo = null
        if (!pick) break
        if (pick.long) s.longUsed = true
        s.keep = s.keep || new Set()
        pick.days.filter((d) => wantedWeekend.has(d)).forEach((d) => (s.keep as Set<number>).add(d))
        for (const d of pick.days) if (d > 0 && !pick.days.includes(d - 1) && !restLike(s.codes[d - 1])) restStarts[d] += 1
        pick.days.forEach(rest)
        need -= pick.days.length
      }
      // Longer shifts (owner, 18/11/2026): a week holds more than two days off; the others go to the free days that
      // cost least and keep the stretches of work short.
      while (need > 0) {
        const options = freeDays.filter((i) => !s.codes[i] && stretchOk([i]) < 2).sort((a, b) => cost(a) - cost(b))
        if (!options.length) break
        rest(options[0])
        need -= 1
      }
    }
  }

  // 2. Then the shifts on the working days, day by day: nights only right before days off (one or two nights, then
  //    rest), then mornings, intermediates and afternoons; whoever is left works where it fits best (more people on
  //    a shift than asked is fine).
  // Every regular person is in the map, so a read is always a number.
  const nightsDone = new Map(regular.map((s) => [s, 0])) as Omit<Map<Staff, number>, 'get'> & { get(s: Staff): number }
  for (let i = 0; i < n; i += 1) {
    const open = () => regular.filter((s) => !s.codes[i])
    const fits = (s: Staff, code: string) => allowedBackward(s, i, code, { ...r, weeklyRestDays: 0 }, days)
    let missing = dailyNeed[i].N - staff.filter((s) => !s.extra && s.codes[i] === 'N').length
    const nightOptions = open()
      .filter((s) => {
        if (!fits(s, 'N') || nightsDone.get(s) >= s.nightsCap) return false
        // Not in the two days around a leave (owner, 8/11/2026): the leave is not the days off after the nights.
        if ([i - 2, i - 1, i + 1, i + 2].some((j) => j >= 0 && j < n && isLeave(s.codes[j]) && s.codes[j] !== 'H')) return false
        const restAt = (k: number) => k >= n || restLike(s.codes[k])
        // After one night `restAfterNight` days off, after two `restAfterTwoNights`: the days off must already be there.
        const restsAfter = (k: number, count: number) => Array.from({ length: count }, (_, x) => restAt(k + x)).every(Boolean)
        if (s.codes[i - 1] === 'N') return restsAfter(i + 1, r.restAfterTwoNights)
        return restsAfter(i + 1, r.restAfterNight) || (!s.codes[i + 1] && restsAfter(i + 2, r.restAfterTwoNights))
      })
      .sort((a, b) => (a.codes[i - 1] === 'N' ? -1 : 0) - (b.codes[i - 1] === 'N' ? -1 : 0) || nightsDone.get(a) - nightsDone.get(b) || random() - 0.5)
    for (const s of nightOptions) {
      if (missing <= 0) break
      s.codes[i] = 'N'
      nightsDone.set(s, nightsDone.get(s) + 1)
      // A first night with a free day after it and days off after that: the second night too.
      const restAt = (k: number) => k >= n || restLike(s.codes[k])
      if (i + 1 < n && !s.codes[i + 1] && restAt(i + 2) && (r.restAfterTwoNights < 2 || restAt(i + 3)) && nightsDone.get(s) < s.nightsCap) {
        s.codes[i + 1] = 'N'
        nightsDone.set(s, nightsDone.get(s) + 1)
      }
      missing -= 1
    }
    // Still short of nights: someone working that day takes the night and rests the next day; a later day off of
    // the same week becomes a working day, so the week keeps its days off.
    if (missing > 0 && i + 1 < n) {
      const movers = open()
        .filter((s) => fits(s, 'N') && nightsDone.get(s) < s.nightsCap && !s.codes[i + 1] && !s.locked[i + 1])
        .sort((a, b) => nightsDone.get(a) - nightsDone.get(b) || random() - 0.5)
      for (const s of movers) {
        if (missing <= 0) break
        const [from, to] = segments[segmentOf[i + 1]]
        let k = -1
        // Never a wished day off, nor one next to a leave.
        const movable = (d: number) => s.codes[d] === 'R' && !s.locked[d] && !s.wish[d] && !aroundLeave(s, d) && !s.keep?.has(d)
        for (let d = i + 2; d < to; d += 1) if (movable(d) && !(s.codes[d + 1] === 'R' && s.codes[d - 1] !== 'R')) { k = d; break }
        if (k < 0) for (let d = Math.max(from, i + 2); d < to; d += 1) if (movable(d)) { k = d; break }
        if (k < 0) continue
        s.codes[k] = ''
        s.codes[i + 1] = 'R'
        // The day off moved earlier must not leave a stretch of work longer than `maxConsecutive` after it.
        let run = 0
        let tooLong = false
        for (let d = 0; d < n; d += 1) {
          run = restLike(s.codes[d]) ? 0 : run + 1
          if (d > i && run > r.maxConsecutive) tooLong = true
        }
        if (tooLong) {
          s.codes[k] = 'R'
          s.codes[i + 1] = ''
          continue
        }
        s.codes[i] = 'N'
        nightsDone.set(s, nightsDone.get(s) + 1)
        missing -= 1
      }
    }
    // A basic intermediate (owner, 19/11/2026) is filled like the morning and the afternoon.
    for (const shift of ['M', 'A', ...(dailyBasic[i].I > 0 ? ['I'] : [])]) {
      let short = (shift === 'I' ? dailyBasic[i].I : dailyNeed[i][shift]) - staff.filter((s) => !s.extra && s.codes[i] === shift).length
      // The hospital's rotation (4 → 19 → 20 → R): whoever could work tomorrow's night (days off after it) takes
      // an afternoon today rather than a morning, which would forbid the night.
      const nightTomorrow = (s: Staff) => i + 1 < n && !s.codes[i + 1] && (i + 2 >= n || restLike(s.codes[i + 2])) && s.allowed.includes('N') ? 1 : 0
      const rank = (s: Staff) => (shift === 'M' ? nightTomorrow(s) * 2 + (s.codes[i - 1] === 'A' ? 1 : 0) : shift === 'A' ? -nightTomorrow(s) : 0)
      const options = open().filter((s) => fits(s, shift)).sort((a, b) => rank(a) - rank(b) || random() - 0.5)
      for (const s of options) {
        if (short <= 0) break
        s.codes[i] = shift
        short -= 1
      }
    }
    // Intermediates only from whoever is left over (owner, 9/11/2026): the first spare people strengthen the
    // morning and the afternoon, a third spare person works the intermediate.
    let intermediates = Math.min(dailyNeed[i].I - staff.filter((s) => s.codes[i] === 'I').length, open().length - 2)
    for (const s of open().sort(() => random() - 0.5)) {
      if (intermediates <= 0) break
      if (!fits(s, 'I')) continue
      s.codes[i] = 'I'
      intermediates -= 1
    }
    for (const s of open()) {
      // Whoever is left works a morning or an afternoon.
      const order = ['M', 'A'].filter((code) => dailyNeed[i][code] > 0).sort(() => random() - 0.5)
      if (i + 1 < n && !s.codes[i + 1] && (i + 2 >= n || restLike(s.codes[i + 2]))) order.sort((x, y) => Number(x === 'M') - Number(y === 'M'))
      s.codes[i] = order.find((code) => fits(s, code)) || ['M', 'A', 'I', 'N'].find((code) => dailyNeed[i][code] > (code === 'I' ? staff.filter((x) => x.codes[i] === 'I').length : 0) && fits(s, code)) || 'R'
    }
  }
  for (const s of staff) for (let i = 0; i < n; i += 1) if (!s.codes[i]) s.codes[i] = 'R'

  // 3. Search (simulated annealing) with moves that keep the days off of every week: change one shift, swap two
  //    people's shifts on a day, or move a day off within its week. The best roster seen is kept.
  let score = scoreOf(state)
  let best = { score, codes: staff.map((s) => s.codes.slice()) }
  // A worse roster is accepted now and then early in the search, and only below the shortages: never with a new
  // breach or a new shortage (owner, 19/11/2026).
  const accept = (next: Score, step: number) => {
    if (!better(score, next)) return true
    const [x, y] = [rank(next), rank(score)]
    if (x[0] !== y[0] || x[1] !== y[1]) return false
    const temperature = 30 * (1 - step / iterations)
    return temperature > 0.5 && random() < Math.exp((y[2] - x[2]) / temperature)
  }
  // The days off next to a leave stay where they are (owner, 8/11/2026).
  const guard = (x: Staff, d: number) => x.codes[d] === 'R' && aroundLeave(x, d)
  for (let step = 0; step < iterations && staff.length; step += 1) {
    const i = Math.floor(random() * n)
    const sa = staff[Math.floor(random() * staff.length)]
    if (sa.locked[i] || guard(sa, i)) continue
    const roll = random()
    if (roll < 0.35 && isShift(sa.codes[i])) {
      const before = sa.codes[i]
      const options = SHIFT_CODES.filter((code) => code !== before && dailyNeed[i][code] > 0 && sa.allowed.includes(code))
      if (!options.length) continue
      sa.codes[i] = options[Math.floor(random() * options.length)]
      const next = scoreOf(state)
      if (accept(next, step)) score = next
      else sa.codes[i] = before
    } else if (roll < 0.7) {
      const sb = staff[Math.floor(random() * staff.length)]
      if (sb === sa || sb.locked[i] || !isShift(sa.codes[i]) || !isShift(sb.codes[i]) || sa.codes[i] === sb.codes[i]) continue
      ;[sa.codes[i], sb.codes[i]] = [sb.codes[i], sa.codes[i]]
      const next = scoreOf(state)
      if (accept(next, step)) score = next
      else [sa.codes[i], sb.codes[i]] = [sb.codes[i], sa.codes[i]]
    } else if (roll < 0.85 && staff.length > 1) {
      // Two people trade a day off for a working day within the same week (each keeps the week's days off): the move
      // that fills a short shift or frees a weekend.
      const sb = staff[Math.floor(random() * staff.length)]
      const [from, to] = segments[segmentOf[i]]
      const j = from + Math.floor(random() * (to - from))
      if (sb === sa || j === i || sb.locked[i] || sa.locked[j] || sb.locked[j] || guard(sb, j)) continue
      if (!(sa.codes[i] === 'R' && isShift(sb.codes[i]) && isShift(sa.codes[j]) && sb.codes[j] === 'R')) continue
      const before = [sa.codes[i], sb.codes[i], sa.codes[j], sb.codes[j]]
      ;[sa.codes[i], sb.codes[i], sa.codes[j], sb.codes[j]] = [sb.codes[i], 'R', 'R', sa.codes[j]]
      const next = scoreOf(state)
      if (accept(next, step)) score = next
      else [sa.codes[i], sb.codes[i], sa.codes[j], sb.codes[j]] = before
    } else if (roll < 0.9) {
      // A day off moves to a working day of the next or previous week (a week of three and one of one, allowed
      // but avoided).
      const k = segmentOf[i] + (random() < 0.5 ? -1 : 1)
      if (k < 0 || k >= segments.length || sa.codes[i] !== 'R') continue
      const [from, to] = segments[k]
      const j = from + Math.floor(random() * (to - from))
      if (sa.locked[j] || !isShift(sa.codes[j])) continue
      ;[sa.codes[i], sa.codes[j]] = [sa.codes[j], sa.codes[i]]
      const next = scoreOf(state)
      if (accept(next, step)) score = next
      else [sa.codes[i], sa.codes[j]] = [sa.codes[j], sa.codes[i]]
    } else {
      // A day off and a working day of the same person in the same week change places.
      const [from, to] = segments[segmentOf[i]]
      const j = from + Math.floor(random() * (to - from))
      if (j === i || sa.locked[j] || guard(sa, j) || (sa.codes[i] === 'R') === (sa.codes[j] === 'R') || !(isShift(sa.codes[i]) || sa.codes[i] === 'R') || !(isShift(sa.codes[j]) || sa.codes[j] === 'R')) continue
      ;[sa.codes[i], sa.codes[j]] = [sa.codes[j], sa.codes[i]]
      const next = scoreOf(state)
      if (accept(next, step)) score = next
      else [sa.codes[i], sa.codes[j]] = [sa.codes[j], sa.codes[i]]
    }
    if (better(score, best.score)) best = { score, codes: staff.map((s) => s.codes.slice()) }
  }
  staff.forEach((s, k) => { s.codes = best.codes[k] })
  score = best.score

  // 4. Whoever still has no whole weekend off gets one (owner, 9/11/2026): their two days off of a week move to its
  //    Saturday and Sunday, and a colleague off that weekend works it and takes their days off instead — both
  //    keep two days off in the week. The change that improves the roster most is kept.
  const fullWeekOf = new Map(segments.map(([from, to]) => [from, to - from === 7]))
  const segmentStart = (i: number) => segments[segmentOf[i]][0]
  const weekendFree = (x: Staff) => pairs.some(([sat, sun]) => !isShift(x.codes[sat]) && !isShift(x.codes[sun]))
  for (let round = 0; round < 3; round += 1) {
    let changed = false
    for (const s of regular.filter((x) => r.minWeekendOff > 0 && !weekendFree(x))) {
      let bestMove = null as Move | null
      for (const [sat, sun] of pairs) {
        const from = segmentStart(sat)
        if (!fullWeekOf.get(from) || s.locked[sat] || s.locked[sun] || !isShift(s.codes[sat]) || !isShift(s.codes[sun])) continue
        const week = Array.from({ length: 7 }, (_, x) => from + x)
        const rests = week.filter((d) => s.codes[d] === 'R' && !s.locked[d])
        if (rests.length < 2) continue
        const [x, y] = rests
        for (const q of [null, ...regular.filter((o) => o !== s && o.codes[sat] === 'R' && o.codes[sun] === 'R' && !o.locked[sat] && !o.locked[sun] && !o.locked[x] && !o.locked[y] && isShift(o.codes[x]) && isShift(o.codes[y]))]) {
          const before = staff.map((o) => o.codes.slice())
          const shiftSat = s.codes[sat]
          const shiftSun = s.codes[sun]
          s.codes[sat] = 'R'
          s.codes[sun] = 'R'
          if (q) {
            s.codes[x] = q.codes[x]
            s.codes[y] = q.codes[y]
            q.codes[x] = 'R'
            q.codes[y] = 'R'
            q.codes[sat] = shiftSat
            q.codes[sun] = shiftSun
          } else {
            s.codes[x] = shiftSat
            s.codes[y] = shiftSun
          }
          const next = scoreOf(state)
          // Only a real gain: the levels decide, so the weekend never comes with a new broken rule or a short shift.
          if (better(next, score) && (!bestMove || better(next, bestMove.score))) bestMove = { score: next, codes: staff.map((o) => o.codes.slice()) }
          staff.forEach((o, k) => { o.codes = before[k] })
        }
      }
      if (bestMove) {
        staff.forEach((o, k) => { o.codes = (bestMove as Move).codes[k] })
        score = bestMove.score
        changed = true
      }
    }
    if (!changed) break
  }

  // 5. A shift still short (most often a night, which needs days off after it): one person takes it, and a day off
  //    of theirs moves within the same or the next week to keep the weeks' days off. Only changes that improve the
  //    roster are kept.
  for (let round = 0; round < 3; round += 1) {
    let changed = false
    for (let i = 0; i < n; i += 1) {
      for (const kind of ['N', 'M', 'A', 'I']) {
        if (staff.filter((x) => !x.extra && x.codes[i] === kind).length >= dailyBasic[i][kind]) continue
        let bestMove = null as Move | null
        const tryMove = (apply: () => unknown) => {
          const before = staff.map((o) => o.codes.slice())
          if (apply() !== false) {
            const next = scoreOf(state)
            if (better(next, score) && (!bestMove || better(next, bestMove.score))) bestMove = { score: next, codes: staff.map((o) => o.codes.slice()) }
          }
          staff.forEach((o, k) => { o.codes = before[k] })
        }
        const near: number[] = []
        for (let j = segments[segmentOf[i]][0]; j < Math.min(n, (segments[segmentOf[i] + 1] || segments[segmentOf[i]])[1]); j += 1) near.push(j)
        for (const s of regular) {
          if (s.locked[i] || !s.allowed.includes(kind)) continue
          if (isShift(s.codes[i])) tryMove(() => { s.codes[i] = kind })
          // A night at the start, in the part of a week begun in the previous roster: the day after it becomes a day off.
          if (kind === 'N' && isShift(s.codes[i]) && i + 1 < n && isShift(s.codes[i + 1]) && !s.locked[i + 1] && segments[segmentOf[i + 1]][1] - segments[segmentOf[i + 1]][0] < 7) tryMove(() => { s.codes[i] = 'N'; s.codes[i + 1] = 'R' })
          for (const j of near) {
            if (j === i || s.locked[j]) continue
            if (s.codes[i] === 'R' && isShift(s.codes[j])) tryMove(() => { s.codes[i] = kind; s.codes[j] = 'R' })
            if (kind === 'N' && isShift(s.codes[i]) && i + 1 < n && isShift(s.codes[i + 1]) && !s.locked[i + 1] && s.codes[j] === 'R' && j !== i + 1 && j !== i + 2) {
              for (const code of ['M', 'A', 'I'].filter((c) => dailyNeed[j][c] > 0 && s.allowed.includes(c))) tryMove(() => { s.codes[i] = 'N'; s.codes[i + 1] = 'R'; s.codes[j] = code })
            }
          }
        }
        // A night with its two days off after it (owner, 18/11/2026): the person's days off elsewhere in the same or
        // the next week become the shifts they give up, so the count of their shifts stays.
        if (kind === 'N' && !bestMove) {
          // One night, or two (today and tomorrow), then the two days off.
          for (const s of regular) for (const length of [1, 2]) {
            const block = Array.from({ length }, (_, k) => i + k)
            if (block.some((k) => k >= n || s.locked[k] || s.codes[k] === 'N') || !s.allowed.includes('N')) continue
            // Not in the two days before or after a leave (owner, 8/11/2026).
            if (block.some((k) => [k - 2, k - 1, k + 1, k + 2].some((j) => j >= 0 && j < n && isLeave(s.codes[j]) && s.codes[j] !== 'H'))) continue
            const after = [i + length, i + length + 1].filter((k) => k < n)
            if (after.some((k) => s.locked[k])) continue
            const lost = after.filter((k) => isShift(s.codes[k])).length - block.filter((k) => !isShift(s.codes[k])).length
            const restDays = near.filter((j) => j < i - 1 || j > i + length + 1).filter((j) => !s.locked[j] && s.codes[j] === 'R')
            const work = (j: number) => ['M', 'A'].filter((c) => dailyNeed[j][c] > 0 && s.allowed.includes(c)).sort((a, b) => staff.filter((x) => !x.extra && x.codes[j] === a).length - dailyNeed[j][a] - (staff.filter((x) => !x.extra && x.codes[j] === b).length - dailyNeed[j][b]))[0]
            const night = () => { block.forEach((k) => { s.codes[k] = 'N' }); after.forEach((k) => { s.codes[k] = 'R' }) }
            if (lost < 0) for (const j of near.filter((k) => k > i + length + 1 || k < i - 1).filter((k) => !s.locked[k] && isShift(s.codes[k]))) tryMove(() => { night(); s.codes[j] = 'R' })
            if (lost <= 0) tryMove(night)
            else if (lost === 1) for (const j of restDays) { const code = work(j); if (code) tryMove(() => { night(); s.codes[j] = code }) }
            else if (lost === 2) {
              for (let a = 0; a < restDays.length; a += 1) for (let b = a + 1; b < restDays.length; b += 1) {
                const ca = work(restDays[a])
                const cb = work(restDays[b])
                if (ca && cb) tryMove(() => { night(); s.codes[restDays[a]] = ca; s.codes[restDays[b]] = cb })
              }
            }
          }
        }
        if (bestMove) {
          staff.forEach((o, k) => { o.codes = (bestMove as Move).codes[k] })
          score = bestMove.score
          changed = true
        }
      }
    }
    if (!changed) break
  }

  // 5b. Two days off before and after a leave (owner, 8/11/2026): a shift there swaps with a day off of the same
  //     person in the same week, where that improves the roster.
  for (const s of regular) {
    for (let i = 0; i < n; i += 1) {
      if (s.locked[i] || !isShift(s.codes[i])) continue
      if (![i - 2, i - 1, i + 1, i + 2].some((j) => j >= 0 && j < n && isLeave(s.codes[j]) && s.codes[j] !== 'H')) continue
      let bestSwap = null as Move | null
      for (let j = segments[segmentOf[i]][0]; j < segments[segmentOf[i]][1]; j += 1) {
        if (j === i || s.locked[j] || s.codes[j] !== 'R') continue
        for (const code of ['M', 'A'].filter((c) => dailyNeed[j][c] > 0 && s.allowed.includes(c))) {
          const before = staff.map((o) => o.codes.slice())
          s.codes[j] = code
          s.codes[i] = 'R'
          const next = scoreOf(state)
          if (better(next, score) && (!bestSwap || better(next, bestSwap.score))) bestSwap = { score: next, codes: staff.map((o) => o.codes.slice()) }
          staff.forEach((o, k) => { o.codes = before[k] })
        }
      }
      if (bestSwap) {
        staff.forEach((o, k) => { o.codes = (bestSwap as Move).codes[k] })
        score = bestSwap.score
      }
    }
  }

  // 6. Above the target (owner, 18/11/2026: the target is the working days): a shift on a day that has more people
  //    than it needs becomes a day off (one, or two days together), where that improves the roster.
  for (let round = 0; round < 10; round += 1) {
    let changed = false
    // Those furthest above their target first, so that the shares stay even; and whoever is below theirs takes a
    // morning or an afternoon on a day off of theirs, where the rules allow.
    const above = (x: Staff) => x.codes.filter(isShift).length - x.target
    const top = Math.max(0, ...regular.map(above))
    const bottom = Math.min(0, ...regular.map(above))
    for (const s of regular) {
      if (bottom < 0 && above(s) === bottom) {
        let bestUp = null as Move | null
        for (let i = 0; i < n; i += 1) {
          if (s.locked[i] || s.codes[i] !== 'R') continue
          for (const code of ['M', 'A'].filter((c) => dailyNeed[i][c] > 0 && s.allowed.includes(c))) {
            const before = staff.map((o) => o.codes.slice())
            s.codes[i] = code
            const next = scoreOf(state)
            if (better(next, score) && (!bestUp || better(next, bestUp.score))) bestUp = { score: next, codes: staff.map((o) => o.codes.slice()) }
            staff.forEach((o, k) => { o.codes = before[k] })
          }
        }
        if (bestUp) {
          staff.forEach((o, k) => { o.codes = (bestUp as Move).codes[k] })
          score = bestUp.score
          changed = true
        }
      }
      if (top <= 0 || above(s) < top) continue
      const spare = (i: number) => !s.locked[i] && isShift(s.codes[i]) && staff.filter((x) => !x.extra && x.codes[i] === s.codes[i]).length > dailyNeed[i][s.codes[i]]
      let bestMove = null as Move | null
      const tryMove = (apply: () => unknown) => {
        const before = staff.map((o) => o.codes.slice())
        apply()
        const next = scoreOf(state)
        if (better(next, score) && (!bestMove || better(next, bestMove.score))) bestMove = { score: next, codes: staff.map((o) => o.codes.slice()) }
        staff.forEach((o, k) => { o.codes = before[k] })
      }
      for (let i = 0; i < n; i += 1) {
        if (!spare(i)) continue
        tryMove(() => { s.codes[i] = 'R' })
        if (i + 1 < n && spare(i + 1)) tryMove(() => { s.codes[i] = 'R'; s.codes[i + 1] = 'R' })
      }
      if (bestMove) {
        staff.forEach((o, k) => { o.codes = (bestMove as Move).codes[k] })
        score = bestMove.score
        changed = true
      }
    }
    if (!changed) break
  }

  // 7. A fair share (owner, 19/11/2026): the person with the most nights (or Saturdays, Sundays) and the one with the
  //    fewest trade a few days of their rows; each day keeps its people, so the cover stays. Kept where it improves.
  for (let round = 0; round < 12; round += 1) {
    let changed = false
    for (const key of ['N', 'sat', 'sun']) {
      scoreOf(state)
      const able = regular.filter((x) => x.target > 0 && (key === 'N' ? x.allowed.includes('N') : !x.employee.noWeekends))
      if (able.length < 2) continue
      const ratio = (x: Staff) => x.kinds[key] / x.target
      const most = able.reduce((a, b) => (ratio(b) > ratio(a) ? b : a))
      const fewest = able.reduce((a, b) => (ratio(b) < ratio(a) ? b : a))
      if (most === fewest || most.kinds[key] - fewest.kinds[key] <= 1) continue
      let bestMove = null as Move | null
      for (const length of [2, 3, 4]) {
        for (let i = 0; i + length <= n; i += 1) {
          const window = Array.from({ length }, (_, k) => i + k)
          if (window.some((k) => most.locked[k] || fewest.locked[k]) || window.every((k) => most.codes[k] === fewest.codes[k])) continue
          const before = staff.map((o) => o.codes.slice())
          for (const k of window) [most.codes[k], fewest.codes[k]] = [fewest.codes[k], most.codes[k]]
          const next = scoreOf(state)
          if (better(next, score) && (!bestMove || better(next, bestMove.score))) bestMove = { score: next, codes: staff.map((o) => o.codes.slice()) }
          staff.forEach((o, k) => { o.codes = before[k] })
        }
      }
      if (bestMove) {
        staff.forEach((o, k) => { o.codes = (bestMove as Move).codes[k] })
        score = bestMove.score
        changed = true
      }
    }
    if (!changed) break
  }

  const assignments: Assignments = {}
  const totals: Record<string, number> = {}
  for (const employee of employees || []) {
    assignments[employee.id] = {}
    totals[employee.id] = 0
  }
  for (const s of staff) {
    days.forEach((day, i) => { assignments[s.employee.id][day.date] = s.codes[i] })
    totals[s.employee.id] = s.codes.filter(isShift).length
  }
  const coverage: Record<string, Record<string, number>> = {}
  days.forEach((day, i) => {
    const count: Record<string, number> = { M: 0, I: 0, A: 0, N: 0 }
    for (const s of staff) if (isShift(s.codes[i])) count[s.codes[i]] += 1
    coverage[day.date] = count
  })
  const violations = checkRoster({ days, employees, assignments, demand, rules: check, history })
  return { assignments, coverage, violations, totals, score: scoreValue(score), levels: score }
}
