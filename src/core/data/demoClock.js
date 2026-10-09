// The Demo data was written as if today were DEMO_AUTHORED_ON. Shifting every date
// in it by the days since then keeps the story current: what was "due in 3 days"
// is due in 3 days from today, instead of looking weeks overdue.
export const DEMO_AUTHORED_ON = '2026-08-29'
const DAY_MS = 86_400_000
const BIRTH_KEY = /birth|dob/i
const INFANT_SINCE = '2025-08-29' // one year before DEMO_AUTHORED_ON
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/

export function demoOffsetDays(today = new Date()) {
  // Tests compare fixed fixture dates, so they always see the data as written.
  if (import.meta.env?.MODE === 'test') return 0
  const authored = Date.UTC(...DEMO_AUTHORED_ON.split('-').map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.round((now - authored) / DAY_MS))
}

export function shiftDemoDate(value, days) {
  if (!days || typeof value !== 'string') return value
  if (DATE_ONLY.test(value)) return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
  if (DATE_TIME.test(value)) {
    // Keep the original form: with a zone it stays an ISO instant, without one a local time.
    if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return new Date(Date.parse(value) + days * DAY_MS).toISOString()
    const pad = n => String(n).padStart(2, '0')
    const local = new Date(new Date(value).getTime() + days * DAY_MS)
    return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${value.slice(11)}`
  }
  return value
}

// Shifts the dates of the Demo datasets in place (shared nested objects once).
export function shiftDemoDatesInPlace(datasets, days = demoOffsetDays()) {
  if (!days) return datasets
  const seen = new WeakSet()
  const walk = node => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    for (const key of Object.keys(node)) {
      const value = node[key]
      // An adult's birth date is a fact about the person, not part of the story:
      // shifting it would move birthdays (and the birthday greeting) to arbitrary
      // days. A baby's birth date is part of the story (age at admission), so it moves.
      if (typeof value === 'string') { if (!BIRTH_KEY.test(key) || value >= INFANT_SINCE) node[key] = shiftDemoDate(value, days) }
      else walk(value)
    }
  }
  walk(datasets)
  return datasets
}
