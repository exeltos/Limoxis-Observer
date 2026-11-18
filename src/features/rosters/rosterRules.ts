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


// A day of the period.
// `holiday`: the name of a public holiday (rosterHolidays.markHolidays); such a day is also `weekend`.
export interface RosterDay { date: string, weekday: number, weekend: boolean, holiday?: string }
// Each person's codes by date: { employeeId: { '2026-11-21': 'M' } }.
export type Assignments = Record<string, Record<string, string>>
// The people each shift needs (weekday / weekend defaults, a day's own numbers, the other shifts).
// (Type aliases, not interfaces: they are stored as json.)
export type ShiftNeed = Record<string, number>
export type DemandKind = 'weekday' | 'weekend' | 'holiday'
// Another shift of the department («M:1», 07:00–19:00): its people on weekdays and weekends.
export type CustomShift = { code: string, label: string, weekday?: number, weekend?: number }
// `holiday`: the people of a public holiday (owner, 18/11/2026); without it a holiday takes the weekend numbers.
export type RosterDemand = { weekday?: ShiftNeed, weekend?: ShiftNeed, holiday?: ShiftNeed, overrides?: Record<string, ShiftNeed>, custom?: CustomShift[] }
export type RosterRules = typeof DEFAULT_RULES & { longStretchExceptions?: number, [key: string]: unknown }
// A person as the rules read them: id, limits, fixed codes and wishes.
// `noNights`: no night shifts (pregnancy, breastfeeding, a medical reason…) until a date or always; `forbid`: shifts the
// person must not get on a date (hard); `wishes[date]`: 'R' (a day off) or a shift kind they would like (soft).
export type NoNights = { reason?: string, until?: string }
export interface RosterEmployee { id: string, name?: string, active?: boolean, fixed?: Record<string, string>, wishes?: Record<string, string>, allowed?: string[], extra?: boolean, noWeekends?: boolean, maxNights?: unknown, percent?: unknown, noNights?: NoNights | null, forbid?: Record<string, string[]> }
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
  balanceTolerance: 2,
  // Hours a week (owner, 18/11/2026): on average over the full weeks of the period, and one week may have one more
  // shift (the week with a single day off). 0 = not checked. Part-time: their share, rounded up to a whole shift.
  maxWeeklyHours: 40
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
  const base = day.holiday && demand?.holiday && Object.keys(demand.holiday).length ? demand.holiday : day.weekend ? demand?.weekend : demand?.weekday
  const row = { ...(base || {}), ...(demand?.overrides?.[day.date] || {}) }
  const need: Record<string, number> = { M: Number(row.M) || 0, I: Number(row.I) || 0, A: Number(row.A) || 0, N: Number(row.N) || 0 }
  // The department's other shifts add their people to their kind.
  for (const shift of customShifts(demand)) need[kindOf(shift.code)] += customNeed(shift, day)
  return need
}
// The department's other shifts: [{ code: 'M:1', label, weekday, weekend }].
export const customShifts = (demand: RosterDemand | null | undefined): CustomShift[] => (Array.isArray(demand?.custom) ? demand.custom.filter((shift: CustomShift) => isShift(shift?.code) && String(shift.code).includes(':')) : [])
export const customNeed = (shift: CustomShift, day: RosterDay) => Math.max(0, Number(day.weekend ? shift.weekend : shift.weekday) || 0)
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
// Also the hard limits of the person (owner, 18/11/2026): no nights while «Χωρίς νύχτες» holds, no shift they must not get that day.
export const noNightsOn = (employee: RosterEmployee | null | undefined, date: string) => Boolean(employee?.noNights?.reason && (!employee.noNights.until || date <= employee.noNights.until))
// The mandatory ones alone («Χωρίς νύχτες», «Όχι βάρδια»): they hold even for a shift entered by hand.
export const mandatoryOk = (employee: RosterEmployee | null | undefined, day: RosterDay, code: string) =>
  !isShift(code) || (!(kindOf(code) === 'N' && noNightsOn(employee, day.date)) && !(employee?.forbid?.[day.date] || []).includes(kindOf(code) as string))
export const personalOk = (employee: RosterEmployee | null | undefined, allowed: string[], day: RosterDay, code: string) =>
  !isShift(code) || (allowed.includes(kindOf(code) as string) && !(employee?.noWeekends && day.weekend) && !(kindOf(code) === 'N' && noNightsOn(employee, day.date)) && !(employee?.forbid?.[day.date] || []).includes(kindOf(code) as string))

// The hours of a shift: 8 for the four kinds; another shift of the department by its own times («07:00–19:00»).
export function shiftHours(code: string | null | undefined, demand?: RosterDemand | null) {
  if (!isShift(code)) return 0
  const label = String(code).includes(':') ? customShifts(demand).find((shift) => shift.code === code)?.label || '' : ''
  const match = label.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/)
  if (!match) return 8
  const start = Number(match[1]) * 60 + Number(match[2])
  let end = Number(match[3]) * 60 + Number(match[4])
  if (end <= start) end += 24 * 60
  return Math.round(((end - start) / 60) * 10) / 10
}
// A person's weekly hours (owner, 18/11/2026): the limit, their share for part-time rounded up to a whole shift; a
// single week may hold one more shift. 0 when not checked.
export function weeklyHoursLimit(employee: RosterEmployee | null | undefined, r: { maxWeeklyHours?: number }) {
  const max = Number(r.maxWeeklyHours) || 0
  if (max <= 0) return 0
  const percent = Number(employee?.percent) > 0 && Number(employee?.percent) < 100 ? Number(employee?.percent) : 100
  return Math.ceil((max * percent) / 100 / 8) * 8
}
// The full weeks whose hours break the limit: one week above limit + one shift, or all of them above it on average.
export function weeklyHoursProblems(codes: string[], days: RosterDay[], limit: number, hoursOf: (code: string, index: number) => number = (code) => shiftHours(code)) {
  if (limit <= 0) return [] as number[]
  const problems: number[] = []
  let total = 0
  let weeks = 0
  for (const start of fullWeeks(days)) {
    if (start + 6 >= codes.length) continue
    const hours = codes.slice(start, start + 7).reduce((sum, code, x) => sum + hoursOf(code, start + x), 0)
    total += hours
    weeks += 1
    if (hours > limit + 8) problems.push(start + 6)
  }
  if (weeks && total / weeks > limit) problems.push(-1)
  return problems
}
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
      if (!personalOk(employee, allowed, days[i], code) && (!employee.fixed?.[days[i].date] || !mandatoryOk(employee, days[i], code))) violations.push({ rule: 'personal', employeeId: employee.id, date: days[i].date })
    })
    if (codes.filter((code) => code === 'N').length > maxNightsOf(employee)) violations.push({ rule: 'maxNights', employeeId: employee.id })
    const real = days.map((day) => given?.[employee.id]?.[day.date] || '')
    for (const index of weeklyHoursProblems(real, days, weeklyHoursLimit(employee, r), (code) => shiftHours(code, demand))) {
      violations.push({ rule: 'weeklyHours', employeeId: employee.id, date: index >= 0 ? days[index].date : undefined })
    }
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
