import { Button } from '../../../design-system/Button'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { FORM_STATUS } from './formStatus'
import { useFormsTab } from './FormSection'

// The one row of every form connected to an episode (bundles, scales, notifiable report,
// incidents, questionnaires …): title with a detail line, the status in plain words, the
// last date and one action. Colour only for a safety signal (overdue, a notifiable
// finding); «Ολοκληρώθηκε» and «Εκκρεμεί» are plain words.
//
//   <FormRow title detail status={FORM_STATUS.OVERDUE} statusDetail date dateLabel
//            action={{ label, onClick, primary }} menu={[{ label, icon, tone, onClick }]} signal="danger" />
// Props are listed above.
export function FormRow({ title, detail, status, statusLabel, statusDetail, signal = '', badge = null, date, dateLabel, action = null, menu = [], children }) {
  const { t } = useLanguage()
  const word = statusLabel || (status ? t(`episodeForms.status.${status}`) : '')
  const danger = signal === 'danger' || status === FORM_STATUS.OVERDUE
  // In the forms tab the row's action is in its «⋯» and a click on the row does it (owner, 8/11/2026).
  const { flat } = useFormsTab()
  const items = flat && action ? [{ id: 'action', label: action.label, onClick: action.onClick, disabled: action.disabled }, ...menu] : menu
  const rowProps =
    flat && action && !action.disabled
      ? {
          className: `episode-form-row is-clickable${danger ? ' is-signal' : ''}`,
          tabIndex: 0,
          onClick: event => !event.target.closest?.('button,a,[role="menu"]') && action.onClick(),
          onKeyDown: event => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              action.onClick()
            }
          },
        }
      : { className: `episode-form-row${danger ? ' is-signal' : ''}` }
  return (
    <li {...rowProps}>
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
        {statusDetail && statusDetail !== word && <small>{statusDetail}</small>}
      </div>
      <div className="episode-form-date">
        {date ? <b>{date}</b> : <span className="episode-form-none">—</span>}
        {dateLabel && <small>{dateLabel}</small>}
      </div>
      <div className="episode-form-action">
        {action && !flat && (
          <Button variant={action.primary ? 'primary' : 'secondary'} onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </Button>
        )}
        {items.filter(Boolean).length > 0 && <OverflowMenu label={t('episodeForms.rowActions')} items={items.filter(Boolean)} />}
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
