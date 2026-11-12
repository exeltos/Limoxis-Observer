// Monthly shift roster generator (pure, no I/O): builds a roster that keeps the rules of rosterRules.
// The rules, the checker and the calendar helpers live in rosterRules; this module re-exports them.
import { allowedOf, checkRoster, DEFAULT_RULES, customNeed, customShifts, defaultExtraCode, demandFor, fullWeeks, historyOf, isLeave, isShift, kindOf, maxNightsOf, mulberry32, personalOk, rowProblems, SHIFT_CODES, shiftTargets, weekendPairs, weekOff } from './rosterRules'

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
  wishWeight: number
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
interface Move { score: number, codes: string[][] }
interface BuildState { staff: Staff[], days: RosterDay[], dailyNeed: Record<string, number>[], r: RosterRules, weekendIdx: Set<number>, weeks: number[] }
export interface RosterResult { assignments: Assignments, violations: RosterViolation[], score: number, [key: string]: unknown }

// The score of a whole roster (lower is better): hard problems weigh most, then coverage, wishes, single days off,
// distance from each person's target and the sharing of nights and weekends.
function scoreOf(state: BuildState) {
  const { staff, days, dailyNeed, r, weekendIdx } = state
  let score = 0
  for (const s of staff) {
    score += rowProblems(s.codes, s.prefix, days, r).length * 1000
    if (s.nightsCap < Infinity) score += Math.max(0, s.codes.filter((code) => code === 'N').length - s.nightsCap) * 1000
    let shifts = 0
    let nights = 0
    let weekendWork = 0
    const kinds: Record<string, number> = { M: 0, I: 0, A: 0, N: 0 }
    let weekendNights = 0
    for (let i = 0; i < days.length; i += 1) {
      const code = s.codes[i]
      if (!isShift(code)) {
        if (s.extra && !s.locked[i] && code !== s.pattern[i]) score += 200
        if (code === 'R' && isShift(i === 0 ? s.prefix[s.prefix.length - 1] : s.codes[i - 1]) && isShift(s.codes[i + 1])) score += 60
        // Shift, day off, shift, day off: never (owner, 9/11/2026).
        if (code === 'R' && isShift(s.codes[i + 1]) && s.codes[i + 2] === 'R' && isShift(i === 0 ? s.prefix[s.prefix.length - 1] : s.codes[i - 1])) score += 80
        continue
      }
      shifts += 1
      // Nights in pairs: a single night costs the same days off as two (owner, 8/11/2026).
      if (code === 'N' && s.codes[i - 1] !== 'N' && s.codes[i + 1] !== 'N' && i < days.length - 1 && !(i === 0 && s.prefix[s.prefix.length - 1] === 'N')) score += 40
      if (!s.locked[i] && !personalOk(s.employee, s.allowed, days[i], code)) score += 1000
      // The supernumerary keeps their pattern unless a shift needs them.
      if (s.extra && !s.locked[i] && code !== s.pattern[i]) score += 200
      if (code === 'N') nights += 1
      kinds[code] = (kinds[code] || 0) + 1
      if (weekendIdx.has(i)) weekendWork += 1
      if (weekendIdx.has(i) && code === 'N') weekendNights += 1
      if (s.wish[i]) score += s.wishWeight
    }
    // Two days off before and after a leave, where the roster allows (owner, 8/11/2026).
    for (let i = 0; i < days.length; i += 1) {
      if (!isLeave(s.codes[i]) || s.codes[i] === 'H') continue
      const startsHere = i === 0 || !isLeave(s.codes[i - 1])
      const endsHere = i === days.length - 1 || !isLeave(s.codes[i + 1])
      for (const k of [startsHere && i - 1, startsHere && i - 2, endsHere && i + 1, endsHere && i + 2]) {
        if (k === false || k < 0 || k >= days.length || s.locked[k]) continue
        if (isShift(s.codes[k])) score += 120
      }
    }
    // Exactly `weeklyRestDays` days off in every full Monday-Sunday week (owner, 8/11/2026): a week with more costs,
    // the shifts it lacks go to another week. Leave and holidays are not days off.
    for (const start of state.weeks) {
      const week = s.codes.slice(start, start + 7)
      const rests = week.filter((code) => code === 'R').length
      const off = weekOff(week)
      // Two a week is the rule; a week of three (or one) is allowed but avoided.
      score += (rests > r.weeklyRestDays ? rests - r.weeklyRestDays : off < r.weeklyRestDays ? r.weeklyRestDays - off : 0) * 40
    }
    // The one allowed stretch of six still costs a little, so it is used only when it helps.
    {
      let run = 0
      for (const code of s.codes) {
        run = isShift(code) ? run + 1 : 0
        if (run === r.maxConsecutive + 1) score += 60
      }
    }
    s.gap = shifts - s.target
    // Each person works their target (five days a week, two days off): below it costs most, above it is overtime.
    // More people on a shift than asked is fine (owner, 8/11/2026).
    if (!s.extra) score += s.gap < 0 ? -s.gap * 40 : s.gap * 12
    s.nights = nights
    s.weekendWork = weekendWork
    s.kinds = kinds
    s.weekendNights = weekendNights
  }
  const regular = staff.filter((s) => !s.extra)
  const mean = (key: 'gap' | 'weekendWork') => regular.reduce((sum, s) => sum + s[key], 0) / (regular.length || 1)
  // Nights are shared among those who may work them.
  const nightStaff = regular.filter((s) => s.allowed.includes('N'))
  const meanNights = nightStaff.reduce((sum, s) => sum + s.nights, 0) / (nightStaff.length || 1)
  const meanWeekend = mean('weekendWork')
  const meanGap = mean('gap')
  // Nobody always on mornings, always on nights or on every weekend night: each kind of shift shared out among
  // those who may work it (owner, 9/11/2026).
  for (const kind of SHIFT_CODES) {
    const able = regular.filter((s) => s.allowed.includes(kind))
    const meanKind = able.reduce((sum, s) => sum + s.kinds[kind], 0) / (able.length || 1)
    for (const s of able) score += Math.abs(s.kinds[kind] - meanKind) * 6
  }
  const meanWeekendNights = nightStaff.reduce((sum, s) => sum + s.weekendNights, 0) / (nightStaff.length || 1)
  for (const s of nightStaff) score += Math.abs(s.weekendNights - meanWeekendNights) * 8
  for (const s of regular) score += Math.abs(s.gap - meanGap) * 30 + (s.allowed.includes('N') ? Math.abs(s.nights - meanNights) * 4 : 0) + Math.abs(s.weekendWork - meanWeekend) * 3
  const spreadWeight = 6
  for (let i = 0; i < days.length; i += 1) {
    for (const shift of SHIFT_CODES) {
      let have = 0
      let extra = 0
      for (const s of staff) if (s.codes[i] === shift) { if (s.extra) extra += 1; else have += 1 }
      const need = dailyNeed[i][shift]
      // A shift the day does not ask for at all (an intermediate on a Sunday) is never given; the supernumerary only
      // counts where the others are short.
      // An intermediate costs as much as one more person on a morning or afternoon, so the search neither adds nor
      // removes them (owner, 9/11/2026: fewer intermediates, given only to people left over).
      if (shift === 'I' && need > 0) score += Math.min(have + extra, need) * 40 + Math.max(0, have + extra - need) * 1000
      else score += have + extra < need ? (need - have - extra) * 300 : need === 0 ? (have + extra) * 1000 : Math.max(0, have - need)
      // People beyond the need are spread over the morning and the afternoon (owner, 9/11/2026: 3/3 rather than
      // 4/2): each further extra person on the same shift costs more. Nights stay in pairs before two days off.
      if ((shift === 'M' || shift === 'A') && need > 0 && have + extra > need) score += (have + extra - need) ** 2 * spreadWeight
      // Lighter weekends (owner, 9/11/2026): the people left over work the weekdays.
      if (weekendIdx.has(i) && need > 0 && have + extra > need) score += (have + extra - need) * 25
      if (shift === 'N' && need > 0 && have + extra > need + 1) score += (have + extra - need - 1) * 60
    }
  }
  return score
}

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
  return worked <= 7 - r.weeklyRestDays
}

export interface GenerateInput { days: RosterDay[], employees: RosterEmployee[] | null | undefined, demand: RosterDemand | null | undefined, rules?: Partial<RosterRules> | null, history?: RosterHistory, seed?: number, attempts?: number, iterations?: number }
export function generateRoster({ days, employees, demand, rules, history = {}, seed = 1, attempts = 3, iterations = 15000 }: GenerateInput): RosterResult {
  const r: RosterRules = { ...DEFAULT_RULES, ...rules }
  const seeds = mulberry32(seed)
  // The rules work on kinds; the department's other shifts set by hand come back afterwards.
  const byKind = (employees || []).map((employee) => ({ ...employee, fixed: Object.fromEntries(Object.entries(employee.fixed || {}).map(([date, code]) => [date, kindOf(code)])) }))
  const kindHistory: RosterHistory = Object.fromEntries(Object.entries(history || {}).map(([id, row]) => [id, (row || []).map(kindOf)]))
  let best: RosterResult | null = null
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    const result = buildRoster({ days, employees: byKind, demand, r, history: kindHistory, random: mulberry32(Math.floor(seeds() * 4294967296)), iterations })
    if (!best || result.score < best.score) best = result
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
  // Each of the department's other shifts takes its people from its kind on the day, sharing it out.
  const given: Record<string, number> = {}
  for (const shift of custom) {
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

function buildRoster({ days, employees, demand, r, history, random, iterations }: { days: RosterDay[], employees: RosterEmployee[], demand: RosterDemand | null | undefined, r: RosterRules, history: RosterHistory, random: () => number, iterations: number }): RosterResult {
  const n = days.length
  const active = (employees || []).filter((employee) => employee.active !== false)
  const targets = shiftTargets(days, active, r.weeklyRestDays)
  const pairs = weekendPairs(days)
  const weekendIdx = new Set(pairs.flat())
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
      // Earlier in the list, higher priority for wishes.
      wishWeight: 250 + Math.max(0, active.length - order) * 4,
      target: targets[employee.id],
      allowed: allowedOf(employee),
      reserved: new Array(n).fill(false)
    } as Staff
  })
  const dailyNeed = days.map((day) => demandFor(demand, day))
  const state: BuildState = { staff, days, dailyNeed, r, weekendIdx, weeks: fullWeeks(days) }

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
    let missing = dailyNeed[i].N - staff.filter((s) => s.codes[i] === 'N').length
    const nightOptions = open()
      .filter((s) => {
        if (!fits(s, 'N') || nightsDone.get(s) >= s.nightsCap) return false
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
    for (const shift of ['M', 'A']) {
      let short = dailyNeed[i][shift] - staff.filter((s) => s.codes[i] === shift).length
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
  const accept = (next: number, step: number) => {
    if (next <= score) return true
    const temperature = 30 * (1 - step / iterations)
    return temperature > 0.5 && random() < Math.exp((score - next) / temperature)
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
    if (score < best.score) best = { score, codes: staff.map((s) => s.codes.slice()) }
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
          // Only a real gain: the weekend comes without a new broken rule or a short shift (each of those weighs
          // 300-1000, so anything less than 900 better trades one problem for another).
          if (next <= score - 900 && (!bestMove || next < bestMove.score)) bestMove = { score: next, codes: staff.map((o) => o.codes.slice()) }
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
      for (const kind of ['N', 'M', 'A']) {
        if (staff.filter((x) => x.codes[i] === kind).length >= dailyNeed[i][kind]) continue
        let bestMove = null as Move | null
        const tryMove = (apply: () => unknown) => {
          const before = staff.map((o) => o.codes.slice())
          if (apply() !== false) {
            const next = scoreOf(state)
            if (next < score && (!bestMove || next < bestMove.score)) bestMove = { score: next, codes: staff.map((o) => o.codes.slice()) }
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
            if (kind === 'N' && isShift(s.codes[i]) && i + 1 < n && isShift(s.codes[i + 1]) && !s.locked[i + 1] && s.codes[j] === 'R' && j !== i + 1) {
              for (const code of ['M', 'A', 'I'].filter((c) => dailyNeed[j][c] > 0 && s.allowed.includes(c))) tryMove(() => { s.codes[i] = 'N'; s.codes[i + 1] = 'R'; s.codes[j] = code })
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
  const violations = checkRoster({ days, employees, assignments, demand, rules: r, history })
  return { assignments, coverage, violations, totals, score }
}
