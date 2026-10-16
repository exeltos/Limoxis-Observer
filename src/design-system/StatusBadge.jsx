import './StatusBadge.css'

// The one coloured status label of the application. tone: success (done, in
// date, on schedule), info (draft, in progress), warning (due soon, expiring),
// danger (overdue, expired, non-compliant) or neutral.
const LEGACY_CLASS = { success: 'active', info: 'info', warning: 'warning', danger: 'danger', neutral: '' }
const TONE_ALIASES = { active: 'success', ok: 'success', done: 'success', temporary: 'info', draft: 'info', risk: 'danger', error: 'danger', muted: 'neutral' }

export function statusTone(value) {
  const tone = TONE_ALIASES[value] || value
  return tone in LEGACY_CLASS ? tone : 'neutral'
}

export function StatusBadge({ tone = 'neutral', icon: Icon, className = '', title, children }) {
  const resolved = statusTone(tone)
  return (
    <span className={['status-badge', LEGACY_CLASS[resolved], `lo-tone-${resolved}`, className].filter(Boolean).join(' ')} title={title}>
      {Icon && <Icon size={11} aria-hidden="true" />}
      {children}
    </span>
  )
}
