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
