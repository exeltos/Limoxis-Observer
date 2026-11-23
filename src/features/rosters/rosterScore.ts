// The score of a roster: the levels and the comparison of the roster generator (rosterEngine).
import { isLeave, isShift, personalOk, rowProblems, SHIFT_CODES, weekOff, weeklyHoursProblems } from './rosterRules'
import type { RosterDay, RosterEmployee, RosterRules } from './rosterRules'

// One person during the build: their codes and what the search reads (the totals are set by scoreOf).
export interface Staff {
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
export interface BuildState { staff: Staff[], days: RosterDay[], dailyNeed: Record<string, number>[], dailyBasic: Record<string, number>[], r: RosterRules, weekendIdx: Set<number>, weeks: number[] }

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
export function scoreOf(state: BuildState): Score {
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
