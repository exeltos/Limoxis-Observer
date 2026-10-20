import { Button } from '../../../design-system/Button'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { FORM_STATUS } from './formStatus'

// The one row of every form connected to an episode (bundles, scales, notifiable report,
// incidents, questionnaires …): title with a detail line, the status in plain words, the
// last date and one action. Colour only for a safety signal (overdue, a notifiable
// finding); «Ολοκληρώθηκε» and «Εκκρεμεί» are plain words.
//
//   <FormRow title detail status={FORM_STATUS.OVERDUE} statusDetail date dateLabel
//            action={{ label, onClick, primary }} signal="danger" />
// Props are listed above.
export function FormRow({ title, detail, status, statusLabel, statusDetail, signal = '', badge = null, date, dateLabel, action = null, children }) {
  const { t } = useLanguage()
  const word = statusLabel || (status ? t(`episodeForms.status.${status}`) : '')
  const danger = signal === 'danger' || status === FORM_STATUS.OVERDUE
  return (
    <li className={`episode-form-row${danger ? ' is-signal' : ''}`}>
      <div className="episode-form-main">
        <strong>
          {title}
          {badge && <StatusBadge tone={badge.tone || 'neutral'}>{badge.label}</StatusBadge>}
        </strong>
        {detail && <small>{detail}</small>}
        {children}
      </div>
      <div className="episode-form-status">
        {word && (danger ? <StatusBadge tone="danger">{word}</StatusBadge> : <span>{word}</span>)}
        {statusDetail && <small>{statusDetail}</small>}
      </div>
      <div className="episode-form-date">
        {date ? <b>{date}</b> : <span className="episode-form-none">—</span>}
        {dateLabel && <small>{dateLabel}</small>}
      </div>
      <div className="episode-form-action">
        {action && (
          <Button variant={action.primary ? 'primary' : 'secondary'} onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </Button>
        )}
      </div>
    </li>
  )
}

// The same empty sentence of every section: what will appear here and where the action starts.
export function FormEmpty({ children }) {
  return <p className="episode-form-empty">{children}</p>
}

export function FormRows({ children, label }) {
  return (
    <ul className="episode-form-rows" aria-label={label}>
      {children}
    </ul>
  )
}
