// «Επανεκτίμηση αγωγής 48–72 ωρών» inside the Antimicrobial therapy section
// (approved design n3-3): window, microbiology of the episode, decision, reasons,
// reviewer and time. Records the physician's decision; it suggests no drug.
import { useState } from 'react'
import { Check, CirclePlay, CircleStop, Microscope, Pill, RefreshCw, TrendingDown } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { ChoiceChips } from '../../../design-system/ChoiceChips'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { REVIEW_DECISIONS, REVIEW_REASONS, reviewTone } from './therapyReview'
import { dayTime, fill } from './ProtocolViews'

const DECISION_ICONS = { continue: CirclePlay, deescalate: TrendingDown, iv_to_oral: Pill, stop: CircleStop }
const r = key => `sepsis.review.${key}`

export function TherapyReviewCard({ record, therapy, window, t, actorName, canReview, onSave }) {
  const [editing, setEditing] = useState(false)
  const [decision, setDecision] = useState('')
  const [reasons, setReasons] = useState([])
  const [newRegimen, setNewRegimen] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const latest = window.latest
  const formOpen = canReview && (editing || ['due', 'overdue'].includes(window.state))
  const stateLabel = fill(t(r(`state_${window.state}`)), { hours: window.reviewedHours ?? window.hours })
  const organisms = (record?.samples || []).filter(sample => sample.organism)
  const toggle = value => setReasons(current => (current.includes(value) ? current.filter(item => item !== value) : [...current, value]))
  async function save() {
    if (!decision || !reasons.length) {
      setError(t(r('required')))
      return
    }
    setBusy(true)
    try {
      if ((await onSave({ decision, reasons, newRegimen: newRegimen.trim(), note: note.trim() })) === false) return
      setEditing(false)
      setDecision('')
      setReasons([])
      setNewRegimen('')
      setNote('')
      setError('')
    } finally {
      setBusy(false)
    }
  }
  const tone = window.state === 'overdue' ? ' danger' : ['reviewed', 'reviewedLate'].includes(window.state) && !formOpen ? ' done' : ''
  return (
    <section className={`sp-card sp-review${tone}`} aria-label={`${t(r('title'))} · ${therapy.antimicrobial}`}>
      <div className="sp-row">
        <span className={`sp-ico ${window.state === 'overdue' ? 'r' : window.state === 'due' ? 'a' : 'g'}`}>
          <RefreshCw size={15} />
        </span>
        <div>
          <strong>
            {t(r('title'))} · {therapy.antimicrobial}
          </strong>
          <div className="sp-muted sp-small">{t(r('subtitle'))}</div>
        </div>
        <span className="sp-grow" />
        <StatusBadge tone={reviewTone(window.state)}>{stateLabel}</StatusBadge>
      </div>
      <div className="sp-window">
        <div>
          <span className="sp-muted">{t(r('start'))}</span>
          <b>{dayTime(window.start)}</b>
        </div>
        <div className={window.state === 'due' ? 'now' : window.state === 'overdue' ? 'late' : ''}>
          <span className="sp-muted">{t(r('window'))}</span>
          <b>
            {dayTime(window.opensAt)} – {dayTime(window.dueBy)}
          </b>
        </div>
        <div>
          <span className="sp-muted">{t(r('reviewed'))}</span>
          <b>{latest ? `${dayTime(latest.reviewedAt)} ✓` : t(r('notYet'))}</b>
        </div>
      </div>
      <div className={`sp-callout${organisms.length ? ' ok' : ''}`}>
        <Microscope size={16} />
        <div>
          <strong>{t(r('microbiology'))}:</strong>{' '}
          {organisms.length
            ? organisms.map(sample => [sample.id, sample.organism, sample.resistance].filter(Boolean).join(' · ')).join(' — ')
            : t(r('noMicrobiology'))}
        </div>
      </div>
      {latest && !formOpen && (
        <div className="sp-stack">
          <div>
            <span className="sp-eyebrow">{t(r('lastDecision'))}</span>
            <p>
              <strong>{t(r(`decision_${latest.decision}`))}</strong> · {latest.reasons.map(reason => t(r(`reason_${reason}`))).join(', ')}
              {latest.newRegimen ? ` · ${latest.newRegimen}` : ''}
            </p>
            {latest.note && <p className="sp-muted">{latest.note}</p>}
          </div>
          <div className="sp-row">
            <span className="sp-muted sp-small">{fill(t(r('reviewer')), { name: [latest.reviewerName, latest.reviewerJobTitle].filter(Boolean).join(', ') || '—', time: dayTime(latest.reviewedAt) })}</span>
            <span className="sp-grow" />
            {canReview && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {t(r('recordAgain'))}
              </Button>
            )}
          </div>
        </div>
      )}
      {formOpen && (
        <div className="sp-stack">
          <div>
            <span className="sp-eyebrow">{t(r('decision'))}</span>
            <div className="sp-options" role="radiogroup" aria-label={t(r('decision'))}>
              {REVIEW_DECISIONS.map(value => {
                const Icon = DECISION_ICONS[value]
                return (
                  <button type="button" key={value} role="radio" aria-checked={decision === value} className={`sp-option${decision === value ? ' on' : ''}`} onClick={() => setDecision(value)}>
                    <strong>
                      <span className="sp-radio" />
                      <Icon size={15} />
                      {t(r(`decision_${value}`))}
                    </strong>
                    {t(r(`decision_${value}_hint`))}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="sp-form-grid">
            <ChoiceChips className="span2" label={`${t(r('reasons'))} *`} options={REVIEW_REASONS.map(value => ({ value, label: t(r(`reason_${value}`)) }))} selected={reasons} onToggle={toggle} />
            {['deescalate', 'iv_to_oral'].includes(decision) && (
              <label className="field span2">
                <span className="field-label lo-field-label">{t(r('newRegimen'))}</span>
                <input type="text" value={newRegimen} onChange={event => setNewRegimen(event.target.value)} />
                <span className="field-hint">{t(r('newRegimenHint'))}</span>
              </label>
            )}
            <label className="field span2">
              <span className="field-label lo-field-label">{t(r('note'))}</span>
              <textarea rows={3} value={note} onChange={event => setNote(event.target.value)} />
            </label>
          </div>
          {error && <div className="entry-detail-note">{error}</div>}
          <div className="sp-row">
            <span className="sp-muted sp-small">
              {fill(t(r('reviewer')), { name: actorName || '—', time: dayTime(new Date()) })} · {t(r('decisionSupport'))}
            </span>
            <span className="sp-grow" />
            {editing && (
              <Button variant="secondary" onClick={() => setEditing(false)}>
                {t(r('cancel'))}
              </Button>
            )}
            <Button disabled={busy} onClick={save}>
              <Check size={16} />
              {t(r('save'))}
            </Button>
          </div>
        </div>
      )}
      {!canReview && !latest && <p className="sp-muted sp-small">{t(r('noRights'))}</p>}
    </section>
  )
}
