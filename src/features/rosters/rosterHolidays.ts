// Public holidays of the roster (owner, 18/11/2026): the Greek national ones, the movable ones that follow the
// Orthodox Easter, and the hospital's local feast (roster.rules.localHoliday). A holiday works as a weekend day:
// weekend numbers of people (or the roster's own «Αργίες» numbers), shared fairly with the weekends, the supernumerary
// off, «no weekends» people off.
import type { RosterDay } from './rosterRules'

// The local feast of the hospital: «MM-DD» and its name.
export type LocalHoliday = { date?: string, name?: string }

const pad = (value: number) => String(value).padStart(2, '0')
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

// The Orthodox Easter Sunday (Meeus' Julian computus, then the 13 days to the Gregorian calendar: 1900–2099).
export function orthodoxEaster(year: number) {
  const a = year % 4
  const b = year % 7
  const c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const month = Math.floor((d + e + 114) / 31)
  const day = ((d + e + 114) % 31) + 1
  return addDays(`${year}-${pad(month)}-${pad(day)}`, 13)
}

// The public holidays of a year: date → [Greek name, English name].
export function greekHolidays(year: number): Record<string, [string, string]> {
  const easter = orthodoxEaster(year)
  return {
    [`${year}-01-01`]: ['Πρωτοχρονιά', 'New Year’s Day'],
    [`${year}-01-06`]: ['Θεοφάνεια', 'Epiphany'],
    [addDays(easter, -48)]: ['Καθαρά Δευτέρα', 'Clean Monday'],
    [`${year}-03-25`]: ['25η Μαρτίου', 'Independence Day'],
    [addDays(easter, -2)]: ['Μεγάλη Παρασκευή', 'Good Friday'],
    [easter]: ['Κυριακή του Πάσχα', 'Easter Sunday'],
    [addDays(easter, 1)]: ['Δευτέρα του Πάσχα', 'Easter Monday'],
    [`${year}-05-01`]: ['Πρωτομαγιά', 'Labour Day'],
    [addDays(easter, 50)]: ['Αγίου Πνεύματος', 'Whit Monday'],
    [`${year}-08-15`]: ['Κοίμηση της Θεοτόκου', 'Assumption'],
    [`${year}-10-28`]: ['28η Οκτωβρίου', 'Ochi Day'],
    [`${year}-12-25`]: ['Χριστούγεννα', 'Christmas Day'],
    [`${year}-12-26`]: ['Σύναξη της Θεοτόκου', 'Boxing Day'],
  }
}

// The name of the holiday on a date, or '' (the local feast by its «MM-DD»).
export function holidayName(date: string, local: LocalHoliday | null | undefined, language = 'el') {
  const own = greekHolidays(Number(date.slice(0, 4)))[date]
  if (own) return own[language === 'en' ? 1 : 0]
  if (local?.date && /^\d{2}-\d{2}$/.test(local.date) && date.slice(5) === local.date) return local.name || (language === 'en' ? 'Local feast' : 'Τοπική εορτή')
  return ''
}

// The days of the period with their holidays marked: a holiday counts as a weekend day.
export function markHolidays(days: RosterDay[], local?: LocalHoliday | null, language = 'el'): RosterDay[] {
  return days.map((day) => {
    const name = holidayName(day.date, local, language)
    return name ? { ...day, holiday: name, weekend: true } : day
  })
}
