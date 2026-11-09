// Monthly shift roster generator and checker (pure, no I/O).
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
export const kindOf = (code) => (typeof code === 'string' && code.length > 2 && code[1] === ':' ? code[0] : code)
// The kind of a shift by its start: before 10:00 a morning, before 13:00 an intermediate, before 20:00 an afternoon,
// else a night.
export function kindFromStart(from) {
  const hour = Number(String(from || '').split(':')[0])
  if (!Number.isFinite(hour)) return 'M'
  if (hour >= 20 || hour < 4) return 'N'
  if (hour < 10) return 'M'
  if (hour < 13) return 'I'
  return 'A'
}
export const isShift = (code) => {
  const kind = kindOf(code)
  return kind === 'M' || kind === 'I' || kind === 'A' || kind === 'N'
}
const isDay = (code) => code === 'M' || code === 'I'
export const isLeave = (code) => Boolean(code) && !isShift(code) && code !== 'R'

function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const toISO = (ms) => new Date(ms).toISOString().slice(0, 10)

export function periodDays(startISO, endISO) {
  const days = []
  const end = parseISO(endISO)
  for (let t = parseISO(startISO); t <= end; t += DAY_MS) {
    const weekday = new Date(t).getUTCDay()
    days.push({ date: toISO(t), weekday, weekend: weekday === 0 || weekday === 6 })
  }
  return days
}

// Every date from `from` to `to` (inclusive) inside the period: a leave entered «from - to».
export function datesBetween(from, to, days) {
  if (!from) return []
  const end = to && to >= from ? to : from
  return days.map((day) => day.date).filter((date) => date >= from && date <= end)
}

function mulberry32(seed) {
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
export function demandFor(demand, day) {
  const row = { ...((day.weekend ? demand?.weekend : demand?.weekday) || {}), ...(demand?.overrides?.[day.date] || {}) }
  const need = { M: Number(row.M) || 0, I: Number(row.I) || 0, A: Number(row.A) || 0, N: Number(row.N) || 0 }
  // The department's other shifts add their people to their kind.
  for (const shift of customShifts(demand)) need[kindOf(shift.code)] += customNeed(shift, day)
  return need
}
// The department's other shifts: [{ code: 'M:1', label, weekday, weekend }].
export const customShifts = (demand) => (Array.isArray(demand?.custom) ? demand.custom.filter((shift) => isShift(shift?.code) && String(shift.code).includes(':')) : [])
export const customNeed = (shift, day) => Math.max(0, Number(day.weekend ? shift.weekend : shift.weekday) || 0)
// The same roster in kinds only (what the rules read).
const asKinds = (assignments) => Object.fromEntries(Object.entries(assignments || {}).map(([id, row]) => [id, Object.fromEntries(Object.entries(row || {}).map(([date, code]) => [date, kindOf(code)]))]))

function weekendPairs(days) {
  const pairs = []
  for (let i = 0; i < days.length - 1; i += 1) if (days[i].weekday === 6 && days[i + 1].weekday === 0) pairs.push([i, i + 1])
  return pairs
}
// The first day of every full Monday-Sunday week inside the period.
function fullWeeks(days) {
  const weeks = []
  for (let i = 0; i + 6 < days.length; i += 1) if (days[i].weekday === 1) weeks.push(i)
  return weeks
}

// Each person's target: the weekdays of the period minus their leave on weekdays (five days a week).
export function shiftTargets(days, employees) {
  const targets = {}
  for (const employee of employees || []) {
    const fixed = employee.fixed || {}
    const weekdays = days.filter((day) => !day.weekend && !isLeave(fixed[day.date])).length
    // Part-time: a share of the full target.
    const percent = Number(employee.percent) > 0 && Number(employee.percent) < 100 ? Number(employee.percent) : 100
    targets[employee.id] = Math.round((weekdays * percent) / 100)
  }
  return targets
}

// The hard-rule problems of one person's row; `prefix` holds their last days before the period.
function rowProblems(codes, prefix, days, r) {
  const all = prefix.length ? [...prefix, ...codes] : codes
  const offset = prefix.length
  const problems = []
  let streak = 0
  let nights = 0
  let restNeeded = 0
  for (let k = 0; k < all.length; k += 1) {
    const code = all[k]
    const inside = k >= offset
    const index = k - offset
    if (isShift(code)) {
      streak += 1
      if (inside && streak === r.maxConsecutive + 1) problems.push({ rule: 'maxConsecutive', index })
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
    for (const start of fullWeeks(days)) {
      if (start + 6 >= codes.length) continue
      const off = codes.slice(start, start + 7).filter((code) => !isShift(code)).length
      if (off < r.weeklyRestDays) problems.push({ rule: 'weeklyRest', index: start + 6 })
    }
  }
  const pairs = weekendPairs(days)
  if (pairs.length && r.minWeekendOff > 0) {
    const off = pairs.filter(([sat, sun]) => !isShift(codes[sat]) && !isShift(codes[sun])).length
    if (off < Math.min(r.minWeekendOff, pairs.length)) problems.push({ rule: 'weekendOff', index: -1 })
  }
  return problems
}

// A person's own limits (owner, 8/11/2026): `allowed` lists the shifts they may take (e.g. mornings only); none = all.
const allowedOf = (employee) => (Array.isArray(employee?.allowed) && employee.allowed.length ? employee.allowed : SHIFT_CODES)
// More of a person's limits: no weekends, at most so many nights in the period.
const maxNightsOf = (employee) => (Number.isFinite(Number(employee?.maxNights)) && employee?.maxNights !== '' && employee?.maxNights !== null && employee?.maxNights !== undefined ? Number(employee.maxNights) : Infinity)
// May the person work `code` on `day` by their own limits?
const personalOk = (employee, allowed, day, code) => !isShift(code) || (allowed.includes(code) && !(employee?.noWeekends && day.weekend))
// A supernumerary person (the head of the department, owner 8/11/2026) is not counted in the shifts: mornings on
// weekdays, and a shift only where the roster cannot be made otherwise.
export const defaultExtraCode = (employee, day) => {
  const allowed = allowedOf(employee)
  if (day.weekend) return 'R'
  return allowed.includes('M') ? 'M' : allowed[0]
}

const historyOf = (history, id) => (Array.isArray(history?.[id]) ? history[id].slice(-7) : [])

export function checkRoster({ days, employees, assignments: given, demand, rules, history = {} }) {
  const r = { ...DEFAULT_RULES, ...rules }
  const violations = []
  // Each of the department's other shifts has its own people too.
  const active0 = (employees || []).filter((employee) => employee.active !== false)
  for (const shift of customShifts(demand)) {
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
    for (const shift of SHIFT_CODES) {
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
  const targets = shiftTargets(days, active)
  const gaps = rows.filter(({ employee }) => !employee.extra).map(({ employee, codes }) => ({ employee, gap: codes.filter(isShift).length - targets[employee.id] }))
  const meanGap = gaps.reduce((sum, row) => sum + row.gap, 0) / (gaps.length || 1)
  for (const { employee, gap } of gaps) {
    if (Math.abs(gap - meanGap) > r.balanceTolerance) violations.push({ rule: 'balance', employeeId: employee.id, detail: `${gap + targets[employee.id]}/${targets[employee.id]}` })
  }
  return violations
}

// The score of a whole roster (lower is better): hard problems weigh most, then coverage, wishes, single days off,
// distance from each person's target and the sharing of nights and weekends.
function scoreOf(state) {
  const { staff, days, dailyNeed, r, weekendIdx } = state
  let score = 0
  for (const s of staff) {
    score += rowProblems(s.codes, s.prefix, days, r).length * 1000
    if (s.nightsCap < Infinity) score += Math.max(0, s.codes.filter((code) => code === 'N').length - s.nightsCap) * 1000
    let shifts = 0
    let nights = 0
    let weekendWork = 0
    const kinds = { M: 0, I: 0, A: 0, N: 0 }
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
        if (isShift(s.codes[k])) score += 60
      }
    }
    // Exactly `weeklyRestDays` days off in every full Monday-Sunday week (owner, 8/11/2026): a week with more costs,
    // the shifts it lacks go to another week. Leave and holidays are not days off.
    for (const start of state.weeks) {
      const rests = s.codes.slice(start, start + 7).filter((code) => code === 'R').length
      if (rests > r.weeklyRestDays) score += (rests - r.weeklyRestDays) * 50
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
  const mean = (key) => regular.reduce((sum, s) => sum + s[key], 0) / (regular.length || 1)
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
  for (let i = 0; i < days.length; i += 1) {
    for (const shift of SHIFT_CODES) {
      let have = 0
      let extra = 0
      for (const s of staff) if (s.codes[i] === shift) s.extra ? (extra += 1) : (have += 1)
      const need = dailyNeed[i][shift]
      // A shift the day does not ask for at all (an intermediate on a Sunday) is never given; the supernumerary only
      // counts where the others are short.
      score += have + extra < need ? (need - have - extra) * 300 : need === 0 ? (have + extra) * 1000 : Math.max(0, have - need) * (shift === 'I' ? 25 : 1)
    }
  }
  return score
}

// May the person take `code` on day i? Looks backwards only (the days after are still free).
function allowedBackward(s, i, code, r, days) {
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

export function generateRoster({ days, employees, demand, rules, history = {}, seed = 1, attempts = 3, iterations = 15000 }) {
  const r = { ...DEFAULT_RULES, ...rules }
  const seeds = mulberry32(seed)
  // The rules work on kinds; the department's other shifts set by hand come back afterwards.
  const byKind = (employees || []).map((employee) => ({ ...employee, fixed: Object.fromEntries(Object.entries(employee.fixed || {}).map(([date, code]) => [date, kindOf(code)])) }))
  const kindHistory = Object.fromEntries(Object.entries(history || {}).map(([id, row]) => [id, (row || []).map(kindOf)]))
  let best = null
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    const result = buildRoster({ days, employees: byKind, demand, r, history: kindHistory, random: mulberry32(Math.floor(seeds() * 4294967296)), iterations })
    if (!best || result.score < best.score) best = result
    if (result.violations.length === 0) break
  }
  const custom = customShifts(demand)
  const hasCustomFixed = (employees || []).some((employee) => Object.values(employee.fixed || {}).some((code) => String(code).includes(':')))
  if (!custom.length && !hasCustomFixed) return best
  const random = mulberry32(seed + 17)
  const assignments = Object.fromEntries(Object.entries(best.assignments).map(([id, row]) => [id, { ...row }]))
  for (const employee of employees || []) {
    for (const [date, code] of Object.entries(employee.fixed || {})) if (assignments[employee.id]) assignments[employee.id][date] = code
  }
  // Each of the department's other shifts takes its people from its kind on the day, sharing it out.
  const given = {}
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
  return { ...best, assignments, violations: checkRoster({ days, employees, assignments, demand, rules: r, history }) }
}

function buildRoster({ days, employees, demand, r, history, random, iterations }) {
  const n = days.length
  const active = (employees || []).filter((employee) => employee.active !== false)
  const targets = shiftTargets(days, active)
  const pairs = weekendPairs(days)
  const weekendIdx = new Set(pairs.flat())
  const staff = active.map((employee, order) => {
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
    }
  })
  const dailyNeed = days.map((day) => demandFor(demand, day))
  const state = { staff, days, dailyNeed, r, weekendIdx, weeks: fullWeeks(days) }

  const restLike = (code) => code === 'R' || isLeave(code)
  const regular = staff.filter((s) => !s.extra)

  // 1. Days off first (as in the hospital's own rosters): exactly `weeklyRestDays` in every Monday-Sunday week
  //    (a part week at the start or end of the period gets its share), in pairs where possible, one whole weekend
  //    each, wishes and the days around a leave first, spread so that every day keeps enough people at work.
  const segments = []
  for (let i = 0, from = 0; i <= n; i += 1) {
    if (i === n || (i > from && days[i].weekday === 1)) {
      segments.push([from, i])
      from = i
    }
  }
  const segmentOf = new Array(n)
  segments.forEach(([from, to], index) => { for (let i = from; i < to; i += 1) segmentOf[i] = index })
  const resting = new Array(n).fill(0)
  // How many days off start on each day: a night is worked only right before days off, so every day needs at least
  // as many days off starting the next day as it has nights.
  const restStarts = new Array(n + 1).fill(0)
  for (const s of regular) for (let i = 0; i < n; i += 1) if (restLike(s.codes[i])) resting[i] += 1
  const aroundLeave = (s, i) => [i - 2, i - 1, i + 1, i + 2].some((k) => k >= 0 && k < n && isLeave(s.codes[k]) && s.codes[k] !== 'H')
  const weekendLoad = pairs.map(() => 0)
  for (const s of regular.slice().sort(() => random() - 0.5)) {
    const rest = (i) => {
      s.codes[i] = 'R'
      resting[i] += 1
    }
    // One whole weekend off, on the least taken weekend: a strong preference inside its week's choice below.
    const wantedWeekend = new Set()
    const already = pairs.filter(([sat, sun]) => restLike(s.codes[sat]) && restLike(s.codes[sun])).length
    if (already < r.minWeekendOff) {
      // Only a weekend of a full week (a part week at the start has fewer days off).
      const fullWeek = (i) => segments.some(([from, to]) => i >= from && i < to && to - from === 7)
      const options = pairs.map((pair, index) => ({ pair, index })).filter(({ pair: [sat, sun] }) => !s.locked[sat] && !s.locked[sun] && fullWeek(sat))
      // A week with a wished day off or a leave keeps its two days off for those: the weekend goes to another week.
      const busyWeek = ({ pair: [sat] }) => {
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
      let need = quota - s.codes.slice(from, to).filter((code) => code === 'R').length
      const free = (i) => i >= from && i < to && !s.locked[i] && !s.codes[i]
      // A day off that leaves fewer people at work than the day's shifts need costs most.
      const totalNeed = (i) => dailyNeed[i].M + dailyNeed[i].I + dailyNeed[i].A + dailyNeed[i].N
      const cost = (i) => (regular.length - resting[i] - 1 < totalNeed(i) ? 80 : 0) + resting[i] * 2 - (wantedWeekend.has(i) ? 40 : 0) - (days[i].weekday === 0 && wantedWeekend.has(i + 6) ? 30 : 0) - (s.wish[i] ? 100 : 0) - (aroundLeave(s, i) ? 10 : 0) - (s.codes[i - 1] === 'R' || s.codes[i + 1] === 'R' ? 1.5 : 0) + random()
      // (A whole weekend off leaves Monday to Friday at work: the Sunday before it is a day off too.)
      // Every way to place the week's days off (one or two days); kept only if no stretch of work from the last day
      // off before this week to the end of it is longer than `maxConsecutive`.
      const freeDays = []
      for (let i = from; i < to; i += 1) if (free(i)) freeDays.push(i)
      const lastRest = (() => {
        for (let k = from - 1; k >= 0; k -= 1) if (restLike(s.codes[k])) return k
        for (let k = s.prefix.length - 1; k >= 0; k -= 1) if (!isShift(s.prefix[k])) return k - s.prefix.length
        // No day off known before: the stretch runs from the start of the period (or of the known previous days).
        return -1 - s.prefix.length
      })()
      const stretchOk = (chosen) => {
        let run = from - lastRest - 1
        for (let i = from; i < to; i += 1) {
          if (chosen.includes(i) || restLike(s.codes[i])) run = 0
          else if ((run += 1) > r.maxConsecutive) return false
        }
        return true
      }
      const combos = []
      const size = Math.min(need, freeDays.length, 2)
      if (size === 1) freeDays.forEach((a) => combos.push([a]))
      if (size === 2) freeDays.forEach((a, x) => freeDays.slice(x + 1).forEach((b) => combos.push([a, b])))
      let bestCombo = null
      for (const combo of combos) {
        const starts = combo.filter((d) => d > 0 && !combo.includes(d - 1) && !restLike(s.codes[d - 1]))
        const nightRoom = starts.reduce((sum, d) => sum + (restStarts[d] < dailyNeed[d - 1].N * 1.5 ? -5 : 1), 0)
        const value = combo.reduce((sum, i) => sum + cost(i), 0) - (combo.length === 2 && combo[1] === combo[0] + 1 ? 12 : 0) + nightRoom + (stretchOk(combo) ? 0 : 1000)
        if (!bestCombo || value < bestCombo.value) bestCombo = { days: combo, value }
      }
      while (need > 0) {
        let pick = bestCombo
        bestCombo = null
        if (!pick) break
        for (const d of pick.days) if (d > 0 && !pick.days.includes(d - 1) && !restLike(s.codes[d - 1])) restStarts[d] += 1
        pick.days.forEach(rest)
        need -= pick.days.length
      }
    }
  }

  // 2. Then the shifts on the working days, day by day: nights only right before days off (one or two nights, then
  //    rest), then mornings, intermediates and afternoons; whoever is left works where it fits best (more people on
  //    a shift than asked is fine).
  const nightsDone = new Map(regular.map((s) => [s, 0]))
  for (let i = 0; i < n; i += 1) {
    const open = () => regular.filter((s) => !s.codes[i])
    const fits = (s, code) => allowedBackward(s, i, code, { ...r, weeklyRestDays: 0 }, days)
    let missing = dailyNeed[i].N - staff.filter((s) => s.codes[i] === 'N').length
    const nightOptions = open()
      .filter((s) => {
        if (!fits(s, 'N') || nightsDone.get(s) >= s.nightsCap) return false
        const restAt = (k) => k >= n || restLike(s.codes[k])
        // After one night `restAfterNight` days off, after two `restAfterTwoNights`: the days off must already be there.
        const restsAfter = (k, count) => Array.from({ length: count }, (_, x) => restAt(k + x)).every(Boolean)
        if (s.codes[i - 1] === 'N') return restsAfter(i + 1, r.restAfterTwoNights)
        return restsAfter(i + 1, r.restAfterNight) || (!s.codes[i + 1] && restsAfter(i + 2, r.restAfterTwoNights))
      })
      .sort((a, b) => (a.codes[i - 1] === 'N' ? -1 : 0) - (b.codes[i - 1] === 'N' ? -1 : 0) || nightsDone.get(a) - nightsDone.get(b) || random() - 0.5)
    for (const s of nightOptions) {
      if (missing <= 0) break
      s.codes[i] = 'N'
      nightsDone.set(s, nightsDone.get(s) + 1)
      // A first night with a free day after it and days off after that: the second night too.
      const restAt = (k) => k >= n || restLike(s.codes[k])
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
        const movable = (d) => s.codes[d] === 'R' && !s.locked[d] && !s.wish[d] && !aroundLeave(s, d)
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
    for (const shift of ['M', 'I', 'A']) {
      let short = dailyNeed[i][shift] - staff.filter((s) => s.codes[i] === shift).length
      // The hospital's rotation (4 → 19 → 20 → R): whoever could work tomorrow's night (days off after it) takes
      // an afternoon today rather than a morning, which would forbid the night.
      const nightTomorrow = (s) => i + 1 < n && !s.codes[i + 1] && (i + 2 >= n || restLike(s.codes[i + 2])) && s.allowed.includes('N') ? 1 : 0
      const rank = (s) => (shift === 'M' ? nightTomorrow(s) * 2 + (s.codes[i - 1] === 'A' ? 1 : 0) : shift === 'A' ? -nightTomorrow(s) : 0)
      const options = open().filter((s) => fits(s, shift)).sort((a, b) => rank(a) - rank(b) || random() - 0.5)
      for (const s of options) {
        if (short <= 0) break
        s.codes[i] = shift
        short -= 1
      }
    }
    for (const s of open()) {
      // Whoever is left works a morning or an afternoon; an intermediate only as many as asked (owner, 9/11/2026).
      const order = ['M', 'A'].filter((code) => dailyNeed[i][code] > 0).sort(() => random() - 0.5)
      if (i + 1 < n && !s.codes[i + 1] && (i + 2 >= n || restLike(s.codes[i + 2]))) order.sort((x, y) => (x === 'M') - (y === 'M'))
      s.codes[i] = order.find((code) => fits(s, code)) || ['M', 'A', 'I', 'N'].find((code) => dailyNeed[i][code] > 0 && fits(s, code)) || 'R'
    }
  }
  for (const s of staff) for (let i = 0; i < n; i += 1) if (!s.codes[i]) s.codes[i] = 'R'

  // 3. Search (simulated annealing) with moves that keep the days off of every week: change one shift, swap two
  //    people's shifts on a day, or move a day off within its week. The best roster seen is kept.
  let score = scoreOf(state)
  let best = { score, codes: staff.map((s) => s.codes.slice()) }
  const accept = (next, step) => {
    if (next <= score) return true
    const temperature = 30 * (1 - step / iterations)
    return temperature > 0.5 && random() < Math.exp((score - next) / temperature)
  }
  for (let step = 0; step < iterations && staff.length; step += 1) {
    const i = Math.floor(random() * n)
    const sa = staff[Math.floor(random() * staff.length)]
    if (sa.locked[i]) continue
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
      if (sb === sa || j === i || sb.locked[i] || sa.locked[j] || sb.locked[j]) continue
      if (!(sa.codes[i] === 'R' && isShift(sb.codes[i]) && isShift(sa.codes[j]) && sb.codes[j] === 'R')) continue
      const before = [sa.codes[i], sb.codes[i], sa.codes[j], sb.codes[j]]
      ;[sa.codes[i], sb.codes[i], sa.codes[j], sb.codes[j]] = [sb.codes[i], 'R', 'R', sa.codes[j]]
      const next = scoreOf(state)
      if (accept(next, step)) score = next
      else [sa.codes[i], sb.codes[i], sa.codes[j], sb.codes[j]] = before
    } else {
      // A day off and a working day of the same person in the same week change places.
      const [from, to] = segments[segmentOf[i]]
      const j = from + Math.floor(random() * (to - from))
      if (j === i || sa.locked[j] || (sa.codes[i] === 'R') === (sa.codes[j] === 'R') || !(isShift(sa.codes[i]) || sa.codes[i] === 'R') || !(isShift(sa.codes[j]) || sa.codes[j] === 'R')) continue
      ;[sa.codes[i], sa.codes[j]] = [sa.codes[j], sa.codes[i]]
      const next = scoreOf(state)
      if (accept(next, step)) score = next
      else [sa.codes[i], sa.codes[j]] = [sa.codes[j], sa.codes[i]]
    }
    if (score < best.score) best = { score, codes: staff.map((s) => s.codes.slice()) }
  }
  staff.forEach((s, k) => { s.codes = best.codes[k] })
  score = best.score

  const assignments = {}
  const totals = {}
  for (const employee of employees || []) {
    assignments[employee.id] = {}
    totals[employee.id] = 0
  }
  for (const s of staff) {
    days.forEach((day, i) => { assignments[s.employee.id][day.date] = s.codes[i] })
    totals[s.employee.id] = s.codes.filter(isShift).length
  }
  const coverage = {}
  days.forEach((day, i) => {
    const count = { M: 0, I: 0, A: 0, N: 0 }
    for (const s of staff) if (isShift(s.codes[i])) count[s.codes[i]] += 1
    coverage[day.date] = count
  })
  const violations = checkRoster({ days, employees, assignments, demand, rules: r, history })
  return { assignments, coverage, violations, totals, score }
}
