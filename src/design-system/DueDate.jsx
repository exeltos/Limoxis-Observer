import { useLanguage } from '../core/i18n/LanguageContext'
import './DueDate.css'

const DAY = 86400000
const dayOf = value => { const text = String(value || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? Date.parse(`${text}T00:00:00Z`) : NaN }

// Days a due date is past (0 when not overdue or unknown). Compared by calendar day.
export function daysOverdue(value, today = new Date()) {
  const due = dayOf(value)
  if (!Number.isFinite(due)) return 0
  const now = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.max(0, Math.round((now - due) / DAY))
}

// A due date that turns red, with "N days overdue", once it has passed.
export function DueDate({ value, format, today }) {
  const { language } = useLanguage()
  if (!value) return '—'
  const text = format ? format(value) : value
  const late = daysOverdue(value, today)
  if (!late) return <span className="due-date">{text}</span>
  const label = language === 'en' ? `overdue ${late} ${late === 1 ? 'day' : 'days'}` : `εκπρόθεσμη ${late} ${late === 1 ? 'ημέρα' : 'ημέρες'}`
  return <span className="due-date overdue" title={label}>{text}<small>{label}</small></span>
}
