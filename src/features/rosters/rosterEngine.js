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

export const isShift = (code) => code === 'M' || code === 'I' || code === 'A' || code === 'N'
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
  return { M: Number(row.M) || 0, I: Number(row.I) || 0, A: Number(row.A) || 0, N: Number(row.N) || 0 }
}

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
    targets[employee.id] = days.filter((day) => !day.weekend && !isLeave(fixed[day.date])).length
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

const historyOf = (history, id) => (Array.isArray(history?.[id]) ? history[id].slice(-7) : [])

export function checkRoster({ days, employees, assignments, demand, rules, history = {} }) {
  const r = { ...DEFAULT_RULES, ...rules }
  const violations = []
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
    for (const problem of rowProblems(codes, historyOf(history, employee.id), days, r)) {
      violations.push({ rule: problem.rule, employeeId: employee.id, date: problem.index >= 0 ? days[problem.index].date : undefined })
    }
  }
  // Fair share: each person's distance from their target, compared with the group's (a department with more people
  // than shifts leaves everyone a little under target, evenly).
  const targets = shiftTargets(days, active)
  const gaps = rows.map(({ employee, codes }) => ({ employee, gap: codes.filter(isShift).length - targets[employee.id] }))
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
    let shifts = 0
    let nights = 0
    let weekendWork = 0
    for (let i = 0; i < days.length; i += 1) {
      const code = s.codes[i]
      if (!isShift(code)) {
        if (code === 'R' && isShift(i === 0 ? s.prefix[s.prefix.length - 1] : s.codes[i - 1]) && isShift(s.codes[i + 1])) score += 14
        continue
      }
      shifts += 1
      if (code === 'N') nights += 1
      if (weekendIdx.has(i)) weekendWork += 1
      if (s.wish[i]) score += s.wishWeight
    }
    s.gap = shifts - s.target
    // Above target costs (overtime); below it only counts against the group's mean (below).
    if (s.gap > 0) score += s.gap * 12
    s.nights = nights
    s.weekendWork = weekendWork
  }
  const mean = (key) => staff.reduce((sum, s) => sum + s[key], 0) / (staff.length || 1)
  const meanNights = mean('nights')
  const meanWeekend = mean('weekendWork')
  const meanGap = mean('gap')
  for (const s of staff) score += Math.abs(s.gap - meanGap) * 12 + Math.abs(s.nights - meanNights) * 4 + Math.abs(s.weekendWork - meanWeekend) * 3
  for (let i = 0; i < days.length; i += 1) {
    for (const shift of SHIFT_CODES) {
      let have = 0
      for (const s of staff) if (s.codes[i] === shift) have += 1
      const need = dailyNeed[i][shift]
      // A shift the day does not ask for at all (an intermediate on a Sunday) is never given.
      score += have < need ? (need - have) * 300 : need === 0 ? have * 1000 : (have - need) * 6
    }
  }
  return score
}

// May the person take `code` on day i? Looks backwards only (the days after are still free).
function allowedBackward(s, i, code, r, days) {
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
  let best = null
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    const result = buildRoster({ days, employees, demand, r, history, random: mulberry32(Math.floor(seeds() * 4294967296)), iterations })
    if (!best || result.score < best.score) best = result
    if (result.violations.length === 0) break
  }
  return best
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
    const codes = days.map((day) => fixed[day.date] || '')
    return {
      employee,
      codes,
      locked: codes.map(Boolean),
      prefix: historyOf(history, employee.id),
      wish: days.map((day) => wishes[day.date] === 'R'),
      // Earlier in the list, higher priority for wishes.
      wishWeight: 60 + Math.max(0, active.length - order) * 4,
      target: targets[employee.id],
      reserved: new Array(n).fill(false)
    }
  })
  const dailyNeed = days.map((day) => demandFor(demand, day))
  const state = { staff, days, dailyNeed, r, weekendIdx }

  // One whole weekend off each, spread over the weekends.
  const load = pairs.map(() => 0)
  for (const s of staff.slice().sort(() => random() - 0.5)) {
    const already = pairs.filter(([sat, sun]) => s.locked[sat] && s.locked[sun] && !isShift(s.codes[sat]) && !isShift(s.codes[sun])).length
    if (already >= r.minWeekendOff) continue
    const options = pairs.map((pair, index) => ({ pair, index })).filter(({ pair: [sat, sun] }) => !s.locked[sat] && !s.locked[sun])
    options.sort((a, b) => load[a.index] - load[b.index] || random() - 0.5)
    for (const { pair, index } of options.slice(0, r.minWeekendOff - already)) {
      pair.forEach((i) => { s.reserved[i] = true })
      load[index] += 1
    }
  }

  // Greedy, day by day: nights first (they bind the next days), then mornings, intermediates, afternoons.
  for (let i = 0; i < n; i += 1) {
    for (const shift of ['N', 'M', 'I', 'A']) {
      let missing = dailyNeed[i][shift] - staff.filter((s) => s.codes[i] === shift).length
      while (missing > 0) {
        let pick = null
        let pickScore = Infinity
        for (const s of staff) {
          if (s.codes[i] || s.reserved[i] || !allowedBackward(s, i, shift, r, days)) continue
          const done = s.codes.slice(0, i).filter(isShift).length
          let score = done / Math.max(1, s.target) + random() * 0.05
          if (s.wish[i]) score += 5
          if (shift === 'N' && s.codes[i - 1] === 'N') score -= 0.4
          if (score < pickScore) {
            pickScore = score
            pick = s
          }
        }
        if (!pick) break
        pick.codes[i] = shift
        missing -= 1
      }
    }
    for (const s of staff) if (!s.codes[i]) s.codes[i] = 'R'
  }

  // Local search: swap two people's codes on a day, or change one cell; keep what does not make the roster worse.
  let score = scoreOf(state)
  for (let step = 0; step < iterations && staff.length; step += 1) {
    const i = Math.floor(random() * n)
    const sa = staff[Math.floor(random() * staff.length)]
    if (sa.locked[i]) continue
    const roll = random()
    if (roll < 0.25 && i + 1 < n && !sa.locked[i + 1] && sa.codes[i] !== sa.codes[i + 1]) {
      // One person's two neighbouring days change places: it gathers days off into pairs.
      ;[sa.codes[i], sa.codes[i + 1]] = [sa.codes[i + 1], sa.codes[i]]
      const next = scoreOf(state)
      if (next <= score) score = next
      else [sa.codes[i], sa.codes[i + 1]] = [sa.codes[i + 1], sa.codes[i]]
    } else if (roll < 0.7 && staff.length > 1) {
      const sb = staff[Math.floor(random() * staff.length)]
      if (sb === sa || sb.locked[i] || sa.codes[i] === sb.codes[i]) continue
      ;[sa.codes[i], sb.codes[i]] = [sb.codes[i], sa.codes[i]]
      const next = scoreOf(state)
      if (next <= score) score = next
      else [sa.codes[i], sb.codes[i]] = [sb.codes[i], sa.codes[i]]
    } else {
      const before = sa.codes[i]
      // Only the shifts the day asks for (a department without intermediates never gets one).
      const options = ['R', ...SHIFT_CODES.filter((code) => dailyNeed[i][code] > 0)].filter((code) => code !== before)
      sa.codes[i] = options[Math.floor(random() * options.length)]
      const next = scoreOf(state)
      if (next <= score) score = next
      else sa.codes[i] = before
    }
  }

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
