// Deterministic helpers for the generated Demo history. The same seed always
// gives the same rows, so tests and screenshots stay stable (no Math.random).
// Dates are written in the Demo's authored frame (DEMO_AUTHORED_ON in
// demoClock.js) and move forward with the rest of each fixture.

// mulberry32: a small, fast seeded generator returning numbers in [0, 1).
export function seededRandom(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(text) {
  let h = 2166136261
  for (const char of String(text)) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return h >>> 0
}

export const pick = (rand, list) => list[Math.floor(rand() * list.length)]
export const between = (rand, min, max) => min + Math.floor(rand() * (max - min + 1))
export const pad2 = value => String(value).padStart(2, '0')

// The twelve authored months of history, oldest first: 2025-09 … 2026-08.
export const DEMO_HISTORY_MONTHS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 8 + index, 1))
  return date.toISOString().slice(0, 7)
})

export function lastDayOfMonth(month) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value, 0)).getUTCDate()
}

// A day of the month, kept before the authored "today" (2026-08-29) for August.
export function dayInMonth(month, day) {
  const limit = month === '2026-08' ? 28 : lastDayOfMonth(month)
  return `${month}-${pad2(Math.min(Math.max(1, day), limit))}`
}

export function addDays(date, days) {
  return new Date(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

// Monthly patient-days of the Demo wards, shared by Management (patient-day
// periods) and Prevention (waste and antiseptic indicators) so their
// per-1,000-patient-day rates agree. Winter months run a little fuller.
const WARD_PATIENT_DAYS = {
  ΜΕΘ: 600,
  Παθολογική: 505,
  Χειρουργική: 390,
  ΤΕΠ: 300,
  Καρδιολογική: 430,
  'Νεογνολογική / ΜΕΝΝ': 215,
  Ορθοπαιδική: 345,
}
export const DEMO_WARDS = Object.keys(WARD_PATIENT_DAYS)
export function demoMonthlyPatientDays(department, month) {
  const base = WARD_PATIENT_DAYS[department]
  if (!base) return null
  const value = Number(month.slice(5, 7))
  const season = [12, 1, 2].includes(value) ? 1.06 : [7, 8].includes(value) ? 0.95 : 1
  const rand = seededRandom(`patient-days|${department}|${month}`)
  const days = lastDayOfMonth(month) / 30.5
  return Math.round(base * season * days * (0.96 + rand() * 0.08))
}
