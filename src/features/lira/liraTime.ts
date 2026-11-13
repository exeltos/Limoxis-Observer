import { hospitalToday } from '../../core/dates/hospitalDate'
import type { LiraData, LiraRow } from './liraTypes'

// Χρονικό παράθυρο μιας ερώτησης («χθες», «Μάρτιος», «από 1/3 έως 5/3»).
export interface LiraTimeWindow { start: string; end: string; label: string; kind?: string }
// Δύο αντίστοιχες περίοδοι για σύγκριση (buildMatchedComparisonSpec). Οι αναλύσεις
// τις δίνουν και ως επιλογές (from/to), γι' αυτό δέχονται και αυτά τα πεδία.
export type LiraComparisonPeriod = LiraTimeWindow & { from?: string | null; to?: string | null }
export interface LiraComparisonSpec { current: LiraComparisonPeriod; reference: LiraComparisonPeriod }
const normalize = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const iso = (date: Date) => date.toISOString().slice(0, 10)
const parseIso = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) ? date : null
}
const shift = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
const startOfWeek = (date: Date) => {
  const day = (date.getDay() + 6) % 7
  return shift(date, -day)
}

const monthNames: Record<string, number> = {
  ιανουαριος: 1, ιανουαριο: 1, ιανουαριου: 1, january: 1,
  φεβρουαριος: 2, φεβρουαριο: 2, φεβρουαριου: 2, february: 2,
  μαρτιος: 3, μαρτιο: 3, μαρτιου: 3, march: 3,
  απριλιος: 4, απριλιο: 4, απριλιου: 4, april: 4,
  μαιος: 5, μαιο: 5, μαιου: 5, may: 5,
  ιουνιος: 6, ιουνιο: 6, ιουνιου: 6, june: 6,
  ιουλιος: 7, ιουλιο: 7, ιουλιου: 7, july: 7,
  αυγουστος: 8, αυγουστο: 8, αυγουστου: 8, august: 8,
  σεπτεμβριος: 9, σεπτεμβριο: 9, σεπτεμβριου: 9, september: 9,
  οκτωβριος: 10, οκτωβριο: 10, οκτωβριου: 10, october: 10,
  νοεμβριος: 11, νοεμβριο: 11, νοεμβριου: 11, november: 11,
  δεκεμβριος: 12, δεκεμβριο: 12, δεκεμβριου: 12, december: 12,
}

const monthWindow = (year: number, month: number) => ({
  start: `${year}-${String(month).padStart(2, '0')}-01`,
  end: iso(new Date(year, month, 0, 12)),
  label: `${String(month).padStart(2, '0')}/${year}`,
})

export function inferLiraTimeWindow(question: unknown, { today = hospitalToday() }: { today?: string } = {}): LiraTimeWindow | null {
  const text = normalize(question)
  const now = parseIso(today)
  if (!now) return null

  if (text.includes('σημερα') || /\btoday\b/.test(text)) {
    return { start: today, end: today, label: text.includes('today') ? 'today' : 'σήμερα', kind: 'day' }
  }
  if (text.includes('προχθες') || /\bday before yesterday\b/.test(text)) {
    const date = iso(shift(now, -2))
    return { start: date, end: date, label: text.includes('day before') ? 'day before yesterday' : 'προχθές', kind: 'day' }
  }
  if (text.includes('χθες') || /\byesterday\b/.test(text)) {
    const date = iso(shift(now, -1))
    return { start: date, end: date, label: text.includes('yesterday') ? 'yesterday' : 'χθες', kind: 'day' }
  }
  if (/(αυτη\s+την\s+εβδομαδα|this\s+week)/.test(text)) {
    return {
      start: iso(startOfWeek(now)),
      end: today,
      label: text.includes('this week') ? 'this week' : 'αυτή την εβδομάδα',
      kind: 'week',
    }
  }
  if (/(τελευταιο\s+τριμηνο|τελευταιους\s+3\s+μηνες|last\s+quarter|last\s+3\s+months)/.test(text)) {
    return {
      start: iso(shift(now, -89)),
      end: today,
      label: text.includes('last') ? 'last 90 days' : 'τελευταίες 90 ημέρες',
      kind: 'rolling',
    }
  }

  const range = text.match(/(?:απο|from)\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(?:εως|μεχρι|to|until)\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/)
  if (range) {
    const rawYearA = Number(range[3] || now.getFullYear())
    const rawYearB = Number(range[6] || rawYearA)
    const fullYear = (year: number) => (year < 100 ? 2000 + year : year)
    const start = `${fullYear(rawYearA)}-${String(range[2]).padStart(2, '0')}-${String(range[1]).padStart(2, '0')}`
    const end = `${fullYear(rawYearB)}-${String(range[5]).padStart(2, '0')}-${String(range[4]).padStart(2, '0')}`
    if (parseIso(start) && parseIso(end) && start <= end) {
      return { start, end, label: `${start} – ${end}`, kind: 'range' }
    }
  }

  for (const [name, month] of Object.entries(monthNames)) {
    if (!text.includes(name)) continue
    const yearMatch = text.match(/\b(20\d{2})\b/)
    let year = yearMatch ? Number(yearMatch[1]) : now.getFullYear()
    if (!yearMatch && month > now.getMonth() + 1) year -= 1
    return { ...monthWindow(year, month), kind: 'month' }
  }

  return null
}

export function filterLiraDataByWindow(data: LiraData, window: LiraTimeWindow | null | undefined): LiraData {
  if (!data || !window) return data

  const dateOf = (row: LiraRow) => row?.signalDate || row?.resultedAt || row?.collectedAt || row?.date || row?.startedAt || row?.dueDate || null
  const rows = <T extends LiraRow>(items: T[] | undefined) => (items || []).filter(row => {
    const value = dateOf(row)
    if (!value) return false
    const date = String(value).slice(0, 10)
    return date >= window.start && date <= window.end
  })

  return {
    ...data,
    surveillance: rows(data.surveillance),
    laboratory: rows(data.laboratory),
    handHygiene: rows(data.handHygiene),
    bundles: rows(data.bundles),
    qualityIncidents: rows(data.qualityIncidents),
    qualityCapas: rows(data.qualityCapas),
    patientDays: rows(data.patientDays),
    devices: rows(data.devices),
    haiClassifications: rows(data.haiClassifications),
  }
}
