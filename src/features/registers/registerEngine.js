// Department registers (Quality Center, phase 4): what a department records and
// how its indicators are computed. A register is one of two kinds:
// - case: one entry per case (a neonate in the NICU), with typed fields;
// - sheet: one entry per period (a month in Ophthalmology), a grid of rows
//   (procedures) × measures (number, planned / urgent) with whole numbers.
// The definition lives in the register (fields, sheet, indicators), so a
// hospital builds its own without a code change.

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
const APACHE_MORTALITY = { medical: [4, 8, 15, 25, 40, 55, 75, 85], postop: [1, 3, 7, 12, 30, 35, 73, 88] }
export function apacheMortality(score, postop) {
  if (score === null || score === undefined || score === '' || typeof postop !== 'boolean' || !Number.isFinite(Number(score))) return null
  return APACHE_MORTALITY[postop ? 'postop' : 'medical'][Math.min(7, Math.max(0, Math.floor(Number(score) / 5)))]
}

export const AGGREGATIONS = [
  { value: 'count', label: ['Πλήθος', 'Count'] },
  { value: 'percent', label: ['Ποσοστό %', 'Percentage %'] },
  { value: 'mean', label: ['Μέσος όρος', 'Mean'] },
  { value: 'median', label: ['Διάμεσος', 'Median'] },
  { value: 'sum', label: ['Άθροισμα', 'Sum'] },
  { value: 'rate', label: ['Ρυθμός ανά 1.000', 'Rate per 1,000'] },
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

export const optionLabel = (list, value, language = 'el') => {
  const item = list.find(option => option.value === value)
  return item ? item.label[language === 'en' ? 1 : 0] : value || ''
}
export const optionsOf = (list, language = 'el') => list.map(option => ({ value: option.value, label: option.label[language === 'en' ? 1 : 0] }))
export const textOf = (item, language = 'el') => (language === 'en' ? item?.labelEn || item?.titleEn || item?.nameEn : '') || item?.label || item?.title || item?.name || ''

const isBlank = value => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
const dayNumber = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000 : null
}
export const daysBetween = (from, to) => {
  const a = dayNumber(from), b = dayNumber(to)
  return a == null || b == null ? null : b - a
}

// Gestation is stored as total days and shown as weeks+days (37+4).
export const gestationText = days => (Number.isFinite(Number(days)) && days !== '' && days != null ? `${Math.floor(Number(days) / 7)}+${Number(days) % 7}` : '')
export function parseGestation(text) {
  const match = /^\s*(\d{1,2})(?:\s*[+,.]\s*(\d))?\s*$/.exec(String(text || ''))
  if (!match) return null
  const days = Number(match[2] || 0)
  return days > 6 ? null : Number(match[1]) * 7 + days
}

// The values of an entry with its computed fields filled in.
export function computeValues(fields = [], values = {}) {
  const next = { ...values }
  for (const field of fields) {
    if (field.type !== 'computed') continue
    const from = next[field.from], to = field.to ? next[field.to] : null
    let value = null
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
export function fieldVisible(field, values = {}) {
  if (!field.showWhen?.field) return true
  const value = values[field.showWhen.field]
  return field.showWhen.value === undefined ? !isBlank(value) && value !== false : Array.isArray(value) ? value.includes(field.showWhen.value) : value === field.showWhen.value
}

// A field required only from a date on (data the register did not keep in its early years).
export const isRequired = (field, entryDate) => Boolean(field.required) && !(field.requiredFrom && entryDate && String(entryDate).slice(0, 10) < field.requiredFrom)

// Errors stop the save; warnings ask the user to check (an unusual value).
export function validateEntry(fields = [], values = {}, language = 'el', entryDate = '') {
  const en = language === 'en'
  const errors = {}, warnings = {}
  const full = computeValues(fields, values)
  for (const field of fields) {
    if (field.type === 'computed' || !fieldVisible(field, full)) continue
    const value = full[field.key]
    if (isRequired(field, entryDate) && isBlank(value)) { errors[field.key] = en ? 'Required' : 'Υποχρεωτικό'; continue }
    if (isBlank(value)) continue
    if (field.type === 'number' || field.type === 'gestation') {
      const number = Number(value)
      if (!Number.isFinite(number)) { errors[field.key] = en ? 'Not a number' : 'Δεν είναι αριθμός'; continue }
      const shown = field.type === 'gestation' ? gestationText : String
      if (field.min !== undefined && field.min !== '' && number < Number(field.min)) errors[field.key] = en ? `At least ${shown(field.min)}` : `Τουλάχιστον ${shown(field.min)}`
      else if (field.max !== undefined && field.max !== '' && number > Number(field.max)) errors[field.key] = en ? `At most ${shown(field.max)}` : `Το πολύ ${shown(field.max)}`
      else if (field.usualMin !== undefined && field.usualMin !== '' && number < Number(field.usualMin)) warnings[field.key] = en ? 'Unusually low, please check' : 'Ασυνήθιστα χαμηλό, ελέγξτε'
      else if (field.usualMax !== undefined && field.usualMax !== '' && number > Number(field.usualMax)) warnings[field.key] = en ? 'Unusually high, please check' : 'Ασυνήθιστα υψηλό, ελέγξτε'
    }
    if (field.type === 'date' && field.notBefore && !isBlank(full[field.notBefore])) {
      const before = fields.find(item => item.key === field.notBefore)
      if (daysBetween(full[field.notBefore], value) < 0) errors[field.key] = en ? `Not before «${textOf(before, 'en')}»` : `Όχι πριν από «${textOf(before)}»`
    }
  }
  return { errors, warnings, valid: Object.keys(errors).length === 0 }
}

// How a value reads in a list or a report.
export function formatValue(field, value, language = 'el') {
  const en = language === 'en'
  if (isBlank(value)) return '—'
  if (field.type === 'yesNo') return value === true || value === 'yes' ? (en ? 'Yes' : 'Ναι') : value === false || value === 'no' ? (en ? 'No' : 'Όχι') : en ? 'Unknown' : 'Άγνωστο'
  if (field.type === 'choice') return textOf((field.options || []).find(option => option.value === value), language) || String(value)
  if (field.type === 'multiChoice') return (Array.isArray(value) ? value : [value]).map(item => textOf((field.options || []).find(option => option.value === item), language) || item).join(', ')
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

const pad = n => String(n).padStart(2, '0')
const lastDay = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()

// The period (kind) that contains a day: { from, to, key }.
export function periodOf(kind, day) {
  const [year, month] = String(day).slice(0, 7).split('-').map(Number)
  const length = { month: 1, quarter: 3, half: 6, year: 12 }[kind] || 1
  const first = Math.floor((month - 1) / length) * length + 1
  const last = first + length - 1
  return { from: `${year}-${pad(first)}-01`, to: `${year}-${pad(last)}-${pad(lastDay(year, last))}`, key: `${kind}:${year}-${pad(first)}` }
}

// The same period one step back (previous) and one year back.
export function shiftPeriod(period, months) {
  const [year, month] = period.from.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + months, 1))
  const kind = period.key.split(':')[0]
  return periodOf(kind, `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`)
}
export const periodLength = period => ({ month: 1, quarter: 3, half: 6, year: 12 }[period.key.split(':')[0]] || 1)

export function periodLabel(period, language = 'el') {
  const en = language === 'en'
  const [kind, start] = period.key.split(':')
  const [year, month] = start.split('-').map(Number)
  if (kind === 'year') return String(year)
  if (kind === 'half') return `${Math.ceil(month / 6)}${en ? 'H' : 'ο εξάμηνο'} ${year}`
  if (kind === 'quarter') return `${en ? 'Q' : ''}${Math.ceil(month / 3)}${en ? '' : 'ο τρίμηνο'} ${year}`
  return new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

// --- Indicators --------------------------------------------------------------

const matches = (filter, values) => {
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
export const matchesAll = (filters = [], values = {}) => filters.every(filter => matches(filter, values))

// The day an entry counts on for an indicator: the indicator's date field
// (e.g. the discharge date for length of stay), else the entry date.
const entryDay = (entry, indicator) => (indicator?.dateField ? entry.values?.[indicator.dateField] : null) || entry.periodStart || entry.entryDate

export const entriesInPeriod = (entries = [], period, indicator) => entries.filter(entry => {
  const day = String(entryDay(entry, indicator) || '').slice(0, 10)
  return day && day >= period.from && day <= period.to
})

const mean = numbers => (numbers.length ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : null)
const median = numbers => {
  if (!numbers.length) return null
  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const numbersOf = (rows, field) => rows.map(values => values[field]).filter(value => !isBlank(value) && Number.isFinite(Number(value))).map(Number)
const round = (value, digits = 1) => (value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits)))

// A sheet entry as the totals the indicators read: row × measure.
const sheetCell = (values, row, measure) => {
  const cell = values?.[row]?.[measure]
  return isBlank(cell) ? null : Number(cell)
}
export function sheetTotal(entries = [], rows = [], measures = []) {
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
export function computeIndicator(register, indicator, entries = [], period) {
  const inPeriod = entriesInPeriod(entries, period, indicator)
  const result = { id: indicator.id, value: null, numerator: null, denominator: null, n: inPeriod.length, small: false }
  if (register.kind === 'sheet') {
    const sheet = register.sheet || {}
    const allRows = (sheet.rows || []).map(row => row.key)
    const allMeasures = (sheet.measures || []).map(measure => measure.key)
    const numRows = indicator.rows?.length ? indicator.rows : allRows
    const numMeasures = indicator.measure ? [indicator.measure] : allMeasures
    const numerator = sheetTotal(inPeriod, numRows, numMeasures)
    result.numerator = numerator
    if (indicator.aggregation === 'percent') {
      const denominator = sheetTotal(inPeriod, indicator.denominatorRows?.length ? indicator.denominatorRows : allRows, indicator.denominatorMeasure ? [indicator.denominatorMeasure] : allMeasures)
      result.denominator = denominator
      result.value = numerator == null || !denominator ? null : round((numerator / denominator) * 100)
    } else if (indicator.aggregation === 'mean') {
      const months = inPeriod.filter(entry => numRows.some(row => numMeasures.some(measure => sheetCell(entry.values, row, measure) != null))).length
      result.denominator = months
      result.value = numerator == null || !months ? null : round(numerator / months)
    } else result.value = numerator
    result.small = false
    return withStatus(result, indicator)
  }
  const rows = inPeriod.map(entry => computeValues(register.fields, entry.values || {}))
  const selected = rows.filter(values => matchesAll(indicator.filters, values))
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
function withStatus(result, indicator) {
  const target = indicator.target === '' || indicator.target == null ? null : Number(indicator.target)
  const threshold = indicator.threshold === '' || indicator.threshold == null ? null : Number(indicator.threshold)
  if (result.value == null || (target == null && threshold == null) || !['higher', 'lower'].includes(indicator.direction)) return { ...result, status: 'context' }
  const higher = indicator.direction === 'higher'
  const good = target == null ? null : higher ? result.value >= target : result.value <= target
  const breach = threshold == null ? good === false : higher ? result.value < threshold : result.value > threshold
  return { ...result, status: breach ? 'breach' : good === false ? 'attention' : 'onTarget' }
}

// The indicator month by month for a year (the trend line of a report).
export function monthlySeries(register, indicator, entries = [], year) {
  return Array.from({ length: 12 }, (_, index) => {
    const period = periodOf('month', `${year}-${pad(index + 1)}-01`)
    return { month: index + 1, period, ...computeIndicator(register, indicator, entries, period) }
  })
}

// An indicator split by the values of a list field (per doctor, per procedure).
export function breakdown(register, indicator, entries = [], period, field) {
  const definition = (register.fields || []).find(item => item.key === field)
  if (!definition) return []
  const inPeriod = entriesInPeriod(entries, period, indicator).map(entry => computeValues(register.fields, entry.values || {}))
  const options = [...(definition.options || []), { value: '', label: 'Χωρίς τιμή', labelEn: 'No value' }]
  return options.map(option => {
    const rows = inPeriod.filter(values => (option.value === '' ? isBlank(values[field]) : Array.isArray(values[field]) ? values[field].includes(option.value) : values[field] === option.value))
    return { option, count: rows.length, share: inPeriod.length ? round((rows.length / inPeriod.length) * 100) : null }
  }).filter(row => row.count > 0)
}

// A sheet indicator split by the rows it counts (per procedure) and by the measures (per shift).
export function sheetBreakdowns(register, indicator, entries = [], period) {
  if (register.kind !== 'sheet') return []
  const sheet = register.sheet || {}
  const inPeriod = entriesInPeriod(entries, period, indicator)
  const rows = (sheet.rows || []).filter(row => !indicator.rows?.length || indicator.rows.includes(row.key))
  const measures = (sheet.measures || []).filter(measure => !indicator.measure || measure.key === indicator.measure)
  const split = (key, label, labelEn, items, totalOf) => {
    const counts = items.map(item => ({ option: { value: item.key, label: item.label, labelEn: item.labelEn }, count: totalOf(item.key) })).filter(item => item.count)
    const total = counts.reduce((sum, item) => sum + item.count, 0)
    return { key, label, labelEn, rows: counts.map(item => ({ ...item, share: total ? round((item.count / total) * 100) : null })) }
  }
  const keys = list => list.map(item => item.key)
  return [
    rows.length > 1 && split('rows', 'Ανά γραμμή', 'By row', rows, row => sheetTotal(inPeriod, [row], keys(measures)) || 0),
    measures.length > 1 && split('measures', 'Ανά στήλη', 'By column', measures, measure => sheetTotal(inPeriod, keys(rows), [measure]) || 0),
  ].filter(item => item && item.rows.length)
}

// The rows of an indicator report: this period, the previous one, the same
// period a year before.
export function indicatorReport(register, entries = [], period) {
  const previous = shiftPeriod(period, -periodLength(period))
  const lastYear = shiftPeriod(period, -12)
  return (register.indicators || []).map(indicator => ({
    indicator,
    current: computeIndicator(register, indicator, entries, period),
    previous: computeIndicator(register, indicator, entries, previous),
    lastYear: computeIndicator(register, indicator, entries, lastYear),
  }))
}

// How much of a period a sheet has: months (before the daily sheets) or days with an entry, out
// of those that have passed. null when the period mixes the two or has not started.
export function sheetCoverage(entries = [], period, today, dailyFrom) {
  const months = []
  for (let month = period.from.slice(0, 7); month <= period.to.slice(0, 7); month = shiftPeriod(periodOf('month', `${month}-01`), 1).from.slice(0, 7)) if (`${month}-01` <= today) months.push(month)
  if (!months.length) return null
  const legacy = months.map(month => month < dailyFrom)
  if (legacy.some(Boolean) && !legacy.every(Boolean)) return null
  const inPeriod = entriesInPeriod(entries, period)
  if (legacy[0]) return { unit: 'month', recorded: new Set(inPeriod.map(entry => String(entry.periodStart).slice(0, 7)).filter(month => months.includes(month))).size, expected: months.length }
  const expected = months.reduce((sum, month) => sum + (month === today.slice(0, 7) ? Number(today.slice(8, 10)) : lastDay(Number(month.slice(0, 4)), Number(month.slice(5, 7)))), 0)
  return { unit: 'day', recorded: new Set(inPeriod.map(entry => String(entry.periodStart).slice(0, 10))).size, expected }
}

// What a filter says in words («Είδος τοκετού είναι Κ/Τ»).
export function filterText(register, filter, language = 'el') {
  const field = (register.fields || []).find(item => item.key === filter.field)
  if (!field) return ''
  const op = optionLabel(FILTER_OPS, filter.op, language)
  const value = ['eq', 'gt', 'lt'].includes(filter.op) ? ` ${filter.op === 'eq' ? formatValue(field, filter.value, language) : filter.value}` : ''
  return `${textOf(field, language)} ${op}${value}`
}

// A stable key for a new field or indicator from its label.
export function keyFrom(label, taken = []) {
  const map = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ά: 'a', έ: 'e', ή: 'i', ί: 'i', ό: 'o', ύ: 'y', ώ: 'o', ϊ: 'i', ϋ: 'y', ΐ: 'i', ΰ: 'y' }
  const base = String(label || '').toLowerCase().split('').map(char => map[char] ?? char).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'field'
  let key = base, index = 2
  while (taken.includes(key)) key = `${base}_${index++}`
  return key
}
