import { demoOffsetDays, shiftDemoMonth } from './demoClock'
// Deterministic helpers for the generated Demo history. The same seed always
// gives the same rows, so tests and screenshots stay stable (no Math.random).
// Dates are written in the Demo's authored frame (DEMO_AUTHORED_ON in
// demoClock.js) and move forward with the rest of each fixture.

// mulberry32: a small, fast seeded generator returning numbers in [0, 1).
export function seededRandom(seed: number | string): () => number {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(text: unknown) {
  let h = 2166136261
  for (const char of String(text)) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return h >>> 0
}

export const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)]
export const between = (rand: () => number, min: number, max: number): number => min + Math.floor(rand() * (max - min + 1))
export const pad2 = (value: unknown): string => String(value).padStart(2, '0')

// The authored months of history, oldest first, up to 2026-08. They start so that, once the Demo's dates move to
// today, the history begins in January 2025 (owner, 9/11/2026: the Demo shows the whole of 2025): 2025-01 … 2026-08
// as authored, and two months earlier for every two months since.
export const DEMO_HISTORY_MONTHS = (() => {
  const back = Math.round(demoOffsetDays() / 30.4375)
  const first = shiftDemoMonth('2025-01', -back)
  const [year, month] = String(first).split('-').map(Number)
  const count = (2026 - year) * 12 + 8 - month + 1
  return Array.from({ length: Math.max(12, count) }, (_, index) => new Date(Date.UTC(year, month - 1 + index, 1)).toISOString().slice(0, 7))
})()

// The months before the last twelve: trends (compliance rising month by month) keep their last-twelve values and
// run backwards over the earlier months.
export const DEMO_HISTORY_LEAD = DEMO_HISTORY_MONTHS.length - 12

export function lastDayOfMonth(month: string): number {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value, 0)).getUTCDate()
}

// A day of the month, kept before the authored "today" (2026-08-29) for August.
export function dayInMonth(month: string, day: number): string {
  const limit = month === '2026-08' ? 28 : lastDayOfMonth(month)
  return `${month}-${pad2(Math.min(Math.max(1, day), limit))}`
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

// Monthly patient-days of the Demo wards, shared by Management (patient-day
// periods) and Prevention (waste and antiseptic indicators) so their
// per-1,000-patient-day rates agree. Winter months run a little fuller.
const WARD_PATIENT_DAYS: Record<string, number> = {
  ΜΕΘ: 600,
  Παθολογική: 505,
  Χειρουργική: 390,
  ΤΕΠ: 300,
  Καρδιολογική: 430,
  'Νεογνολογική / ΜΕΝΝ': 215,
  Ορθοπαιδική: 345,
}
export const DEMO_WARDS = Object.keys(WARD_PATIENT_DAYS)
export function demoMonthlyPatientDays(department: string, month: string): number | null {
  const base = WARD_PATIENT_DAYS[department]
  if (!base) return null
  const value = Number(month.slice(5, 7))
  const season = [12, 1, 2].includes(value) ? 1.06 : [7, 8].includes(value) ? 0.95 : 1
  const rand = seededRandom(`patient-days|${department}|${month}`)
  const days = lastDayOfMonth(month) / 30.5
  return Math.round(base * season * days * (0.96 + rand() * 0.08))
}
