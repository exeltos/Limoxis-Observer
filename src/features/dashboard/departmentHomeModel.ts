// «Το τμήμα μου» of the Department Manager: the figures of their department(s) for a period and its comparison
// period, the series of its charts and the organisms of its positive samples (counts only, never a patient). A
// hospital reads them in one call (department_home_period_overview, 20261231603000), the Demo from its sample records
// (demoDashboardMetrics.collectDemoDepartmentHome); both end up in this shape.
// The period (owner, 20/11/2026): Μήνας, Τρίμηνο, Εξάμηνο or Έτος as the registers have them (registerEngine), compared
// with the previous period or the same period last year (registerReport.comparePeriod); the current month by default.
import { hospitalDate } from '../../core/dates/hospitalDate'
import { periodLabel, periodLength, periodOf, type Period } from '../registers/registerEngine'
import { comparePeriod } from '../registers/registerReport'

export type PeriodKind = 'month' | 'quarter' | 'half' | 'year'
export type CompareChoice = 'previous' | 'lastYear'
// The positives chart counts weeks for a month or a quarter, months for a half-year or a year.
export type Bucket = 'week' | 'month'
export const PERIOD_KINDS: readonly PeriodKind[] = Object.freeze(['month', 'quarter', 'half', 'year'])
export const COMPARE_CHOICES: readonly CompareChoice[] = Object.freeze(['previous', 'lastYear'])
// The period shown and the one it is compared with.
export interface DepartmentHomeWindow { kind: PeriodKind, choice: CompareChoice, period: Period, compare: Period, bucket: Bucket }

// A bucket of positive samples: its first day ('YYYY-MM-DD', a Monday or the 1st), the MDR/XDR/PDR ones and the others.
export interface BucketPositives { start: string, mdr: number, other: number }
// A month of hand hygiene ('YYYY-MM'): observed opportunities and compliant ones (pct null without observations).
export interface MonthlyHandHygiene { month: string, observations: number, compliant: number, pct: number | null }
// One of the most frequent organisms of the period: how many positive samples, how many of them MDR/XDR/PDR, and how
// many samples of the same organism the comparison period had.
export interface OrganismCount { organism: string, count: number, mdr: number, compareCount: number }

// The figures of one period. A figure is null when its module is locked (or, for a percentage, when nothing was recorded).
export interface PeriodFigures {
  positives: number | null
  positivesMdr: number | null
  positivesAwaiting: number | null
  patients: number | null
  organismsCount: number | null
  newSurveillance: number | null
  newIsolation: number | null
  handHygienePct: number | null
  handHygieneObservations: number | null
  // «Έλεγχοι εκτός χρόνου»: entries done outside their window, and assignments fallen overdue in the period and not done yet.
  lateControls: number | null
}

export interface DepartmentHomeOverview extends PeriodFigures {
  from: string
  to: string
  compareFrom: string
  compareTo: string
  bucket: Bucket
  compare: PeriodFigures
  organisms: OrganismCount[]
  organismsOtherCount: number | null
  positivesSeries: BucketPositives[]
  positivesCompareSeries: BucketPositives[]
  monthlyHandHygiene: MonthlyHandHygiene[]
  monthlyHandHygieneCompare: MonthlyHandHygiene[]
  // Today, whatever the period: the tiles' small lines, «Για μένα σήμερα» and the announcements' footer.
  inpatients: number
  beds: number | null
  admissionsToday: number
  reassessmentsDueToday: number | null
  handHygieneTarget: number
  overdueControls: number | null
  controlsDueToday: number | null
  pendingRosterRequests: number
  trainingExpiring30: number | null
  trainingPct: number | null
  fluPct: number | null
  falls30: number | null
  pressureUlcers30: number | null
}

// The organisms «Μικρόβια του τμήματος» names; the rest add up in one line.
export const ORGANISMS_SHOWN = 4
// Hand hygiene per month shows at least this many months, up to the end of the period.
export const MONTHS_SHOWN = 6
// The WHO hand hygiene target when the hospital has none of its own.
export const DEFAULT_HAND_HYGIENE_TARGET = 80
// Resistance classes that count as «MDR/XDR».
export const MDR_CLASSES: readonly string[] = Object.freeze(['MDR', 'XDR', 'PDR'])
export const isMdrClass = (value: unknown) => MDR_CLASSES.includes(String(value ?? '').trim().toUpperCase())

const DAY_MS = 24 * 60 * 60 * 1000
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS
const dayOf = (value: number) => new Date(value * DAY_MS).toISOString().slice(0, 10)
const monthIndex = (day: string) => { const [year, month] = day.split('-').map(Number); return year * 12 + month - 1 }
const monthOf = (index: number) => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`

// The period of a kind that holds `day`, its comparison and the chart's bucket.
export function departmentHomeWindow(kind: PeriodKind = 'month', day: string = hospitalDate(), choice: CompareChoice = 'previous'): DepartmentHomeWindow {
  const period = periodOf(kind, day)
  return { kind, choice, period, compare: comparePeriod(choice, period) as Period, bucket: kind === 'month' || kind === 'quarter' ? 'week' : 'month' }
}

// The buckets of a period: its weeks (Monday to Sunday, the first one starting on or before its first day) or its months.
export function bucketStarts(from: string, to: string, bucket: Bucket): string[] {
  if (bucket === 'month') return Array.from({ length: monthIndex(to) - monthIndex(from) + 1 }, (_, index) => `${monthOf(monthIndex(from) + index)}-01`)
  const first = dayNumber(from) - ((new Date(dayNumber(from) * DAY_MS).getUTCDay() + 6) % 7)
  return Array.from({ length: Math.floor((dayNumber(to) - first) / 7) + 1 }, (_, index) => dayOf(first + 7 * index))
}
// The last `count` months up to the month of `day`, 'YYYY-MM', that month last.
export function monthKeys(day: string, count = MONTHS_SHOWN): string[] {
  return Array.from({ length: count }, (_, index) => monthOf(monthIndex(day) - (count - 1 - index)))
}
// The months hand hygiene shows for a period: the period's months, at least MONTHS_SHOWN up to its end.
export const handHygieneMonthCount = (period: Pick<Period, 'from' | 'to'>) => Math.max(MONTHS_SHOWN, monthIndex(period.to) - monthIndex(period.from) + 1)

// Positive samples ({ day, mdr }) counted into the buckets of [from, to]; days outside the period do not count.
export function bucketedPositives(samples: Array<{ day: string, mdr: boolean }>, from: string, to: string, bucket: Bucket): BucketPositives[] {
  const rows = bucketStarts(from, to, bucket).map(start => ({ start, mdr: 0, other: 0 }))
  for (const sample of samples) {
    if (!sample.day || sample.day < from || sample.day > to) continue
    const index = bucket === 'month' ? monthIndex(sample.day) - monthIndex(from) : Math.floor((dayNumber(sample.day) - dayNumber(rows[0].start)) / 7)
    const row = rows[index]
    if (row) row[sample.mdr ? 'mdr' : 'other'] += 1
  }
  return rows
}

const percent = (compliant: number, observations: number) => observations > 0 ? Math.round(compliant / observations * 1000) / 10 : null
// Positive samples ({ patient, organism, mdr }) as «Μικρόβια του τμήματος» counts them: distinct patients, distinct
// organisms (trimmed), the most frequent first (then by name), each with its count among `compareSamples`, and how
// many samples the other organisms have.
export function organismSummary(samples: Array<{ patient: string | null, organism: string | null, mdr: boolean }>, compareSamples: Array<{ organism: string | null }> = [], shown = ORGANISMS_SHOWN) {
  const groups = new Map<string, OrganismCount>()
  for (const sample of samples) {
    const name = String(sample.organism ?? '').trim()
    if (!name) continue
    const group = groups.get(name) || { organism: name, count: 0, mdr: 0, compareCount: 0 }
    group.count += 1
    if (sample.mdr) group.mdr += 1
    groups.set(name, group)
  }
  const before = new Map<string, number>()
  for (const sample of compareSamples) { const name = String(sample.organism ?? '').trim(); if (name) before.set(name, (before.get(name) || 0) + 1) }
  const ranked = [...groups.values()].sort((a, b) => b.count - a.count || (a.organism < b.organism ? -1 : a.organism > b.organism ? 1 : 0))
  return {
    patients: new Set(samples.map(sample => sample.patient).filter(Boolean)).size,
    organismsCount: ranked.length,
    organisms: ranked.slice(0, shown).map(row => ({ ...row, compareCount: before.get(row.organism) || 0 })),
    organismsOtherCount: ranked.slice(shown).reduce((sum, row) => sum + row.count, 0),
    compareOrganismsCount: before.size,
  }
}

// Hand hygiene sessions ({ day, observations, compliant }) added up by month: the `count` months up to the month of `end`.
export function monthlyHandHygieneSeries(sessions: Array<{ day: string, observations: number, compliant: number }>, end: string, count = MONTHS_SHOWN): MonthlyHandHygiene[] {
  const rows = monthKeys(end, count).map(month => ({ month, observations: 0, compliant: 0, pct: null as number | null }))
  for (const session of sessions) {
    const row = rows.find(item => item.month === String(session.day).slice(0, 7))
    if (!row || String(session.day) > end) continue
    row.observations += Number(session.observations) || 0
    row.compliant += Number(session.compliant) || 0
  }
  return rows.map(row => ({ ...row, pct: percent(row.compliant, row.observations) }))
}

// The change from the comparison period: null when either is missing.
export const delta = (now: number | null | undefined, before: number | null | undefined) => now == null || before == null ? null : Math.round((now - before) * 10) / 10

// How a period reads: «Νοέμβριος 2026», «Οκτ–Δεκ 2026», «2026».
const SHORT_MONTHS: Record<string, string[]> = { el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }
export const shortMonth = (month: number, language = 'el') => SHORT_MONTHS[language === 'en' ? 'en' : 'el'][month - 1] || String(month)
export function periodRangeLabel(period: Period, language = 'el') {
  const length = periodLength(period)
  if (length === 1 || length === 12) return periodLabel(period, language)
  return `${shortMonth(Number(period.from.slice(5, 7)), language)}–${shortMonth(Number(period.to.slice(5, 7)), language)} ${period.to.slice(0, 4)}`
}
const KIND_LABELS: Record<PeriodKind, [string, string]> = { month: ['Μήνας', 'Month'], quarter: ['Τρίμηνο', 'Quarter'], half: ['Εξάμηνο', 'Half-year'], year: ['Έτος', 'Year'] }
// The page's subtitle: «Τρίμηνο Οκτ–Δεκ 2026» and «σε σύγκριση με Ιούλ–Σεπ 2026» (a tablet shows only the second: the
// stepper already names the period).
export function windowSubtitleParts(window: DepartmentHomeWindow, language = 'el') {
  const en = language === 'en'
  const kind = window.kind === 'month' ? '' : `${KIND_LABELS[window.kind][en ? 1 : 0]} `
  return { period: `${kind}${periodRangeLabel(window.period, language)}`, compare: `${en ? 'compared with' : 'σε σύγκριση με'} ${periodRangeLabel(window.compare, language)}` }
}
export function windowSubtitle(window: DepartmentHomeWindow, language = 'el') {
  const { period, compare } = windowSubtitleParts(window, language)
  return `${period} ${compare}`
}

const count = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const maybe = (value: unknown) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
const figuresOf = (data: Record<string, unknown>): PeriodFigures => ({
  positives: maybe(data.positives),
  positivesMdr: maybe(data.positivesMdr),
  positivesAwaiting: maybe(data.positivesAwaiting),
  patients: maybe(data.patients),
  organismsCount: maybe(data.organismsCount),
  newSurveillance: maybe(data.newSurveillance),
  newIsolation: maybe(data.newIsolation),
  handHygienePct: maybe(data.handHygienePct),
  handHygieneObservations: maybe(data.handHygieneObservations),
  lateControls: maybe(data.lateControls),
})
const series = (raw: unknown, starts: string[]) => {
  const rows = new Map((Array.isArray(raw) ? raw : []).map((row: Record<string, unknown>) => [String(row.start).slice(0, 10), row]))
  return starts.map(start => { const row = rows.get(start); return { start, mdr: count(row?.mdr), other: count(row?.other) } })
}
const months = (raw: unknown, keys: string[]) => {
  const rows = new Map((Array.isArray(raw) ? raw : []).map((row: Record<string, unknown>) => [String(row.month).slice(0, 7), row]))
  return keys.map(month => {
    const row = rows.get(month)
    const observations = count(row?.observations), compliant = count(row?.compliant)
    return { month, observations, compliant, pct: row?.pct != null ? maybe(row.pct) : percent(compliant, observations) }
  })
}

// What the database (or the Demo) gave, in the shape of the screen: the buckets and months of the two periods filled with zeros.
export function normalizeDepartmentHome(raw: Record<string, unknown> | null | undefined, window: DepartmentHomeWindow = departmentHomeWindow()): DepartmentHomeOverview {
  const data = raw || {}
  const { period, compare, bucket } = window
  const monthCount = handHygieneMonthCount(period)
  return {
    from: period.from,
    to: period.to,
    compareFrom: compare.from,
    compareTo: compare.to,
    bucket,
    ...figuresOf(data),
    compare: figuresOf((data.compare && typeof data.compare === 'object' ? data.compare : {}) as Record<string, unknown>),
    organisms: (Array.isArray(data.organisms) ? data.organisms : []).slice(0, ORGANISMS_SHOWN).map((row: Record<string, unknown>) => ({ organism: String(row.organism ?? '').trim(), count: count(row.count), mdr: count(row.mdr), compareCount: count(row.compareCount) })).filter(row => row.organism && row.count > 0),
    organismsOtherCount: maybe(data.organismsOtherCount),
    positivesSeries: series(data.positivesSeries, bucketStarts(period.from, period.to, bucket)),
    positivesCompareSeries: series(data.positivesCompareSeries, bucketStarts(compare.from, compare.to, bucket)),
    monthlyHandHygiene: months(data.monthlyHandHygiene, monthKeys(period.to, monthCount)),
    monthlyHandHygieneCompare: months(data.monthlyHandHygieneCompare, monthKeys(compare.to, monthCount)),
    inpatients: count(data.inpatients),
    beds: maybe(data.beds),
    admissionsToday: count(data.admissionsToday),
    reassessmentsDueToday: maybe(data.reassessmentsDueToday),
    handHygieneTarget: maybe(data.handHygieneTarget) ?? DEFAULT_HAND_HYGIENE_TARGET,
    overdueControls: maybe(data.overdueControls),
    controlsDueToday: maybe(data.controlsDueToday),
    pendingRosterRequests: count(data.pendingRosterRequests),
    trainingExpiring30: maybe(data.trainingExpiring30),
    trainingPct: maybe(data.trainingPct),
    fluPct: maybe(data.fluPct),
    falls30: maybe(data.falls30),
    pressureUlcers30: maybe(data.pressureUlcers30),
  }
}
