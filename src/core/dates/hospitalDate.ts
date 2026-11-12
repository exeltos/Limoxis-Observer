// Το νοσοκομείο μετρά τις ημέρες στην ώρα Ευρώπης/Αθήνας. Το
// `toISOString().slice(0, 10)` δίνει την ημέρα σε UTC: μετά τα μεσάνυχτα της
// Αθήνας (έως τις 02:00 ή 03:00) δείχνει ακόμη τη χθεσινή.
export const HOSPITAL_TIME_ZONE = 'Europe/Athens'

/** Ημέρα 'YYYY-MM-DD'. */
export type IsoDay = string
/** Μήνας 'YYYY-MM'. */
export type IsoMonth = string

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: HOSPITAL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

// 'YYYY-MM-DD' της στιγμής `value` στο ρολόι του νοσοκομείου ('' αν δεν είναι ημερομηνία).
export function hospitalDate(value: Date | string | number = new Date()): IsoDay {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : DAY.format(date)
}

// Σήμερα, 'YYYY-MM-DD', στο ρολόι του νοσοκομείου.
export const hospitalToday = (): IsoDay => hospitalDate()

// Ο μήνας, 'YYYY-MM', στο ρολόι του νοσοκομείου.
export const hospitalMonth = (value: Date | string | number = new Date()): IsoMonth => hospitalDate(value).slice(0, 7)

const CLOCK = new Intl.DateTimeFormat('en-GB', { timeZone: HOSPITAL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Η ημέρα και η ώρα στο ρολόι του νοσοκομείου. */
export interface HospitalClock {
  date: IsoDay
  /** 'HH:MM', 00:00–23:59. */
  time: string
  hour: number
}

function clockParts(value: Date | string | number): HospitalClock {
  const parts = CLOCK.formatToParts(value instanceof Date ? value : new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}`, hour: Number(part('hour')) % 24 }
}

// «Τώρα» στο ρολόι του νοσοκομείου: { date: 'YYYY-MM-DD', time: 'HH:MM' }.
export function hospitalNow(now: Date | string | number = new Date()): { date: IsoDay; time: string } {
  const { date, time } = clockParts(now)
  return { date, time }
}

// Η ώρα (0–23) της στιγμής `value` στο ρολόι του νοσοκομείου.
export const hospitalHour = (value: Date | string | number = new Date()): number => clockParts(value).hour

// Η ημέρα μιας ημερομηνίας ή χρονοσφραγίδας της βάσης. Η βάση δίνει τις
// χρονοσφραγίδες σε UTC (δείγμα στις 00:00 στην Ελλάδα διαβάζεται 21:00 ή 22:00
// της προηγούμενης), οπότε μια τιμή με ζώνη διαβάζεται στην ώρα του νοσοκομείου·
// μια σκέτη ημερομηνία 'YYYY-MM-DD' μένει ως έχει.
export function hospitalDay(value: unknown): IsoDay {
  const text = String(value || '')
  if (text.length <= 10 || !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text)) return text.slice(0, 10)
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text.slice(0, 10)
  return hospitalDate(date)
}
