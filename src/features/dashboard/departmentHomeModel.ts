// «Το τμήμα μου» of the Department Manager: the figures of their department(s), the two
// series of its charts and the organisms of its positive samples (counts only, never a patient). A hospital reads them in one call
// (department_home_overview, 20261231601000), the Demo from its sample records
// (demoDashboardMetrics.collectDemoDepartmentHome); both end up in this shape.
import { hospitalDate } from '../../core/dates/hospitalDate'

// A week of positive samples: its Monday ('YYYY-MM-DD'), the MDR/XDR/PDR ones and the others.
export interface WeeklyPositives { week: string, mdr: number, other: number }
// A month of hand hygiene ('YYYY-MM'): observed opportunities and compliant ones (pct null without observations).
export interface MonthlyHandHygiene { month: string, observations: number, compliant: number, pct: number | null }
// One of the most frequent organisms of the 30 days: how many positive samples, how many of them MDR/XDR/PDR.
export interface OrganismCount { organism: string, count: number, mdr: number }

// A figure is null when its module is locked (or, for a percentage, when nothing was recorded).
export interface DepartmentHomeOverview {
  inpatients: number
  beds: number | null
  admissionsToday: number
  positives30: number | null
  positivesMdr30: number | null
  positivesAwaiting30: number | null
  activeSurveillance: number | null
  activeIsolation: number | null
  reassessmentsDueToday: number | null
  handHygienePct: number | null
  handHygieneObservations: number | null
  handHygieneTarget: number
  overdueControls: number | null
  controlsDueToday: number | null
  pendingRosterRequests: number
  trainingExpiring30: number | null
  trainingPct: number | null
  fluPct: number | null
  falls30: number | null
  pressureUlcers30: number | null
  weeklyPositives: WeeklyPositives[]
  monthlyHandHygiene: MonthlyHandHygiene[]
  patients30: number | null
  organisms30Count: number | null
  organisms30: OrganismCount[]
  organismsOtherCount: number | null
}

export const WEEKS_SHOWN = 12
// The organisms «Μικρόβια του τμήματος» names; the rest add up in one line.
export const ORGANISMS_SHOWN = 4
export const MONTHS_SHOWN = 6
// The WHO hand hygiene target when the hospital has none of its own.
export const DEFAULT_HAND_HYGIENE_TARGET = 80
// Resistance classes that count as «MDR/XDR».
export const MDR_CLASSES: readonly string[] = Object.freeze(['MDR', 'XDR', 'PDR'])
export const isMdrClass = (value: unknown) => MDR_CLASSES.includes(String(value ?? '').trim().toUpperCase())

const DAY_MS = 24 * 60 * 60 * 1000
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS
const dayOf = (value: number) => new Date(value * DAY_MS).toISOString().slice(0, 10)

// The Mondays of the last `count` weeks (Monday to Sunday), the current one last.
export function weekStarts(today: string, count = WEEKS_SHOWN): string[] {
  const day = dayNumber(today)
  const monday = day - ((new Date(day * DAY_MS).getUTCDay() + 6) % 7)
  return Array.from({ length: count }, (_, index) => dayOf(monday - 7 * (count - 1 - index)))
}
// The last `count` months, 'YYYY-MM', the current one last.
export function monthKeys(today: string, count = MONTHS_SHOWN): string[] {
  const [year, month] = today.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const at = year * 12 + month - 1 - (count - 1 - index)
    return `${Math.floor(at / 12)}-${String(at % 12 + 1).padStart(2, '0')}`
  })
}

// Positive samples ({ day, mdr }) counted into the weeks they were collected in.
export function weeklyPositiveSeries(samples: Array<{ day: string, mdr: boolean }>, today: string, count = WEEKS_SHOWN): WeeklyPositives[] {
  const weeks = weekStarts(today, count)
  const rows = weeks.map(week => ({ week, mdr: 0, other: 0 }))
  const first = dayNumber(weeks[0]), last = dayNumber(today)
  for (const sample of samples) {
    const day = dayNumber(sample.day)
    if (!Number.isFinite(day) || day < first || day > last) continue
    const row = rows[Math.floor((day - first) / 7)]
    if (row) row[sample.mdr ? 'mdr' : 'other'] += 1
  }
  return rows
}

const percent = (compliant: number, observations: number) => observations > 0 ? Math.round(compliant / observations * 1000) / 10 : null
// Positive samples ({ patient, organism, mdr }) as «Μικρόβια του τμήματος» counts them: distinct patients, distinct
// organisms (trimmed), the most frequent first (then by name) and how many samples the other organisms have.
export function organismSummary(samples: Array<{ patient: string | null, organism: string | null, mdr: boolean }>, shown = ORGANISMS_SHOWN) {
  const groups = new Map<string, OrganismCount>()
  for (const sample of samples) {
    const name = String(sample.organism ?? '').trim()
    if (!name) continue
    const group = groups.get(name) || { organism: name, count: 0, mdr: 0 }
    group.count += 1
    if (sample.mdr) group.mdr += 1
    groups.set(name, group)
  }
  const ranked = [...groups.values()].sort((a, b) => b.count - a.count || (a.organism < b.organism ? -1 : a.organism > b.organism ? 1 : 0))
  return {
    patients30: new Set(samples.map(sample => sample.patient).filter(Boolean)).size,
    organisms30Count: ranked.length,
    organisms30: ranked.slice(0, shown),
    organismsOtherCount: ranked.slice(shown).reduce((sum, row) => sum + row.count, 0),
  }
}

// Hand hygiene sessions ({ day, observations, compliant }) added up by month.
export function monthlyHandHygieneSeries(sessions: Array<{ day: string, observations: number, compliant: number }>, today: string, count = MONTHS_SHOWN): MonthlyHandHygiene[] {
  const rows = monthKeys(today, count).map(month => ({ month, observations: 0, compliant: 0, pct: null as number | null }))
  for (const session of sessions) {
    const row = rows.find(item => item.month === String(session.day).slice(0, 7))
    if (!row || String(session.day) > today) continue
    row.observations += Number(session.observations) || 0
    row.compliant += Number(session.compliant) || 0
  }
  return rows.map(row => ({ ...row, pct: percent(row.compliant, row.observations) }))
}

const count = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const maybe = (value: unknown) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)

// What the database (or the Demo) gave, in the shape of the screen: missing weeks and months filled with zeros.
export function normalizeDepartmentHome(raw: Record<string, unknown> | null | undefined, today = hospitalDate()): DepartmentHomeOverview {
  const data = raw || {}
  const weekly = new Map((Array.isArray(data.weeklyPositives) ? data.weeklyPositives : []).map((row: Record<string, unknown>) => [String(row.week).slice(0, 10), row]))
  const monthly = new Map((Array.isArray(data.monthlyHandHygiene) ? data.monthlyHandHygiene : []).map((row: Record<string, unknown>) => [String(row.month).slice(0, 7), row]))
  return {
    inpatients: count(data.inpatients),
    beds: maybe(data.beds),
    admissionsToday: count(data.admissionsToday),
    positives30: maybe(data.positives30),
    positivesMdr30: maybe(data.positivesMdr30),
    positivesAwaiting30: maybe(data.positivesAwaiting30),
    activeSurveillance: maybe(data.activeSurveillance),
    activeIsolation: maybe(data.activeIsolation),
    reassessmentsDueToday: maybe(data.reassessmentsDueToday),
    handHygienePct: maybe(data.handHygienePct),
    handHygieneObservations: maybe(data.handHygieneObservations),
    handHygieneTarget: maybe(data.handHygieneTarget) ?? DEFAULT_HAND_HYGIENE_TARGET,
    overdueControls: maybe(data.overdueControls),
    controlsDueToday: maybe(data.controlsDueToday),
    pendingRosterRequests: count(data.pendingRosterRequests),
    trainingExpiring30: maybe(data.trainingExpiring30),
    trainingPct: maybe(data.trainingPct),
    fluPct: maybe(data.fluPct),
    falls30: maybe(data.falls30),
    pressureUlcers30: maybe(data.pressureUlcers30),
    weeklyPositives: weekStarts(today).map(week => { const row = weekly.get(week); return { week, mdr: count(row?.mdr), other: count(row?.other) } }),
    monthlyHandHygiene: monthKeys(today).map(month => {
      const row = monthly.get(month)
      const observations = count(row?.observations), compliant = count(row?.compliant)
      return { month, observations, compliant, pct: row?.pct != null ? maybe(row.pct) : percent(compliant, observations) }
    }),
    patients30: maybe(data.patients30),
    organisms30Count: maybe(data.organisms30Count),
    organisms30: (Array.isArray(data.organisms30) ? data.organisms30 : []).slice(0, ORGANISMS_SHOWN).map((row: Record<string, unknown>) => ({ organism: String(row.organism ?? '').trim(), count: count(row.count), mdr: count(row.mdr) })).filter(row => row.organism && row.count > 0),
    organismsOtherCount: maybe(data.organismsOtherCount),
  }
}
