// Monthly shift roster generator (pure, no I/O).
// Codes: M morning, I intermediate (11-19), A afternoon, N night, R day off; anything else is leave (fixed input).
// The intermediate shift counts like a day shift: never after a night, never right before a night.

export const SHIFT_CODES = ['M', 'I', 'A', 'N']
const FILL_ORDER = ['N', 'M', 'I', 'A']
const DAY_MS = 86400000

export const DEFAULT_RULES = {
  maxConsecutive: 5,
  minWeekendOff: 1,
  forbidMorningToNight: true,
  balanceTolerance: 2
}

const isShift = (code) => code === 'M' || code === 'I' || code === 'A' || code === 'N'
const isDay = (code) => code === 'M' || code === 'I'
const isLeave = (code) => Boolean(code) && !isShift(code) && code !== 'R'

function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function toISO(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function periodDays(startISO, endISO) {
  const days = []
  const end = parseISO(endISO)
  for (let t = parseISO(startISO); t <= end; t += DAY_MS) {
    const weekday = new Date(t).getUTCDay()
    days.push({ date: toISO(t), weekday, weekend: weekday === 0 || weekday === 6 })
  }
  return days
}

// Small seeded PRNG for deterministic tie-breaks.
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

function demandFor(demand, day) {
  const row = (day.weekend ? demand?.weekend : demand?.weekday) || {}
  return { M: Number(row.M) || 0, I: Number(row.I) || 0, A: Number(row.A) || 0, N: Number(row.N) || 0 }
}

// Saturday+Sunday index pairs inside the period.
function weekendPairs(days) {
  const pairs = []
  for (let i = 0; i < days.length - 1; i += 1) {
    if (days[i].weekday === 6 && days[i + 1].weekday === 0) pairs.push([i, i + 1])
  }
  return pairs
}

function streakAround(codes, i) {
  let length = 1
  for (let j = i - 1; j >= 0 && isShift(codes[j]); j -= 1) length += 1
  for (let j = i + 1; j < codes.length && isShift(codes[j]); j += 1) length += 1
  return length
}

// Hard rules for putting `code` on day i, given neighbours already set.
function canPlace(codes, i, code, rules) {
  const prev = codes[i - 1]
  const next = codes[i + 1]
  if (prev === 'N' && isDay(code)) return false
  if (code === 'N' && isDay(next)) return false
  if (rules.forbidMorningToNight) {
    if (isDay(prev) && code === 'N') return false
    if (isDay(code) && next === 'N') return false
  }
  return streakAround(codes, i) <= rules.maxConsecutive
}

export function checkRoster({ days, employees, assignments, demand, rules }) {
  const r = { ...DEFAULT_RULES, ...rules }
  const violations = []
  const active = (employees || []).filter((employee) => employee.active !== false)
  const rows = active.map((employee) => ({
    employee,
    codes: days.map((day) => assignments?.[employee.id]?.[day.date] || '')
  }))

  days.forEach((day, i) => {
    const need = demandFor(demand, day)
    for (const shift of SHIFT_CODES) {
      const have = rows.filter((row) => row.codes[i] === shift).length
      if (have < need[shift]) {
        violations.push({ rule: 'coverage', date: day.date, detail: `${shift} ${have}/${need[shift]}` })
      }
    }
  })

  const pairs = weekendPairs(days)
  for (const { employee, codes } of rows) {
    let streak = 0
    codes.forEach((code, i) => {
      streak = isShift(code) ? streak + 1 : 0
      if (streak === r.maxConsecutive + 1) {
        violations.push({ rule: 'maxConsecutive', employeeId: employee.id, date: days[i].date, detail: `more than ${r.maxConsecutive} consecutive shifts` })
      }
      const next = codes[i + 1]
      if (code === 'N' && isDay(next)) {
        violations.push({ rule: 'nightToMorning', employeeId: employee.id, date: days[i + 1].date, detail: `N followed by ${next}` })
      }
      if (r.forbidMorningToNight && isDay(code) && next === 'N') {
        violations.push({ rule: 'morningToNight', employeeId: employee.id, date: days[i + 1].date, detail: `${code} followed by N` })
      }
    })
    if (pairs.length && r.minWeekendOff > 0) {
      const off = pairs.filter(([sat, sun]) => !isShift(codes[sat]) && !isShift(codes[sun])).length
      if (off < r.minWeekendOff) {
        violations.push({ rule: 'weekendOff', employeeId: employee.id, detail: `${off}/${r.minWeekendOff} full weekends off` })
      }
    }
  }

  const group = rows.filter(({ employee }) => !Object.values(employee.fixed || {}).some(isLeave))
  if (group.length > 1) {
    const counts = group.map(({ codes }) => codes.filter(isShift).length)
    const spread = Math.max(...counts) - Math.min(...counts)
    if (spread > r.balanceTolerance) {
      violations.push({ rule: 'balance', detail: `shift spread ${spread} > ${r.balanceTolerance}` })
    }
  }
  return violations
}

// Tries a few seeded attempts and keeps the one with the fewest violations.
export function generateRoster({ days, employees, demand, rules, seed = 1, attempts = 12 }) {
  const r = { ...DEFAULT_RULES, ...rules }
  const seeds = mulberry32(seed)
  let best = null
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    const result = buildRoster({ days, employees, demand, r, random: mulberry32(Math.floor(seeds() * 4294967296)) })
    const score = result.violations.reduce((sum, violation) => sum + (violation.rule === 'coverage' ? 10 : 1), 0)
    if (!best || score < best.score) best = { result, score }
    if (score === 0) break
  }
  return best.result
}

function buildRoster({ days, employees, demand, r, random }) {
  const n = days.length
  const active = (employees || []).filter((employee) => employee.active !== false)

  const staff = active.map((employee) => {
    const fixed = employee.fixed || {}
    const wishes = employee.wishes || {}
    const codes = days.map((day) => fixed[day.date] || '')
    return {
      employee,
      codes,
      locked: codes.map(Boolean),
      reserved: new Array(n).fill(false),
      wish: days.map((day) => wishes[day.date] === 'R'),
      available: codes.filter((code) => !isLeave(code)).length,
      maxShifts: Number.isFinite(employee.maxShifts) ? employee.maxShifts : Infinity,
      count: codes.filter(isShift).length
    }
  })

  // Targets proportional to available days.
  const totalDemand = days.reduce((sum, day) => {
    const need = demandFor(demand, day)
    return sum + need.M + need.I + need.A + need.N
  }, 0)
  const totalAvailable = staff.reduce((sum, s) => sum + s.available, 0) || 1
  for (const s of staff) s.target = Math.max(totalDemand * s.available / totalAvailable, 0.5)

  const shiftsOf = (s) => s.count
  const dailyNeed = days.map((day) => demandFor(demand, day))

  // Reserve full weekends off upfront, spread across weekends.
  const pairs = weekendPairs(days)
  const load = pairs.map(([sat, sun]) => staff.filter((s) => s.codes[sat] && !isShift(s.codes[sat]) && s.codes[sun] && !isShift(s.codes[sun])).length)
  const order = staff.map((s) => ({ s, k: random() })).sort((a, b) => a.k - b.k).map((x) => x.s)
  if (r.minWeekendOff > 0) {
    for (const s of order) {
      const offPairs = pairs.filter(([sat, sun]) => s.locked[sat] && s.locked[sun] && !isShift(s.codes[sat]) && !isShift(s.codes[sun]))
      let missing = r.minWeekendOff - offPairs.length
      while (missing > 0) {
        const options = pairs
          .map((pair, index) => ({ pair, index }))
          .filter(({ pair: [sat, sun] }) => !s.locked[sat] && !s.locked[sun] && !s.reserved[sat])
          .sort((a, b) => load[a.index] - load[b.index] || random() - 0.5)
        if (!options.length) break
        const { pair: [sat, sun], index } = options[0]
        s.reserved[sat] = true
        s.reserved[sun] = true
        load[index] += 1
        missing -= 1
      }
    }
  }

  const free = (s, i) => !s.locked[i] && !s.reserved[i] && !s.codes[i]

  // Greedy day-by-day fill.
  for (let i = 0; i < n; i += 1) {
    const fixedCount = { M: 0, I: 0, A: 0, N: 0 }
    for (const s of staff) if (isShift(s.codes[i])) fixedCount[s.codes[i]] += 1
    for (const shift of FILL_ORDER) {
      let missing = dailyNeed[i][shift] - fixedCount[shift]
      while (missing > 0) {
        let best = null
        let bestScore = Infinity
        for (const s of staff) {
          if (!free(s, i) || shiftsOf(s) >= s.maxShifts) continue
          s.codes[i] = shift
          const ok = canPlace(s.codes, i, shift, r)
          s.codes[i] = ''
          if (!ok) continue
          const prev = s.codes[i - 1]
          let score = (shiftsOf(s) + 1) / s.target
          if (s.wish[i]) score += 10
          if (prev === 'N' && shift !== 'N') score += 0.5
          if (prev === 'N' && shift === 'N') score -= 0.1
          score += random() * 0.01
          if (score < bestScore) {
            bestScore = score
            best = s
          }
        }
        if (!best) break
        best.codes[i] = shift
        best.count += 1
        missing -= 1
      }
    }
    for (const s of staff) if (!s.codes[i]) s.codes[i] = 'R'
  }

  const canTake = (s, i, shift, allowWish) => {
    if (s.locked[i] || s.reserved[i] || s.codes[i] !== 'R') return false
    if (!allowWish && s.wish[i]) return false
    if (shiftsOf(s) >= s.maxShifts) return false
    s.codes[i] = shift
    const ok = canPlace(s.codes, i, shift, r)
    s.codes[i] = 'R'
    return ok
  }

  // Repair coverage gaps left by the greedy pass.
  for (let i = 0; i < n; i += 1) {
    for (const shift of FILL_ORDER) {
      let missing = dailyNeed[i][shift] - staff.filter((s) => s.codes[i] === shift).length
      for (const allowWish of [false, true]) {
        const candidates = staff
          .filter((s) => canTake(s, i, shift, allowWish))
          .sort((a, b) => shiftsOf(a) / a.target - shiftsOf(b) / b.target)
        while (missing > 0 && candidates.length) {
          const s = candidates.shift()
          if (!canTake(s, i, shift, allowWish)) continue
          s.codes[i] = shift
          s.count += 1
          missing -= 1
        }
      }
      // Still short: someone off takes another shift, and its owner switches to this one.
      for (const off of staff) {
        if (missing <= 0) break
        for (const worker of staff) {
          const other = worker.codes[i]
          if (!isShift(other) || other === shift || worker.locked[i] || !canTake(off, i, other, true)) continue
          worker.codes[i] = 'R'
          const ok = canTake(worker, i, shift, true)
          worker.codes[i] = other
          if (!ok) continue
          off.codes[i] = other
          off.count += 1
          worker.codes[i] = shift
          missing -= 1
          break
        }
      }
      // Last resort: move someone's reserved weekend to another weekend they already have off.
      for (const s of staff) {
        if (missing <= 0) break
        const own = pairs.find((pair) => pair.includes(i))
        if (!own || !s.reserved[i] || s.locked[i]) continue
        const swap = pairs.find(([sat, sun]) => sat !== own[0] && s.codes[sat] === 'R' && s.codes[sun] === 'R' && !s.locked[sat] && !s.locked[sun])
        if (!swap) continue
        own.forEach((day) => { s.reserved[day] = false })
        if (!canTake(s, i, shift, true)) {
          own.forEach((day) => { s.reserved[day] = true })
          continue
        }
        swap.forEach((day) => { s.reserved[day] = true })
        s.codes[i] = shift
        s.count += 1
        missing -= 1
      }
    }
  }

  // Balance repair: move a shift from the most loaded to the least loaded employee.
  const deviation = (s) => shiftsOf(s) - s.target
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const ranked = staff.slice().sort((a, b) => deviation(b) - deviation(a))
    let moved = false
    for (let h = 0; h < ranked.length && !moved; h += 1) {
      const hi = ranked[h]
      for (let l = ranked.length - 1; l > h && !moved; l -= 1) {
        const lo = ranked[l]
        if (deviation(hi) - deviation(lo) <= 1.5) break
        for (let i = 0; i < n && !moved; i += 1) {
          const shift = hi.codes[i]
          if (!isShift(shift) || hi.locked[i] || !canTake(lo, i, shift, false)) continue
          hi.codes[i] = 'R'
          hi.count -= 1
          lo.codes[i] = shift
          lo.count += 1
          moved = true
        }
      }
    }
    if (!moved) break
  }

  const assignments = {}
  const totals = {}
  for (const employee of employees || []) {
    assignments[employee.id] = {}
    totals[employee.id] = 0
  }
  for (const s of staff) {
    days.forEach((day, i) => { assignments[s.employee.id][day.date] = s.codes[i] })
    totals[s.employee.id] = shiftsOf(s)
  }
  const coverage = {}
  days.forEach((day, i) => {
    const count = { M: 0, I: 0, A: 0, N: 0 }
    for (const s of staff) if (isShift(s.codes[i])) count[s.codes[i]] += 1
    coverage[day.date] = count
  })
  const violations = checkRoster({ days, employees, assignments, demand, rules: r })
  return { assignments, coverage, violations, totals }
}
