// The application's calendar-day format ("20/8/2026" in Greek, "20/08/2026" in English),
// the same as Intl.DateTimeFormat with the UI locale that most screens already use.
export function formatDay(value, language = 'el') {
  if (!value) return '—'
  const text = String(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return String(value)
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR').format(new Date(`${text}T12:00:00`))
}

// A day and a 24-hour time in the same day format ("11/6/2026 11:10", Athens time), for lists that
// mix events with and without a time.
export function formatDayTime(value, language = 'el') {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const locale = language === 'en' || language === 'en-GB' ? 'en-GB' : 'el-GR'
  const zone = { timeZone: 'Europe/Athens' }
  const day = new Intl.DateTimeFormat(locale, zone).format(date)
  const time = new Intl.DateTimeFormat(locale, { ...zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  return `${day} ${time}`
}

// Date and 24-hour time ("16/10/2026, 09:05"), the format of every registry and
// record that shows when something happened or is due.
export function formatDateTime(value, language = 'el') {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const locale = language === 'en' || language === 'en-GB' ? 'en-GB' : 'el-GR'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}
