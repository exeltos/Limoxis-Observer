// Control programme adherence: how many executions a schedule called for in a
// period, how many were recorded, how many met their due time, and how many
// were missed. A schedule restarts from each completion (next due = completion
// + interval), so "expected" is the nominal count for the period from the
// frequency, not a replay of the due dates. Which entries count and which were
// on time follow the due rules (controlDueRules.executionMarks): the first N
// entries of a day by their slot deadline; otherwise by the deadline the
// previous entry set. Extra entries never count.
import { executionMarks, isDailyFrequency, isWeekdaysOnly, periodUnit, requiredPerPeriod, slotDeadline, slotStarts, zonedInstant, zonedParts } from './controlDueRules'
import { assignmentProgress } from './controlScheduling'
import type { ControlExecution, ControlFrequency, ControlRecord, ControlRow } from './controlTypes'

type Instant = Date | string | number
// The counts of a period: due, done (counted: never more than due), on time,
// late and missed, and the rates (null when nothing was due or done).
export interface AdherenceCounts { expected: number, performed: number, counted: number, onTime: number, late: number, missed: number, rate: number | null, onTimeRate: number | null }
// The totals of several lines (the programme's leave out the late ones).
export type AdherenceTotals = Omit<AdherenceCounts, 'late'> & { late?: number }
// A day (or week) short of its entries, with the set times missed.
export interface MissedDay { day: string, missing: number, times?: string[], week?: boolean }
// A line of the adherence report (control × department) with its counts.
export interface AdherenceLine extends AdherenceCounts { item: ControlRecord, department: string, frequency: ControlFrequency, missedDays?: MissedDay[] }
// The head of a group: a control, or a department named as one.
export type GroupHead = Pick<ControlRecord, 'id' | 'title'> & Partial<Omit<ControlRecord, 'id' | 'title'>>
// An entry as the history is counted.
type HistoryEntry = Pick<ControlExecution, 'at'> & Partial<Pick<ControlExecution, 'status' | 'cancelledAt' | 'isExtra' | 'responseData'>>
type Counts = Map<string, { performed: number, onTime: number }>
type LocalDay = { year: number, month: number, day: number }
// A line as the groups add it up.
type GroupedLine = Pick<AdherenceLine, 'department' | 'expected' | 'performed' | 'onTime' | 'missed'> & { item: GroupHead }
interface LineGroup<L extends GroupedLine = AdherenceLine> { key: string, lines: L[], item: GroupHead, department?: string }
// A control (or a department) with its lines and their totals.
export interface AdherenceGroup<L extends GroupedLine = AdherenceLine> extends LineGroup<L> { totals: AdherenceCounts }

const HOUR = 3600000, DAY = 24 * HOUR

// Length of one scheduled slot in milliseconds.
export function slotLength(frequency: ControlFrequency = {}) {
  const interval = Math.max(1, Number(frequency.interval) || 1)
  if (frequency.kind === 'daily') {
    const perDay = Math.max(1, (frequency.times || []).filter(Boolean).length || Number(frequency.timesPerDay) || 1)
    return DAY / perDay
  }
  if (frequency.kind === 'weekly') return 7 * DAY * interval
  if (frequency.kind === 'monthly') return 30.4375 * DAY * interval
  if (frequency.kind === 'yearly') return 365.25 * DAY * interval
  return DAY * interval
}

// A monthly (weekly, yearly) control counts a whole calendar period it covers even though the nominal month (30.44 days) is a
// little longer than 30 or 31 days: a calendar month expects 1, a year 12 (not 11), a quarter 3.
const SLACK = 0.05
export function expectedOccurrences(frequency: ControlFrequency, from: Instant, to: Instant) {
  const span = new Date(to).getTime() - new Date(from).getTime()
  if (!(span > 0)) return 0
  if (isWeekdaysOnly(frequency)) return Math.floor(weekdayTime(from, to) / slotLength(frequency))
  return Math.floor(span / slotLength(frequency) + (frequency?.kind === 'daily' ? 0 : SLACK))
}

// The part of [from, to] that falls on Monday to Friday (Athens), in milliseconds.
function weekdayTime(from: Instant, to: Instant) {
  const end = new Date(to).getTime()
  let total = 0
  for (let t = new Date(from).getTime(); t < end;) {
    const p = zonedParts(t)
    const next = Math.min(end, zonedInstant(p.year, p.month, p.day + 1, 0).getTime())
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
    if (weekday !== 0 && weekday !== 6) total += next - t
    t = next
  }
  return total
}

// Counted and on-time executions of one assignment's history within [start, end].
export function countAdherence(history: HistoryEntry[], frequency: ControlFrequency, start: Date, end: Date) {
  const marks = executionMarks(history, frequency).filter((mark) => mark.counted && new Date(mark.at) >= start && new Date(mark.at) <= end)
  return { performed: marks.length, onTime: marks.filter((mark) => mark.onTime).length }
}

// One assignment (control × department) over [from, to]. `counts`
// ({ performed, onTime }) comes from the database (control_adherence_counts,
// which applies the same start, end and grace); without it the history is counted.
export function assignmentAdherence({ frequency, history = [], startedAt = null, counts = null }: { frequency: ControlFrequency, history?: HistoryEntry[], startedAt?: string | null, counts?: { performed: number, onTime: number } | null }, { from, to, now = new Date() }: { from: Instant, to: Instant, now?: Instant }) {
  const start = new Date(Math.max(new Date(from).getTime(), startedAt ? new Date(startedAt).getTime() : -Infinity))
  const end = new Date(Math.min(new Date(to).getTime(), new Date(now).getTime()))
  const expected = expectedOccurrences(frequency, start, end)
  const { performed, onTime } = counts || countAdherence(history, frequency, start, end)
  const counted = Math.min(performed, expected)
  return {
    expected,
    performed,
    counted,
    onTime,
    late: performed - onTime,
    missed: Math.max(0, expected - performed),
    rate: expected ? Math.round((counted / expected) * 100) : null,
    onTimeRate: performed ? Math.round((onTime / performed) * 100) : null,
  }
}

// Rows for the programme: one per control and department, plus totals.
// countsByAssignment: Map(assignment id → { performed, onTime }) from the
// database; null counts each assignment's loaded history (the demo).
export function programmeAdherence(rows: ControlRow[] | null | undefined, period: { from: Instant, to: Instant, now?: Instant }, countsByAssignment: Counts | null = null) {
  const lines: AdherenceLine[] = []
  for (const { item, departments } of rows || []) {
    for (const department of departments) {
      const assignment = item.assignments?.[department]
      if (!assignment) continue
      const counts = countsByAssignment ? countsByAssignment.get(assignment.dbId) || { performed: 0, onTime: 0 } : null
      const result = assignmentAdherence({ frequency: assignment.frequency || item.frequency, history: assignment.history || [], startedAt: assignment.createdAt || item.createdAt, counts }, period)
      if (!result.expected && !result.performed) continue
      lines.push({ item, department, frequency: assignment.frequency || item.frequency, ...result })
    }
  }
  return { lines, totals: adherenceTotals(lines) }
}

// The totals of adherence lines (worst line first).
function adherenceTotals(lines: AdherenceLine[]): AdherenceTotals {
  lines.sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || String(a.item.title).localeCompare(String(b.item.title), 'el'))
  const expected = lines.reduce((sum, line) => sum + line.expected, 0)
  const counted = lines.reduce((sum, line) => sum + Math.min(line.performed, line.expected), 0)
  const performed = lines.reduce((sum, line) => sum + line.performed, 0)
  const onTime = lines.reduce((sum, line) => sum + line.onTime, 0)
  return {
    expected,
    performed,
    counted,
    onTime,
    missed: lines.reduce((sum, line) => sum + line.missed, 0),
    rate: expected ? Math.round((counted / expected) * 100) : null,
    onTimeRate: performed ? Math.round((onTime / performed) * 100) : null,
  }
}

// Today: the entries a daily control asks for today and how many are done
// (weekly, monthly and yearly controls have no share of a day; a weekdays-only
// control asks nothing at the weekend). null when the day asks nothing.
export function todayProgress(item: ControlRecord, department: string, now: Instant = new Date()) {
  const assignment = item.assignments?.[department]
  if (!assignment || assignment.status === 'paused') return null
  const frequency = assignment.frequency || item.frequency || {}
  if (periodUnit(frequency) !== 'day') return null
  const p = zonedParts(now)
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  if (isWeekdaysOnly(frequency) && (weekday === 0 || weekday === 6)) return null
  const progress = assignmentProgress(item, department, now)
  return progress?.required ? { required: progress.required, done: progress.done } : null
}

// «Today» in the adherence lines: due = what the day asks, done = what is
// recorded so far, on time from the day's counts.
export function todayAdherence(rows: ControlRow[] | null | undefined, countsByAssignment: Counts | null = null, now: Date = new Date()) {
  const lines: AdherenceLine[] = []
  const from = periodRange('today', now).from
  for (const { item, departments } of rows || []) {
    for (const department of departments) {
      const progress = todayProgress(item, department, now)
      if (!progress) continue
      const assignment = item.assignments[department]
      const frequency = assignment.frequency || item.frequency
      const counts = countsByAssignment ? countsByAssignment.get(assignment.dbId) || { performed: 0, onTime: 0 } : countAdherence(assignment.history || [], frequency, from, now)
      // Today asks only what is already due: a set time whose deadline has not
      // come yet is neither missed nor counted against the day.
      const p = zonedParts(now), day = { year: p.year, month: p.month, day: p.day }
      const deadlines = Array.from({ length: progress.required }, (_, index) => slotDeadline(frequency, day, index))
      const passed = deadlines.filter((deadline) => deadline < now).length
      const performed = progress.done
      const expected = Math.max(passed, Math.min(performed, progress.required))
      const missed = Math.max(0, passed - performed)
      const onTime = Math.min(counts.onTime, performed)
      const today = isoDay(p)
      const minutes = entryDaysFromHistory(assignment.history || []).get(today) || []
      const dueTimes = slotStarts(frequency).slice(0, passed)
      const times = missed ? uncoveredTimes({ ...frequency, times: dueTimes.map((m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`) }, minutes) : []
      lines.push({ item, department, frequency, expected, performed, counted: Math.min(performed, expected), onTime, late: performed - onTime, missed, missedDays: missed ? [{ day: today, missing: missed, times: times.length === missed ? times : [] }] : [], rate: expected ? Math.round((Math.min(performed, expected) / expected) * 100) : null, onTimeRate: performed ? Math.round((onTime / performed) * 100) : null })
    }
  }
  return { lines, totals: adherenceTotals(lines) }
}

// The adherence of any period the page offers: today as it stands, any other period up to its end (or now).
export function periodAdherence(rows: ControlRow[] | null | undefined, period: string, countsByAssignment: Counts | null = null, now: Date = new Date()) {
  return isToday(period) ? todayAdherence(rows, countsByAssignment, now) : programmeAdherence(rows, periodRange(period, now), countsByAssignment)
}

// The periods of the page (owner, 2/11/2026): a calendar day, month, quarter, half-year or year, stepped back with ‹ ›.
// A period is «unit» (the current one) or «unit@-n» (n back): «month@-1» is last month. The old rolling keys (30d, 60d,
// 6m, 12m) still read, for saved views and the internal reports.
export const ADHERENCE_PERIODS = ['day', 'month', 'quarter', 'half', 'year']
export const DEFAULT_PERIOD = 'month'
const LEGACY: Record<string, string> = { today: 'day', '30d': 'month', '60d': 'month', '6m': 'half', '12m': 'year' }
export function parsePeriod(key: string | null | undefined = DEFAULT_PERIOD): { unit: string, offset: number, legacy?: string } {
  const [unit, offset] = String(key || DEFAULT_PERIOD).split('@')
  if (ADHERENCE_PERIODS.includes(unit)) return { unit, offset: Math.min(0, Number(offset) || 0) }
  return { unit: LEGACY[unit] || DEFAULT_PERIOD, offset: 0, legacy: unit }
}
export const periodKey = (unit: string, offset = 0) => (offset ? `${unit}@${offset}` : unit)
export const isToday = (key: string | null | undefined) => { const { unit, offset, legacy } = parsePeriod(key); return unit === 'day' && offset === 0 && (!legacy || legacy === 'today') }
// Moves a period back (-1) or forward (+1), never past the current one.
export const stepPeriod = (key: string, delta: number) => { const { unit, offset } = parsePeriod(key); return periodKey(unit, Math.min(0, offset + delta)) }
export const normalizePeriod = (key: string | null | undefined) => { const { unit, offset } = parsePeriod(key); return periodKey(unit, offset) }

// [start, end) of a calendar period in Athens.
function calendarBounds(unit: string, offset: number, now: Instant) {
  const p = zonedParts(now)
  if (unit === 'day') { const s = zonedInstant(p.year, p.month, p.day + offset, 0); const e = zonedInstant(p.year, p.month, p.day + offset + 1, 0); return { from: s, end: e } }
  const months = ({ month: 1, quarter: 3, half: 6, year: 12 } as Record<string, number>)[unit]
  const index = Math.floor((p.year * 12 + p.month - 1) / months) + offset
  const startMonth = index * months
  const from = zonedInstant(Math.floor(startMonth / 12), (startMonth % 12) + 1, 1, 0)
  const next = startMonth + months
  return { from, end: zonedInstant(Math.floor(next / 12), (next % 12) + 1, 1, 0) }
}

const ROLLING: Record<string, Record<string, string>> = {
  el: { '30d': '30 ημ.', '60d': '60 ημ.', '6m': '6 μήνες', '12m': '12 μήνες', '90d': '90 ημ.' },
  en: { '30d': '30 days', '60d': '60 days', '6m': '6 months', '12m': '12 months', '90d': '90 days' },
}
const MONTHS: Record<string, string[]> = { el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }
// The units' names, for the period selector.
export const periodUnitLabel = (unit: string, language = 'el') => ({ el: { day: 'Ημέρα', month: 'Μήνας', quarter: 'Τρίμηνο', half: 'Εξάμηνο', year: 'Έτος' }, en: { day: 'Day', month: 'Month', quarter: 'Quarter', half: 'Half-year', year: 'Year' } } as Record<string, Record<string, string>>)[language === 'en' ? 'en' : 'el'][unit] || unit

// The short name of a period, for the chips and the column headings: «Σήμερα», «1/11», «Οκτ 2026», «3ο τρίμ. 2026», «2ο εξάμ. 2026», «2026».
export function periodShort(key: string, language = 'el', now: Instant = new Date()) {
  const en = language === 'en', lang = en ? 'en' : 'el'
  if (ROLLING[lang][key]) return ROLLING[lang][key]
  const { unit, offset } = parsePeriod(key)
  if (isToday(key)) return en ? 'Today' : 'Σήμερα'
  const { from } = calendarBounds(unit, offset, now)
  const p = zonedParts(from)
  if (unit === 'day') return `${p.day}/${p.month}/${p.year}`
  if (unit === 'month') return `${MONTHS[lang][p.month - 1]} ${p.year}`
  if (unit === 'quarter') { const q = Math.floor((p.month - 1) / 3) + 1; return en ? `Q${q} ${p.year}` : `${q}ο τρίμ. ${p.year}` }
  if (unit === 'half') { const h = p.month > 6 ? 2 : 1; return en ? `H${h} ${p.year}` : `${h}ο εξάμ. ${p.year}` }
  return String(p.year)
}

// Where the reports end: now, or, while the entries come in from elsewhere once a day
// (no entry at all in the hospital for 6 hours), the end of the last day with entries,
// so the day the import has not reached yet is not counted as missed.
export const REPORT_GAP_HOURS = 6
export function reportEnd(lastEntryAt: Instant | null | undefined, now: Date = new Date()) {
  if (!lastEntryAt) return new Date(now)
  const last = new Date(lastEntryAt)
  if (now.getTime() - last.getTime() <= REPORT_GAP_HOURS * HOUR) return new Date(now)
  const p = zonedParts(last)
  return new Date(zonedInstant(p.year, p.month, p.day + 1, 0).getTime() - 1000)
}

export function periodRange(key: string, now: Date = new Date()) {
  const to = new Date(now)
  const from = new Date(now)
  const calendar = parsePeriod(key)
  if (!calendar.legacy && !isToday(key)) {
    // The period's end, or now while it runs; the time it starts holds the whole first day.
    const bounds = calendarBounds(calendar.unit, calendar.offset, now)
    return { from: bounds.from, to: new Date(Math.min(bounds.end.getTime() - 1000, now.getTime())), now }
  }
  if (isToday(key)) { const p = zonedParts(now); return { from: zonedInstant(p.year, p.month, p.day, 0), to, now } }
  if (key === '60d') from.setDate(from.getDate() - 60)
  else if (key === '6m') from.setMonth(from.getMonth() - 6)
  else if (key === '90d') from.setDate(from.getDate() - 90)
  else if (key === '12m') from.setFullYear(from.getFullYear() - 1)
  else if (key === 'year') { from.setMonth(0, 1); from.setHours(0, 0, 0, 0) }
  else from.setDate(from.getDate() - 30)
  return { from, to, now }
}

export const adherenceTone = (rate: number | null | undefined) => (rate == null ? 'neutral' : rate >= 90 ? 'good' : rate >= 75 ? 'fair' : 'low')

// The adherence rows grouped by control (worst first): each group carries the
// control's totals across its departments, counted like the programme totals.
export function groupAdherenceLines<L extends GroupedLine>(lines: L[] = []) {
  return groupLinesBy(lines, (line) => line.item.id, (line) => ({ item: line.item }))
}

// The same rows grouped by department (worst first): each group carries the
// department's totals and its controls.
export function groupAdherenceByDepartment<L extends GroupedLine>(lines: L[] = []) {
  return groupLinesBy(lines, (line) => line.department, (line) => ({ department: line.department, item: { id: line.department, title: line.department } }))
}

function groupLinesBy<L extends GroupedLine>(lines: L[], keyOf: (line: L) => string, headOf: (line: L) => { item: GroupHead, department?: string }) {
  const groups = new Map<string, LineGroup<L>>()
  for (const line of lines) {
    const key = keyOf(line)
    if (!groups.has(key)) groups.set(key, { ...headOf(line), key, lines: [] })
    groups.get(key)!.lines.push(line)
  }
  return [...groups.values()].map((group): AdherenceGroup<L> => {
    const expected = group.lines.reduce((sum, line) => sum + line.expected, 0)
    const counted = group.lines.reduce((sum, line) => sum + Math.min(line.performed, line.expected), 0)
    const performed = group.lines.reduce((sum, line) => sum + line.performed, 0)
    const onTime = group.lines.reduce((sum, line) => sum + line.onTime, 0)
    return {
      ...group,
      totals: {
        expected,
        performed,
        counted,
        onTime,
        late: performed - onTime,
        missed: group.lines.reduce((sum, line) => sum + line.missed, 0),
        rate: expected ? Math.round((counted / expected) * 100) : null,
        onTimeRate: performed ? Math.round((onTime / performed) * 100) : null,
      },
    }
  }).sort((a, b) => (a.totals.rate ?? 101) - (b.totals.rate ?? 101) || String(a.item.title).localeCompare(String(b.item.title), 'el'))
}

const isoDay = (d: LocalDay) => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
const nextDay = (d: LocalDay): LocalDay => { const n = new Date(Date.UTC(d.year, d.month - 1, d.day + 1)); return { year: n.getUTCFullYear(), month: n.getUTCMonth() + 1, day: n.getUTCDate() } }

// The regular entries of a history per local day (Athens): Map('YYYY-MM-DD' →
// minutes after midnight of each entry).
export function entryDaysFromHistory(history: Partial<HistoryEntry>[] = []) {
  const days = new Map<string, number[]>()
  for (const row of history) {
    if (!row?.at || row.status === 'cancelled' || row.cancelledAt || row.isExtra || row.responseData?.isExtra) continue
    const p = zonedParts(row.at)
    const key = isoDay(p)
    if (!days.has(key)) days.set(key, [])
    days.get(key)!.push(p.hour * 60 + p.minute)
  }
  for (const list of days.values()) list.sort((a, b) => a - b)
  return days
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// The set times a day's entries did not cover: each entry is paired with the
// nearest free set time; the set times left over were missed.
export function uncoveredTimes(frequency: ControlFrequency = {}, minutes: number[] = []) {
  const slots = slotStarts(frequency).map((at) => ({ at, taken: false }))
  const pairs: { entry: number, slot: { at: number, taken: boolean }, distance: number }[] = []
  for (const entry of minutes) for (const slot of slots) pairs.push({ entry, slot, distance: Math.abs(entry - slot.at) })
  pairs.sort((a, b) => a.distance - b.distance)
  const used = new Set()
  for (const pair of pairs) {
    if (pair.slot.taken || used.has(pair.entry)) continue
    pair.slot.taken = true
    used.add(pair.entry)
  }
  return slots.filter((slot) => !slot.taken).map((slot) => hhmm(slot.at))
}

const entriesOf = (value: unknown) => (Array.isArray(value) ? value.length : Number(value) || 0)

// The days of a period a daily control was short of its entries, with the
// set times missed, and the weeks a weekly one had none:
// [{ day: 'YYYY-MM-DD', missing, times?, week? }], oldest first. Only whole
// days (weeks) that have ended count; monthly and yearly controls name no days.
// entryDays: Map(day → minutes[] or a count).
export function missedDays(frequency: ControlFrequency = {}, entryDays: Map<string, number[] | number> = new Map(), { from, to }: { from: Instant, to: Instant }, startedAt: Instant | null = null) {
  const unit = periodUnit(frequency)
  if (unit !== 'day' && unit !== 'week') return []
  // «Every N days» is none of the two: it names no day (the days between its executions are not missed).
  if (unit === 'day' && !isDailyFrequency(frequency)) return []
  const start = new Date(Math.max(new Date(from).getTime(), startedAt ? new Date(startedAt).getTime() : -Infinity))
  const end = new Date(to).getTime()
  const required = unit === 'day' ? requiredPerPeriod(frequency) : 1
  const length = unit === 'day' ? 1 : 7
  const out: MissedDay[] = []
  let d: LocalDay = zonedParts(start)
  d = { year: d.year, month: d.month, day: d.day }
  if (unit === 'week') { const weekday = (new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay() + 6) % 7; if (weekday) for (let i = weekday; i < 7; i += 1) d = nextDay(d) }
  else if (zonedInstant(d.year, d.month, d.day, 0) < start) d = nextDay(d)
  for (;;) {
    let e = d
    for (let i = 0; i < length; i += 1) e = nextDay(e)
    if (zonedInstant(e.year, e.month, e.day, 0).getTime() > end) break
    const weekday = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()
    if (!(unit === 'day' && isWeekdaysOnly(frequency) && (weekday === 0 || weekday === 6))) {
      let entries = 0
      for (let x = d, i = 0; i < length; i += 1, x = nextDay(x)) entries += entriesOf(entryDays.get(isoDay(x)))
      if (entries < required) {
        if (unit === 'week') out.push({ day: isoDay(d), missing: 1, week: true })
        else {
          const value = entryDays.get(isoDay(d))
          const times = Array.isArray(value) || !value ? uncoveredTimes(frequency, (value || []) as number[]) : []
          out.push({ day: isoDay(d), missing: required - entries, times: times.length === required - entries ? times : [] })
        }
      }
    }
    d = e
  }
  return out
}

// The months of a 6- or 12-month period, oldest first, each clipped to the period.
export function monthRanges(period: string, now: Date = new Date()) {
  if (period !== '6m' && period !== '12m') return []
  const { from, to } = periodRange(period, now)
  const months: { key: string, from: Date, to: Date, now: Date }[] = []
  const p = zonedParts(from)
  for (let year = p.year, month = p.month; ; month += 1) {
    if (month > 12) { month = 1; year += 1 }
    const start = zonedInstant(year, month, 1, 0)
    if (start > to) break
    const next = month === 12 ? zonedInstant(year + 1, 1, 1, 0) : zonedInstant(year, month + 1, 1, 0)
    months.push({ key: `${year}-${String(month).padStart(2, '0')}`, from: new Date(Math.max(start.getTime(), from.getTime())), to: new Date(Math.min(next.getTime() - 1000, to.getTime())), now: to })
  }
  return months
}
