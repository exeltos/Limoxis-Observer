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

// Operations screens: only a safety signal (out of limits, expired, overdue,
// failed: the danger tone) is a coloured chip; everything else is plain text with
// the same words (a time-critical warning in bold).
export function SignalBadge({ tone = 'neutral', icon: Icon, className = '', title, children }) {
  const resolved = statusTone(tone)
  if (resolved === 'danger') return <StatusBadge tone="danger" icon={Icon} className={className} title={title}>{children}</StatusBadge>
  return <span className={['status-plain', resolved === 'warning' && 'is-strong', className].filter(Boolean).join(' ')} title={title}>{Icon && <Icon size={11} aria-hidden="true" />}{children}</span>
}
