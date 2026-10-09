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

// Monthly figures (waste, antiseptics, dispensing) move by whole months, so a
// July period stays "1–31 of a month" instead of becoming 11 Aug – 10 Sep.
export function shiftDemoMonth(value, months) {
  if (!months || typeof value !== 'string' || !/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return value
  const [year, month, day] = value.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const ym = target.toISOString().slice(0, 7)
  if (!day) return ym
  const lastDay = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  const wasLast = day === lastDay(new Date(Date.UTC(year, month - 1, 1)))
  return `${ym}-${String(wasLast ? lastDay(target) : Math.min(day, lastDay(target))).padStart(2, '0')}`
}
const PERIOD_KEY = /^period(Start|End)?$/

// Shifts the dates of the Demo datasets in place (shared nested objects once).
export function shiftDemoDatesInPlace(datasets, days = demoOffsetDays()) {
  if (!days) return datasets
  const seen = new WeakSet()
  const walk = node => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (typeof node.periodStart === 'string' || typeof node.periodEnd === 'string') return shiftPeriodRecord(node)
    for (const key of Object.keys(node)) {
      const value = node[key]
      // An adult's birth date is a fact about the person, not part of the story:
      // shifting it would move birthdays (and the birthday greeting) to arbitrary
      // days. A baby's birth date is part of the story (age at admission), so it moves.
      if (typeof value === 'string') { if (!BIRTH_KEY.test(key) || value >= INFANT_SINCE) node[key] = shiftDemoDate(value, days) }
      else walk(value)
    }
  }
  // A period record moves by months; values tied to its period end (the record
  // date, when it was entered) follow the end, the rest move by days.
  const months = Math.round(days / 30.4375)
  const shiftPeriodRecord = node => {
    const end = node.periodEnd, newEnd = shiftDemoMonth(end, months)
    for (const key of Object.keys(node)) {
      const value = node[key]
      if (typeof value !== 'string') walk(value)
      else if (PERIOD_KEY.test(key)) node[key] = shiftDemoMonth(value, months)
      else if (end && value.startsWith(end)) node[key] = newEnd + value.slice(end.length)
      else if (key === 'period' || / – /.test(value)) node[key] = value.replace(/\d{4}-\d{2}(-\d{2})?/g, part => shiftDemoMonth(part, months))
      else if (!BIRTH_KEY.test(key)) node[key] = shiftDemoDate(value, days)
    }
  }
  walk(datasets)
  return datasets
}

// Monthly meetings ("Regular meeting of August") move by whole months, and the
// month named in their title moves with them.
const MONTH_NAMES = [
  ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου','Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'],
  ['January','February','March','April','May','June','July','August','September','October','November','December'],
]
export function shiftDemoMonthsInPlace(datasets, months = Math.round(demoOffsetDays() / 30.4375)) {
  if (!months) return datasets
  const seen = new WeakSet()
  const shiftValue = (key, value) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return shiftDemoMonth(value.slice(0, 10), months) + value.slice(10)
    if (/title/i.test(key)) return value.replace(new RegExp(MONTH_NAMES.flat().join('|'), 'g'), name => {
      const list = MONTH_NAMES.find(names => names.includes(name))
      return list[(list.indexOf(name) + months % 12 + 12) % 12]
    })
    return value
  }
  const walk = node => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    for (const key of Object.keys(node)) {
      if (typeof node[key] === 'string') node[key] = shiftValue(key, node[key])
      else walk(node[key])
    }
  }
  walk(datasets)
  return datasets
}
