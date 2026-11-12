// Department registers (Quality Center, phase 4): what a department records and
// how its indicators are computed. A register is one of two kinds:
// - case: one entry per case (a neonate in the NICU), with typed fields;
// - sheet: one entry per period (a month in Ophthalmology), a grid of rows
//   (procedures) × measures (number, planned / urgent) with whole numbers.
// The definition lives in the register (fields, sheet, indicators), so a
// hospital builds its own without a code change.

import type { AnyRecord } from '../../types/featureTypes'

// A period of a report: its first and last day and a key «month:2026-11».
export type Period = { from: string, to: string, key: string }
// An option of the lists above: its value and its label [Greek, English].
export type LabelledOption = { value: string, label: string[] }

export const FIELD_TYPES = [
  { value: 'number', label: ['Αριθμός', 'Number'] },
  { value: 'date', label: ['Ημερομηνία', 'Date'] },
  { value: 'yesNo', label: ['Ναι / Όχι', 'Yes / No'] },
  { value: 'choice', label: ['Λίστα (μία επιλογή)', 'List (one choice)'] },
  { value: 'multiChoice', label: ['Λίστα (πολλές επιλογές)', 'List (several)'] },
  { value: 'gestation', label: ['Εβδομάδες + ημέρες', 'Weeks + days'] },
  { value: 'text', label: ['Κείμενο', 'Text'] },
  { value: 'computed', label: ['Υπολογιζόμενο', 'Computed'] },
]

// What a computed field derives from other fields.
export const COMPUTED_KINDS = [
  { value: 'days', label: ['Ημέρες μεταξύ δύο ημερομηνιών', 'Days between two dates'] },
  { value: 'ageYears', label: ['Ηλικία (έτη)', 'Age (years)'] },
  { value: 'ageDays', label: ['Ηλικία (ημέρες)', 'Age (days)'] },
  { value: 'apacheII', label: ['Θνητότητα APACHE II (από score και μετεγχειρητικό)', 'APACHE II mortality (from score and post-operative)'] },
]

// Predicted mortality (%) by APACHE II score band (0–4, 5–9 … 35+), for
// non-operative and post-operative admissions (Knaus 1985).
const APACHE_MORTALITY: Record<string, number[]> = { medical: [4, 8, 15, 25, 40, 55, 75, 85], postop: [1, 3, 7, 12, 30, 35, 73, 88] }
export function apacheMortality(score: unknown, postop: unknown) {
  if (score === null || score === undefined || score === '' || typeof postop !== 'boolean' || !Number.isFinite(Number(score))) return null
  return APACHE_MORTALITY[postop ? 'postop' : 'medical'][Math.min(7, Math.max(0, Math.floor(Number(score) / 5)))]
}

// Sheets are recorded day by day from November 2026; the months before keep their one monthly total.
export const DAILY_SHEETS_FROM = '2026-11-01'
// The day a sheet starts being recorded day by day (a month, «2026-11», means its first day).
export const dailyStart = (value?: unknown) => { const text = String(value || DAILY_SHEETS_FROM); return text.length === 7 ? `${text}-01` : text.slice(0, 10) }

export const AGGREGATIONS = [
  { value: 'count', label: ['Πλήθος', 'Count'] },
  { value: 'percent', label: ['Ποσοστό %', 'Percentage %'] },
  { value: 'mean', label: ['Μέσος όρος', 'Mean'] },
  { value: 'median', label: ['Διάμεσος', 'Median'] },
  { value: 'sum', label: ['Άθροισμα', 'Sum'] },
  { value: 'rate', label: ['Ρυθμός ανά 1.000', 'Rate per 1,000'] },
  { value: 'smr', label: ['Θνησιμότητα προς προβλεπόμενη (SMR)', 'Observed to predicted mortality (SMR)'] },
]

export const FILTER_OPS = [
  { value: 'yes', label: ['είναι Ναι', 'is Yes'] },
  { value: 'no', label: ['είναι Όχι', 'is No'] },
  { value: 'eq', label: ['είναι', 'is'] },
  { value: 'filled', label: ['έχει τιμή', 'has a value'] },
  { value: 'empty', label: ['χωρίς τιμή', 'is empty'] },
  { value: 'gt', label: ['μεγαλύτερο από', 'greater than'] },
  { value: 'lt', label: ['μικρότερο από', 'less than'] },
]

// Below this many cases an indicator is shown as unreliable (small numbers).
export const SMALL_COUNT = 5

export const optionLabel = (list: LabelledOption[], value: string, language = 'el') => {
  const item = list.find(option => option.value === value)
  return item ? item.label[language === 'en' ? 1 : 0] : value || ''
}
export const optionsOf = (list: LabelledOption[], language = 'el') => list.map(option => ({ value: option.value, label: option.label[language === 'en' ? 1 : 0] }))
export const textOf = (item: AnyRecord | null | undefined, language = 'el'): string => (language === 'en' ? item?.labelEn || item?.titleEn || item?.nameEn : '') || item?.label || item?.title || item?.name || ''

const isBlank = (value: unknown) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
const dayNumber = (value: unknown) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000 : null
}
export const daysBetween = (from: unknown, to: unknown) => {
  const a = dayNumber(from), b = dayNumber(to)
  return a == null || b == null ? null : b - a
}

// Gestation is stored as total days and shown as weeks+days (37+4).
export const gestationText = (days: unknown) => (Number.isFinite(Number(days)) && days !== '' && days != null ? `${Math.floor(Number(days) / 7)}+${Number(days) % 7}` : '')
export function parseGestation(text: unknown) {
  const match = /^\s*(\d{1,2})(?:\s*[+,.]\s*(\d))?\s*$/.exec(String(text || ''))
  if (!match) return null
  const days = Number(match[2] || 0)
  return days > 6 ? null : Number(match[1]) * 7 + days
}

// The values of an entry with its computed fields filled in.
export function computeValues(fields: AnyRecord[] = [], values: AnyRecord = {}): AnyRecord {
  const next: AnyRecord = { ...values }
  for (const field of fields) {
    if (field.type !== 'computed') continue
    const from = next[field.from], to = field.to ? next[field.to] : null
    let value: number | null = null
    if (field.computed === 'days') value = daysBetween(from, to)
    if (field.computed === 'ageDays') value = daysBetween(from, to)
    if (field.computed === 'apacheII') value = apacheMortality(from, to)
    if (field.computed === 'ageYears') {
      const days = daysBetween(from, to)
      value = days == null ? null : Math.floor(days / 365.25)
    }
    next[field.key] = value == null || value < 0 ? null : value
  }
  return next
}

// Whether a field is shown: always, or when another field has a value.
export function fieldVisible(field: AnyRecord, values: AnyRecord = {}) {
  if (!field.showWhen?.field) return true
  const value = values[field.showWhen.field]
  return field.showWhen.value === undefined ? !isBlank(value) && value !== false : Array.isArray(value) ? value.includes(field.showWhen.value) : value === field.showWhen.value
}

// A field required only from a date on (data the register did not keep in its early years).
export const isRequired = (field: AnyRecord, entryDate: unknown) => Boolean(field.required) && !(field.requiredFrom && entryDate && String(entryDate).slice(0, 10) < field.requiredFrom)

// Errors stop the save; warnings ask the user to check (an unusual value).
export function validateEntry(fields: AnyRecord[] = [], values: AnyRecord = {}, language = 'el', entryDate: unknown = '') {
  const en = language === 'en'
  const errors: Record<string, string> = {}, warnings: Record<string, string> = {}
  const full = computeValues(fields, values)
  for (const field of fields) {
    if (field.type === 'computed' || !fieldVisible(field, full)) continue
    const value = full[field.key]
    if (isRequired(field, entryDate) && isBlank(value)) { errors[field.key] = en ? 'Required' : 'Υποχρεωτικό'; continue }
    if (isBlank(value)) continue
    if (field.type === 'number' || field.type === 'gestation') {
      const number = Number(value)
      if (!Number.isFinite(number)) { errors[field.key] = en ? 'Not a number' : 'Δεν είναι αριθμός'; continue }
      const shown: (value: unknown) => string = field.type === 'gestation' ? gestationText : String
      if (field.min !== undefined && field.min !== '' && number < Number(field.min)) errors[field.key] = en ? `At least ${shown(field.min)}` : `Τουλάχιστον ${shown(field.min)}`
      else if (field.max !== undefined && field.max !== '' && number > Number(field.max)) errors[field.key] = en ? `At most ${shown(field.max)}` : `Το πολύ ${shown(field.max)}`
      else if (field.usualMin !== undefined && field.usualMin !== '' && number < Number(field.usualMin)) warnings[field.key] = en ? 'Unusually low, please check' : 'Ασυνήθιστα χαμηλό, ελέγξτε'
      else if (field.usualMax !== undefined && field.usualMax !== '' && number > Number(field.usualMax)) warnings[field.key] = en ? 'Unusually high, please check' : 'Ασυνήθιστα υψηλό, ελέγξτε'
    }
    if (field.type === 'date' && field.notBefore && !isBlank(full[field.notBefore])) {
      const before = fields.find(item => item.key === field.notBefore)
      if ((daysBetween(full[field.notBefore], value) ?? 0) < 0) errors[field.key] = en ? `Not before «${textOf(before, 'en')}»` : `Όχι πριν από «${textOf(before)}»`
    }
  }
  return { errors, warnings, valid: Object.keys(errors).length === 0 }
}

// How a value reads in a list or a report.
// Age in days from two dates is «0» or «1» for a newborn admitted the day it was born, which tells nothing: under 3 days
// the age in hours of the entry (when it has one) is shown, and under one day without hours it reads «under 1 day».
export function ageText(days: number, hours: unknown, language = 'el') {
  const en = language === 'en'
  const number = new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 })
  const h = hours == null || hours === '' ? null : Number(hours)
  if (days < 3 && h != null && Number.isFinite(h) && h >= 0) return `${number.format(h)} ${en ? (h === 1 ? 'hour' : 'hours') : (h === 1 ? 'ώρα' : 'ώρες')}`
  if (days < 1) return en ? 'under 1 day' : 'κάτω από 1 ημέρα'
  return `${number.format(days)} ${en ? (days === 1 ? 'day' : 'days') : (days === 1 ? 'ημέρα' : 'ημέρες')}`
}

// `entryValues` (optional): the other values of the entry, for fields shown together with another one (the age with its hours).
export function formatValue(field: AnyRecord, value: unknown, language = 'el', entryValues: AnyRecord | null = null) {
  const en = language === 'en'
  if (isBlank(value)) return '—'
  if (field.type === 'computed' && field.computed === 'ageDays' && field.to === 'admission_date' && Number.isFinite(Number(value))) return ageText(Number(value), entryValues?.admission_age_hours, language)
  if (field.type === 'yesNo') return value === true || value === 'yes' ? (en ? 'Yes' : 'Ναι') : value === false || value === 'no' ? (en ? 'No' : 'Όχι') : en ? 'Unknown' : 'Άγνωστο'
  if (field.type === 'choice') return textOf((field.options || []).find((option: AnyRecord) => option.value === value), language) || String(value)
  if (field.type === 'multiChoice') return (Array.isArray(value) ? value : [value]).map(item => textOf((field.options || []).find((option: AnyRecord) => option.value === item), language) || item).join(', ')
  if (field.type === 'gestation') return `${gestationText(value)} ${en ? 'wk' : 'εβδ.'}`
  if (field.type === 'date') { const [y, m, d] = String(value).slice(0, 10).split('-'); return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : String(value) }
  if (field.type === 'number' || field.type === 'computed') {
    const unit = en ? field.unitEn || field.unit : field.unit
    return `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 2 }).format(Number(value))}${unit ? ` ${unit}` : ''}`
  }
  return String(value)
}

// --- Periods -----------------------------------------------------------------

export const PERIODS = [
  { value: 'month', label: ['Μήνας', 'Month'] },
  { value: 'quarter', label: ['Τρίμηνο', 'Quarter'] },
  { value: 'half', label: ['Εξάμηνο', 'Half-year'] },
  { value: 'year', label: ['Έτος', 'Year'] },
]

const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

// The period (kind) that contains a day: { from, to, key }.
export function periodOf(kind: string, day: unknown): Period {
  const [year, month] = String(day).slice(0, 7).split('-').map(Number)
  const length = ({ month: 1, quarter: 3, half: 6, year: 12 } as Record<string, number>)[kind] || 1
  const first = Math.floor((month - 1) / length) * length + 1
  const last = first + length - 1
  return { from: `${year}-${pad(first)}-01`, to: `${year}-${pad(last)}-${pad(lastDay(year, last))}`, key: `${kind}:${year}-${pad(first)}` }
}

// The same period one step back (previous) and one year back.
export function shiftPeriod(period: Period, months: number) {
  const [year, month] = period.from.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + months, 1))
  const kind = period.key.split(':')[0]
  return periodOf(kind, `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`)
}
export const periodLength = (period: Period) => (({ month: 1, quarter: 3, half: 6, year: 12 } as Record<string, number>)[period.key.split(':')[0]] || 1)

export function periodLabel(period: Period, language = 'el') {
  const en = language === 'en'
  const [kind, start] = period.key.split(':')
  const [year, month] = start.split('-').map(Number)
  if (kind === 'year') return String(year)
  if (kind === 'half') return `${Math.ceil(month / 6)}${en ? 'H' : 'ο εξάμηνο'} ${year}`
  if (kind === 'quarter') return `${en ? 'Q' : ''}${Math.ceil(month / 3)}${en ? '' : 'ο τρίμηνο'} ${year}`
  return new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

// --- Indicators --------------------------------------------------------------

const matches = (filter: AnyRecord, values: AnyRecord) => {
  if (!filter?.field) return true
  const value = values[filter.field]
  switch (filter.op) {
    case 'yes': return value === true || value === 'yes'
    case 'no': return value === false || value === 'no'
    case 'eq': return Array.isArray(value) ? value.includes(filter.value) : String(value ?? '') === String(filter.value ?? '')
    case 'filled': return !isBlank(value)
    case 'empty': return isBlank(value)
    case 'gt': return !isBlank(value) && Number(value) > Number(filter.value)
    case 'lt': return !isBlank(value) && Number(value) < Number(filter.value)
    default: return true
  }
}
export const matchesAll = (filters: AnyRecord[] = [], values: AnyRecord = {}) => filters.every(filter => matches(filter, values))

// The day an entry counts on for an indicator: the indicator's date field
// (e.g. the discharge date for length of stay), else the entry date.
const entryDay = (entry: AnyRecord, indicator?: AnyRecord | null) => (indicator?.dateField ? entry.values?.[indicator.dateField] : null) || entry.periodStart || entry.entryDate

// A sheet entry that holds the total of several months (periodEnd, e.g. a year imported as one figure) counts only in a
// period that holds all of it (the year), never in one of its months.
export const entriesInPeriod = (entries: AnyRecord[] = [], period: Period, indicator?: AnyRecord | null) => entries.filter(entry => {
  const day = String(entryDay(entry, indicator) || '').slice(0, 10)
  if (!day || day < period.from || day > period.to) return false
  return !entry.periodEnd || indicator?.dateField || String(entry.periodEnd).slice(0, 10) <= period.to
})

// A register of treatments (chemotherapy): «Active patients» is a picture on the last day of the period, not the patients
// recorded in it: whoever has started (the day recorded, when the start is unknown) and not ended by then.
export const isTreatmentRegister = (register: AnyRecord) => register.kind !== 'sheet' && ['start_date', 'end_date'].every(key => (register.fields || []).some((field: AnyRecord) => field.key === key && field.type === 'date'))
export const isActiveCensus = (register: AnyRecord, indicator?: AnyRecord | null) => indicator?.id === 'active_patients' && isTreatmentRegister(register)
export const treatmentActive = (entry: AnyRecord, day: string) => {
  const start = String(entry.values?.start_date || entry.entryDate || '').slice(0, 10)
  const end = String(entry.values?.end_date || '').slice(0, 10)
  return Boolean(start) && start <= day && (!end || end > day)
}
export const periodEntries = (register: AnyRecord, entries: AnyRecord[] = [], period: Period, indicator?: AnyRecord | null) => (isActiveCensus(register, indicator) ? entries.filter(entry => treatmentActive(entry, period.to)) : entriesInPeriod(entries, period, indicator))

const mean = (numbers: number[]) => (numbers.length ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : null)
const median = (numbers: number[]) => {
  if (!numbers.length) return null
  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const numbersOf = (rows: AnyRecord[], field: string) => rows.map(values => values[field]).filter(value => !isBlank(value) && Number.isFinite(Number(value))).map(Number)
const round = (value: number | null, digits = 1) => (value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits)))

// A sheet entry as the totals the indicators read: row × measure.
const sheetCell = (values: AnyRecord | null | undefined, row: string, measure: string) => {
  const cell = values?.[row]?.[measure]
  return isBlank(cell) ? null : Number(cell)
}
export function sheetTotal(entries: AnyRecord[] = [], rows: string[] = [], measures: string[] = []) {
  let total = 0, filled = 0
  for (const entry of entries) for (const row of rows) for (const measure of measures) {
    const cell = sheetCell(entry.values, row, measure)
    if (cell != null) { total += cell; filled += 1 }
  }
  return filled ? total : null
}

// One indicator over the entries of a period.
//   case register: count / percent / mean / median / sum / rate of the entries
//     that match `filters`; percent and rate divide by the denominator
//     (entries matching denominator.filters, or the sum of denominator.field).
//   sheet: sum of numerator rows × measure, as a share of the denominator rows.
// An indicator that rests on something the register never records (a field no entry has filled, a sheet row no day has a
// number for) is «not recorded» (owner, 2/11/2026), not a 0 or a rate that looks judged: its value is empty and it is never
// judged against a target. Read over the whole register, so a quiet period of a register that does record it still counts 0.
const recordedCache = new WeakMap<AnyRecord[], { register: AnyRecord, fields: Set<string> }>()
const isFilled = (value: unknown) => value != null && value !== '' && !(Array.isArray(value) && !value.length)
function recordedFields(register: AnyRecord, entries: AnyRecord[]) {
  const known = recordedCache.get(entries)
  if (known?.register === register) return known.fields
  const fields = new Set<string>()
  for (const entry of entries) {
    const values = computeValues(register.fields, entry.values || {})
    for (const key of Object.keys(values)) if (isFilled(values[key])) fields.add(key)
  }
  recordedCache.set(entries, { register, fields })
  return fields
}
// The indicators that read the entries of a case register (a sheet's counts, and the census of those still in treatment, stand on their own).
const indicatorNeedsEntries = (register: AnyRecord, indicator: AnyRecord) => register.kind !== 'sheet' && !isActiveCensus(register, indicator)
export function indicatorNotRecorded(register: AnyRecord, indicator: AnyRecord, entries: AnyRecord[] = []) {
  // A register with no entry at all measures nothing yet: its counts are not zeros that meet a target.
  if (!entries.length) return indicatorNeedsEntries(register, indicator)
  if (register.kind === 'sheet') {
    if (indicator.aggregation === 'count' || !indicator.rows?.length) return false
    const measures = indicator.measure ? [indicator.measure] : (register.sheet?.measures || []).map((measure: AnyRecord) => measure.key)
    return sheetTotal(entries, indicator.rows, measures) == null
  }
  if (isActiveCensus(register, indicator)) return false
  const need = new Set<string>([...(indicator.denominatorFilters || []).map((filter: AnyRecord) => filter.field), indicator.field, indicator.denominatorField].filter(Boolean))
  // A date-based count of a treatment register rests on the start dates (no one ended yet is a real 0, no dates at all is not).
  if (indicator.dateField) need.add(isTreatmentRegister(register) ? 'start_date' : indicator.dateField)
  if (!need.size) return false
  const recorded = recordedFields(register, entries)
  return [...need].some(key => !recorded.has(key))
}

export type IndicatorResult = { id: string, value: number | null, numerator: number | null, denominator: number | null, n: number, small: boolean, status?: string, notRecorded?: boolean }
export function computeIndicator(register: AnyRecord, indicator: AnyRecord, entries: AnyRecord[] = [], period: Period): IndicatorResult {
  const result = computeIndicatorValue(register, indicator, entries, period)
  return indicatorNotRecorded(register, indicator, entries)
    ? { ...result, value: null, numerator: null, denominator: null, small: false, status: 'context', notRecorded: true }
    : result
}

function computeIndicatorValue(register: AnyRecord, indicator: AnyRecord, entries: AnyRecord[] = [], period: Period): IndicatorResult {
  const inPeriod = periodEntries(register, entries, period, indicator)
  const result: IndicatorResult = { id: indicator.id, value: null, numerator: null, denominator: null, n: inPeriod.length, small: false }
  if (register.kind === 'sheet') {
    const sheet = register.sheet || {}
    // «Daily only» indicators read the days recorded one by one, never a month's single total.
    const dailyFrom = dailyStart(sheet.dailyFrom)
    const used = indicator.dailyOnly ? inPeriod.filter(entry => String(entry.periodStart) >= dailyFrom) : inPeriod
    if (indicator.aggregation === 'count') {
      result.numerator = used.length
      result.value = indicator.dailyOnly && !used.length ? null : used.length
      return withStatus(result, indicator)
    }
    const allRows: string[] = (sheet.rows || []).map((row: AnyRecord) => row.key)
    const allMeasures: string[] = (sheet.measures || []).map((measure: AnyRecord) => measure.key)
    const numRows: string[] = indicator.rows?.length ? indicator.rows : allRows
    const numMeasures: string[] = indicator.measure ? [indicator.measure] : allMeasures
    const numerator = sheetTotal(used, numRows, numMeasures)
    result.numerator = numerator
    if (indicator.aggregation === 'percent') {
      const denominator = sheetTotal(used, indicator.denominatorRows?.length ? indicator.denominatorRows : allRows, indicator.denominatorMeasure ? [indicator.denominatorMeasure] : allMeasures)
      result.denominator = denominator
      result.value = numerator == null || !denominator ? null : round((numerator / denominator) * 100)
    } else if (indicator.aggregation === 'mean') {
      const months = used.filter(entry => numRows.some(row => numMeasures.some(measure => sheetCell(entry.values, row, measure) != null))).length
      result.denominator = months
      result.value = numerator == null || !months ? null : round(numerator / months)
    } else result.value = numerator
    result.small = false
    return withStatus(result, indicator)
  }
  const rows = inPeriod.map(entry => computeValues(register.fields, entry.values || {}))
  const selected = isActiveCensus(register, indicator) ? rows : rows.filter(values => matchesAll(indicator.filters, values))
  switch (indicator.aggregation) {
    case 'count':
      result.value = selected.length
      result.numerator = selected.length
      break
    case 'percent': {
      const base = rows.filter(values => matchesAll(indicator.denominatorFilters, values))
      const top = base.filter(values => matchesAll(indicator.filters, values))
      result.numerator = top.length
      result.denominator = base.length
      result.value = base.length ? round((top.length / base.length) * 100) : null
      result.small = base.length > 0 && base.length < SMALL_COUNT
      break
    }
    case 'mean':
    case 'median': {
      const numbers = numbersOf(selected, indicator.field)
      result.numerator = numbers.length
      result.value = round(indicator.aggregation === 'mean' ? mean(numbers) : median(numbers))
      result.small = numbers.length > 0 && numbers.length < SMALL_COUNT
      break
    }
    case 'sum': {
      const numbers = numbersOf(selected, indicator.field)
      result.value = numbers.length ? numbers.reduce((sum, n) => sum + n, 0) : null
      result.numerator = result.value
      break
    }
    case 'smr': {
      // Observed deaths over the deaths the patients' own predicted risks add up to; read with care under 20 patients.
      const base = rows.filter(values => matchesAll(indicator.denominatorFilters, values))
      const observed = base.filter(values => matchesAll(indicator.filters, values)).length
      const expected = base.reduce((sum, values) => sum + (Number(values[indicator.field]) || 0) / 100, 0)
      result.numerator = observed
      result.denominator = round(expected, 2)
      result.value = expected > 0 ? round(observed / expected, 2) : null
      result.small = base.length > 0 && base.length < 20
      break
    }
    case 'rate': {
      const events = selected.length
      const days = numbersOf(rows.filter(values => matchesAll(indicator.denominatorFilters, values)), indicator.denominatorField).reduce((sum, n) => sum + n, 0)
      result.numerator = events
      result.denominator = days
      result.value = days ? round((events / days) * (Number(indicator.multiplier) || 1000), 2) : null
      break
    }
    default:
      break
  }
  return withStatus(result, indicator)
}

// On target, attention (past the threshold) or no target.
function withStatus(result: IndicatorResult, indicator: AnyRecord): IndicatorResult {
  const target = indicator.target === '' || indicator.target == null ? null : Number(indicator.target)
  const threshold = indicator.threshold === '' || indicator.threshold == null ? null : Number(indicator.threshold)
  if (result.value == null || (target == null && threshold == null) || !['higher', 'lower'].includes(indicator.direction)) return { ...result, status: 'context' }
  const higher = indicator.direction === 'higher'
  const good = target == null ? null : higher ? result.value >= target : result.value <= target
  const breach = threshold == null ? good === false : higher ? result.value < threshold : result.value > threshold
  return { ...result, status: breach ? 'breach' : good === false ? 'attention' : 'onTarget' }
}

// The indicator month by month for a year (the trend line of a report).
export function monthlySeries(register: AnyRecord, indicator: AnyRecord, entries: AnyRecord[] = [], year: number | string) {
  return Array.from({ length: 12 }, (_, index) => {
    const period = periodOf('month', `${year}-${pad(index + 1)}-01`)
    return { month: index + 1, period, ...computeIndicator(register, indicator, entries, period) }
  })
}

// An indicator split by the values of a list field (per doctor, per procedure).
export function breakdown(register: AnyRecord, indicator: AnyRecord, entries: AnyRecord[] = [], period: Period, field: string) {
  const definition = (register.fields || []).find((item: AnyRecord) => item.key === field)
  if (!definition) return []
  const inPeriod = periodEntries(register, entries, period, indicator).map(entry => computeValues(register.fields, entry.values || {}))
  // A text field (the diagnosis) is split by what was written, the most frequent first.
  const written = definition.type === 'text' ? [...inPeriod.reduce<Map<string, number>>((map, values) => { const text = String(values[field] || '').trim(); return text ? map.set(text, (map.get(text) || 0) + 1) : map }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([text]) => ({ value: text, label: text, labelEn: text })) : null
  const options: AnyRecord[] = [...(written || definition.options || []), { value: '', label: 'Χωρίς τιμή', labelEn: 'No value' }]
  return options.map(option => {
    const rows = inPeriod.filter(values => (option.value === '' ? isBlank(values[field]) : Array.isArray(values[field]) ? values[field].includes(option.value) : values[field] === option.value))
    return { option, count: rows.length, share: inPeriod.length ? round((rows.length / inPeriod.length) * 100) : null }
  }).filter(row => row.count > 0)
}

// A sheet indicator split by the rows it counts (per procedure) and by the measures (per shift).
export function sheetBreakdowns(register: AnyRecord, indicator: AnyRecord, entries: AnyRecord[] = [], period: Period) {
  if (register.kind !== 'sheet') return []
  const sheet = register.sheet || {}
  const inPeriod = entriesInPeriod(entries, period, indicator)
  const rows: AnyRecord[] = (sheet.rows || []).filter((row: AnyRecord) => !indicator.rows?.length || indicator.rows.includes(row.key))
  const measures: AnyRecord[] = (sheet.measures || []).filter((measure: AnyRecord) => !indicator.measure || measure.key === indicator.measure)
  const split = (key: string, label: string, labelEn: string, items: AnyRecord[], totalOf: (key: string) => number) => {
    const counts = items.map(item => ({ option: { value: item.key, label: item.label, labelEn: item.labelEn }, count: totalOf(item.key) })).filter(item => item.count)
    const total = counts.reduce((sum, item) => sum + item.count, 0)
    return { key, label, labelEn, rows: counts.map(item => ({ ...item, share: total ? round((item.count / total) * 100) : null })) }
  }
  const keys = (list: AnyRecord[]): string[] => list.map(item => item.key)
  return [
    rows.length > 1 && split('rows', 'Ανά γραμμή', 'By row', rows, row => sheetTotal(inPeriod, [row], keys(measures)) || 0),
    measures.length > 1 && split('measures', 'Ανά στήλη', 'By column', measures, measure => sheetTotal(inPeriod, keys(rows), [measure]) || 0),
  ].filter(Boolean).filter(item => item.rows.length)
}

// The rows of an indicator report: this period, the previous one, the same
// period a year before.
export type IndicatorReportRow = { indicator: AnyRecord, current: IndicatorResult, previous: IndicatorResult, lastYear: IndicatorResult }
export function indicatorReport(register: AnyRecord, entries: AnyRecord[] = [], period: Period): IndicatorReportRow[] {
  const previous = shiftPeriod(period, -periodLength(period))
  const lastYear = shiftPeriod(period, -12)
  // An indicator that counts only the cases with an answer recorded («Επιπλοκή», «Ένδειξη») waits until one case has it.
  const answerField = (key: string) => (register.fields || []).some((field: AnyRecord) => field.key === key && ['yesNo', 'choice'].includes(field.type) && field.key !== 'outcome')
  const never = (indicator: AnyRecord) => entries.length > 0 && (indicator.denominatorFilters || []).some((filter: AnyRecord) => ['filled', 'eq', 'yes', 'no'].includes(filter.op) && answerField(filter.field) && !entries.some(entry => { const value = entry.values?.[filter.field]; return value != null && value !== '' }))
  // A mean of a field nobody has filled (the age, when no birth date is known) has nothing to show.
  const empty = (indicator: AnyRecord) => entries.length > 0 && ['mean', 'median'].includes(indicator.aggregation) && register.kind !== 'sheet' && !entries.some(entry => !isBlank(computeValues(register.fields, entry.values || {})[indicator.field]))
  return (register.indicators || []).filter((indicator: AnyRecord) => !never(indicator) && !empty(indicator)).map((indicator: AnyRecord) => ({
    indicator,
    current: computeIndicator(register, indicator, entries, period),
    previous: computeIndicator(register, indicator, entries, previous),
    lastYear: computeIndicator(register, indicator, entries, lastYear),
  }))
}

// How much of a period a sheet has: months (before the daily sheets) or days with an entry, out
// of those that have passed. null when the period mixes the two or has not started.
export function sheetCoverage(entries: AnyRecord[] = [], period: Period, today: string, dailyFromValue?: unknown) {
  const dailyFrom = dailyStart(dailyFromValue)
  const months: string[] = []
  for (let month = period.from.slice(0, 7); month <= period.to.slice(0, 7); month = shiftPeriod(periodOf('month', `${month}-01`), 1).from.slice(0, 7)) if (`${month}-01` <= today) months.push(month)
  if (!months.length) return null
  // A month is whole before the start, whole after it, or cut by it (then nothing is said).
  const kinds = months.map(month => (`${month}-01` >= dailyFrom ? 'day' : `${month}-${pad(lastDay(Number(month.slice(0, 4)), Number(month.slice(5, 7))))}` < dailyFrom ? 'month' : 'mixed'))
  if (kinds.some(kind => kind !== kinds[0]) || kinds[0] === 'mixed') return null
  const inPeriod = entriesInPeriod(entries, period)
  if (kinds[0] === 'month') return { unit: 'month', recorded: new Set(inPeriod.map(entry => String(entry.periodStart).slice(0, 7)).filter(month => months.includes(month))).size, expected: months.length }
  const expected = months.reduce((sum, month) => sum + (month === today.slice(0, 7) ? Number(today.slice(8, 10)) : lastDay(Number(month.slice(0, 4)), Number(month.slice(5, 7)))), 0)
  return { unit: 'day', recorded: new Set(inPeriod.map(entry => String(entry.periodStart).slice(0, 10))).size, expected }
}

// What a filter says in words («Είδος τοκετού είναι Κ/Τ»).
export function filterText(register: AnyRecord, filter: AnyRecord, language = 'el') {
  const field = (register.fields || []).find((item: AnyRecord) => item.key === filter.field)
  if (!field) return ''
  const op = optionLabel(FILTER_OPS, filter.op, language)
  const value = ['eq', 'gt', 'lt'].includes(filter.op) ? ` ${filter.op === 'eq' ? formatValue(field, filter.value, language) : filter.value}` : ''
  return `${textOf(field, language)} ${op}${value}`
}

// A stable key for a new field or indicator from its label.
export function keyFrom(label: unknown, taken: string[] = []) {
  const map: Record<string, string> = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ά: 'a', έ: 'e', ή: 'i', ί: 'i', ό: 'o', ύ: 'y', ώ: 'o', ϊ: 'i', ϋ: 'y', ΐ: 'i', ΰ: 'y' }
  const base = String(label || '').toLowerCase().split('').map(char => map[char] ?? char).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'field'
  let key = base, index = 2
  while (taken.includes(key)) key = `${base}_${index++}`
  return key
}
