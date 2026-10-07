// The application's calendar-day format ("20/8/2026" in Greek, "20/08/2026" in English),
// the same as Intl.DateTimeFormat with the UI locale that most screens already use.
export function formatDay(value, language = 'el') {
  if (!value) return '—'
  const text = String(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return String(value)
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR').format(new Date(`${text}T12:00:00`))
}
