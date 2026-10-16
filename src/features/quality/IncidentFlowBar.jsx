import { Check, Minus } from 'lucide-react'

// The flow of an incident above its tabs: reported → assessment → CAPA →
// effectiveness → closed (qualityRecordRules.incidentFlow). A step opens the
// tab where it is done.
const STEPS = {
  reported: { label: ['Αναφορά', 'Reported'], tab: 'details' },
  assessment: { label: ['Αξιολόγηση', 'Assessment'], tab: 'assessment' },
  capa: { label: ['Διορθωτική ενέργεια', 'CAPA'], tab: 'links' },
  effectiveness: { label: ['Αποτελεσματικότητα', 'Effectiveness'], tab: 'links' },
  closed: { label: ['Κλείσιμο', 'Closed'], tab: 'assessment' },
}

export function IncidentFlowBar({ steps = [], language = 'el', onSelect }) {
  const en = language === 'en'
  return (
    <ol className="quality-flow" aria-label={en ? 'Incident flow' : 'Ροή συμβάντος'}>
      {steps.map(({ id, status }, index) => (
        <li key={id} className={`is-${status}`}>
          <button type="button" onClick={() => onSelect?.(STEPS[id].tab)} aria-current={status === 'current' ? 'step' : undefined}>
            <span className="quality-flow-mark">{status === 'done' ? <Check size={12} /> : status === 'skipped' ? <Minus size={12} /> : index + 1}</span>
            <span>{STEPS[id].label[en ? 1 : 0]}</span>
            {status === 'skipped' && <small>{en ? 'not needed' : 'δεν χρειάστηκε'}</small>}
          </button>
        </li>
      ))}
    </ol>
  )
}
