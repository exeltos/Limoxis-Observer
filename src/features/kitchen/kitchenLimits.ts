// HACCP critical limits of the kitchen and the in / out of limits rule. The same
// rule runs in the database (private.kitchen_check, 20261123110000_kitchen_module.sql),
// which marks every saved entry; here it gives the live check while the entry is typed.

export const LIMIT_KEYS = Object.freeze(['receipt_chilled', 'receipt_frozen', 'receipt_hot', 'cooking_core', 'chilling', 'reheating', 'frying_oil', 'defrost'])

// The defaults: chilled receipt ≤ 5 °C, frozen ≤ −18 °C, hot food ≥ 63 °C, cooking core
// ≥ 75 °C, chilling to ≤ 10 °C within 2 hours, reheating ≥ 75 °C, frying oil ≤ 180 °C,
// defrosting ends at ≤ 5 °C within 72 hours.
export const DEFAULT_LIMITS = Object.freeze([
  { limitKey: 'receipt_chilled', label: ['Παραλαβή ψυχόμενου', 'Chilled receipt'], minValue: null, maxValue: 5, withinMinutes: null },
  { limitKey: 'receipt_frozen', label: ['Παραλαβή κατεψυγμένου', 'Frozen receipt'], minValue: null, maxValue: -18, withinMinutes: null },
  { limitKey: 'receipt_hot', label: ['Παραλαβή ζεστού φαγητού', 'Hot food receipt'], minValue: 63, maxValue: null, withinMinutes: null },
  { limitKey: 'cooking_core', label: ['Μαγείρεμα (θερμοκρασία πυρήνα)', 'Cooking (core temperature)'], minValue: 75, maxValue: null, withinMinutes: null },
  { limitKey: 'chilling', label: ['Ψύξη μετά το μαγείρεμα', 'Chilling after cooking'], minValue: null, maxValue: 10, withinMinutes: 120 },
  { limitKey: 'reheating', label: ['Αναθέρμανση', 'Reheating'], minValue: 75, maxValue: null, withinMinutes: null },
  { limitKey: 'frying_oil', label: ['Τηγάνισμα (θερμοκρασία λαδιού)', 'Frying (oil temperature)'], minValue: null, maxValue: 180, withinMinutes: null },
  { limitKey: 'defrost', label: ['Απόψυξη (θερμοκρασία στο τέλος)', 'Defrosting (end temperature)'], minValue: null, maxValue: 5, withinMinutes: 4320 },
])

const num = value => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value))

// The organization's limits over the defaults (a saved row wins).
export function resolveLimits(rows = []) {
  return DEFAULT_LIMITS.map(item => {
    const own = rows.find(row => row.limitKey === item.limitKey)
    return own ? { ...item, ...own, label: item.label, minValue: num(own.minValue), maxValue: num(own.maxValue), withinMinutes: num(own.withinMinutes), active: own.active !== false } : { ...item, active: true }
  })
}
export const limitFor = (limits, key) => (Array.isArray(limits) ? limits : resolveLimits()).find(item => item.limitKey === key) || resolveLimits().find(item => item.limitKey === key)

// 'in', 'out', or null when nothing was measured (or the limit is switched off).
export function checkLimit(limits, key, value, minutes = null) {
  const v = num(value)
  if (v == null) return null
  const limit = limitFor(limits, key)
  if (!limit || limit.active === false) return null
  if (limit.minValue != null && v < limit.minValue) return 'out'
  if (limit.maxValue != null && v > limit.maxValue) return 'out'
  const m = num(minutes)
  if (limit.withinMinutes != null && m != null && m > limit.withinMinutes) return 'out'
  return 'in'
}

export const worstStatus = (...statuses) => (statuses.includes('out') ? 'out' : statuses.includes('in') ? 'in' : null)

// «≤ 5 °C», «≥ 75 °C», «≤ 10 °C σε 120′».
export function limitText(limit, language = 'el') {
  if (!limit) return ''
  const en = language === 'en'
  const value = n => String(n).replace('.', en ? '.' : ',')
  const parts = [limit.minValue != null && `≥ ${value(limit.minValue)} °C`, limit.maxValue != null && `≤ ${value(limit.maxValue)} °C`].filter(Boolean)
  const within = limit.withinMinutes != null ? (limit.withinMinutes % 60 === 0 && limit.withinMinutes >= 120 ? (en ? ` within ${limit.withinMinutes / 60} h` : ` σε ${limit.withinMinutes / 60} ώρες`) : (en ? ` within ${limit.withinMinutes} min` : ` σε ${limit.withinMinutes}′`)) : ''
  return `${parts.join(' · ')}${within}`
}

// A typed temperature: a number (comma or dot), else the text kept with a flag.
export function parseTemperature(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { value: null, text: '', unparsed: false }
  if (/^-?\d+([.,]\d+)?$/.test(raw)) {
    const value = Number(raw.replace(',', '.'))
    if (Math.abs(value) <= 250) return { value, text: '', unparsed: false }
  }
  return { value: null, text: raw, unparsed: true }
}

// Chilling written «temperature-minutes» (5-60) as in FileMaker, or the temperature alone.
export function parseChill(text) {
  const raw = String(text ?? '').trim()
  const pair = raw.match(/^(-?\d+(?:[.,]\d+)?)\s*[-/]\s*(\d{1,3})$/)
  if (pair) return { value: Number(pair[1].replace(',', '.')), minutes: Number(pair[2]), text: '', unparsed: false }
  const one = parseTemperature(raw)
  return { ...one, minutes: null }
}

// Frying: up to 120 °C the value is the food's core (cooking limit), above it the oil.
export const fryingStatus = (limits, value) => {
  const v = num(value)
  if (v == null) return null
  return v <= 120 ? checkLimit(limits, 'cooking_core', v) : checkLimit(limits, 'frying_oil', v)
}

export function thermalStatuses(limits, entry) {
  const cooking = checkLimit(limits, 'cooking_core', entry.cookingTemp)
  const chill = checkLimit(limits, 'chilling', entry.chillTemp, entry.chillMinutes)
  const reheat = checkLimit(limits, 'reheating', entry.reheatTemp)
  const frying = fryingStatus(limits, entry.fryingTemp)
  return { cooking, chill, reheat, frying, overall: worstStatus(cooking, chill, reheat, frying) }
}

export const minutesBetween = (start, end) => {
  if (!start || !end) return null
  const a = new Date(start).getTime(), b = new Date(end).getTime()
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 60000) : null
}
export const defrostStatus = (limits, entry) => checkLimit(limits, 'defrost', entry.endTemp, minutesBetween(entry.startedAt, entry.endedAt))

export const pureeingStatus = entry => (entry.visualCheck === false || entry.bladeCheck === false ? 'out' : entry.visualCheck || entry.bladeCheck ? 'in' : null)

const RECEIPT_TEMPERATURE_KEY = { chilled: 'receipt_chilled', frozen: 'receipt_frozen', hot: 'receipt_hot' }
export const RECEIPT_CHECKS = Object.freeze(['temperatureCheck', 'packagingCheck', 'expiryCheck', 'vehicleCheck', 'codingCheck'])

// A receipt: its own temperature against the class's limit, the five checks and its
// items (a rejected item or one out of limits makes the receipt nonconforming).
export function receiptStatus(limits, receipt, items = receipt.items || []) {
  const key = RECEIPT_TEMPERATURE_KEY[receipt.temperatureClass]
  const temperature = key ? checkLimit(limits, key, receipt.measuredTemperature) : null
  const itemStatuses = items.map(item => itemStatus(limits, item))
  const nonconforming = RECEIPT_CHECKS.some(field => receipt[field] === 'noncompliant') || temperature === 'out' || itemStatuses.includes('out') || items.some(item => item.accepted === false)
  const anyCheck = RECEIPT_CHECKS.some(field => receipt[field]) || temperature != null || itemStatuses.some(Boolean)
  const status = nonconforming ? 'out' : anyCheck ? 'in' : null
  const result = receipt.accepted === false ? 'rejected' : receipt.accepted == null ? 'pending' : nonconforming ? 'accepted_with_remarks' : 'accepted'
  return { temperature, status, result }
}
export const itemStatus = (limits, item) => (item.storage === 'frozen' ? checkLimit(limits, 'receipt_frozen', item.temperature) : item.storage === 'chilled' ? checkLimit(limits, 'receipt_chilled', item.temperature) : null)

// An entry made in the app out of limits needs a corrective action (the database refuses it otherwise).
export const needsCorrectiveAction = (status, action) => status === 'out' && String(action || '').trim().length < 3

export const statusLabel = (status, language = 'el') => (status === 'out' ? (language === 'en' ? 'Out of limits' : 'Εκτός ορίων') : status === 'in' ? (language === 'en' ? 'Within limits' : 'Εντός ορίων') : (language === 'en' ? 'Not measured' : 'Χωρίς μέτρηση'))
export const statusTone = status => (status === 'out' ? 'danger' : status === 'in' ? 'success' : 'neutral')
