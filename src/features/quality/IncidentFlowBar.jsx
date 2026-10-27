import { ArrowRight, Check, CheckSquare2, ChevronRight, Minus } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Meter } from '../../design-system/MiniCharts'
import { formatDay } from '../../core/i18n/formatDay'
import { subActionProgress } from './qualityDeviations'
import { EFFECTIVENESS, qualityCode, qualityStatusTone, vocabularyLabel } from './qualityVocabulary'

// The flow of an incident beside its details: reported → assessment → CAPA →
// effectiveness → closed (qualityRecordRules.incidentFlow). A step opens the
// tab where it is done; the button under the steps does the next one.
const STEPS = {
  reported: { label: ['Αναφορά', 'Reported'], tab: 'details' },
  assessment: { label: ['Αξιολόγηση', 'Assessment'], tab: 'assessment' },
  capa: { label: ['Διορθωτική ενέργεια', 'CAPA'], tab: 'links' },
  effectiveness: { label: ['Αποτελεσματικότητα', 'Effectiveness'], tab: 'links' },
  closed: { label: ['Κλείσιμο', 'Closed'], tab: 'assessment' },
}

const isDone = capa => ['closed', 'completed', 'cancelled'].includes(capa.status)

// What a step says under its name.
function stepNote(id, status, { record, capas, language, t }) {
  const en = language === 'en'
  if (status === 'skipped') return en ? 'Not needed' : 'Δεν χρειάστηκε'
  if (id === 'reported') return [formatDay(record.date, language), record.anonymous ? (en ? 'Anonymous' : 'Ανώνυμα') : record.reportedBy].filter(Boolean).join(' · ')
  if (id === 'assessment') return status === 'done' ? [t(record.severity), record.sentinel ? 'Sentinel' : ''].filter(Boolean).join(' · ') : en ? 'Severity, harm, root cause' : 'Σοβαρότητα, βλάβη, βασική αιτία'
  if (id === 'capa') return capas.length ? (en ? `${capas.filter(isDone).length}/${capas.length} completed` : `${capas.filter(isDone).length}/${capas.length} ολοκληρώθηκαν`) : record.sentinel ? (en ? 'Root cause analysis required' : 'Απαιτείται ανάλυση ριζικής αιτίας') : (en ? 'If the assessment calls for one' : 'Αν η αξιολόγηση το ζητά')
  if (id === 'effectiveness') return status === 'done' ? (en ? 'Effective' : 'Αποτελεσματική') : capas.length ? vocabularyLabel(EFFECTIVENESS, capas[0].effectivenessStatus || 'pending', language) : ''
  if (id === 'closed') return status === 'done' ? (en ? 'The incident is closed' : 'Το συμβάν έκλεισε') : ''
  return ''
}

// The next step for whoever manages Quality: its label and what it opens.
export function nextIncidentStep(steps, { record, capas, en }) {
  const current = steps.find(step => step.status === 'current')?.id
  if (!current || record.status === 'closed') return null
  if (current === 'assessment') return { id: 'assess', label: en ? 'Assess the incident' : 'Αξιολόγηση συμβάντος' }
  if (current === 'capa') return { id: 'capa', label: record.sentinel ? (en ? 'Open the root cause analysis' : 'Άνοιγμα ανάλυσης ριζικής αιτίας') : (en ? 'New corrective action' : 'Νέα διορθωτική ενέργεια'), hint: record.sentinel ? '' : (en ? 'Or close the incident if none is needed.' : 'Ή κλείστε το συμβάν, αν δεν χρειάζεται.') }
  if (current === 'effectiveness') return { id: 'openCapa', label: en ? 'Open the corrective action' : 'Άνοιγμα διορθωτικής ενέργειας', capa: capas.find(capa => !isDone(capa)) || capas[0] }
  return { id: 'close', label: en ? 'Close the incident' : 'Κλείσιμο συμβάντος' }
}

export function IncidentFlowPanel({ steps = [], record, capas = [], language = 'el', t, activeTab, canAct = false, onSelect, onStep, onOpenCapa }) {
  const en = language === 'en'
  const next = canAct ? nextIncidentStep(steps, { record, capas, en }) : null
  return (
    <aside className="quality-record-aside">
      <section className="risk-panel quality-panel">
        <header><h3>{en ? 'Flow' : 'Πορεία'}</h3><small>{en ? 'ISO 9001 §10.2' : 'ISO 9001 §10.2'}</small></header>
        <ol className="quality-flow" aria-label={en ? 'Incident flow' : 'Ροή συμβάντος'}>
          {steps.map(({ id, status }, index) => (
            <li key={id} className={`is-${status}${STEPS[id].tab === activeTab && status === 'current' ? ' is-open' : ''}`}>
              <button type="button" onClick={() => onSelect?.(STEPS[id].tab)} aria-current={status === 'current' ? 'step' : undefined}>
                <span className="quality-flow-mark">{status === 'done' ? <Check size={12} /> : status === 'skipped' ? <Minus size={12} /> : index + 1}</span>
                <span className="quality-flow-text"><strong>{STEPS[id].label[en ? 1 : 0]}</strong><small>{stepNote(id, status, { record, capas, language, t })}</small></span>
              </button>
            </li>
          ))}
        </ol>
        {next && <div className="quality-next-step">
          <Button variant="primary" onClick={() => onStep(next)}><ArrowRight size={15} />{next.label}</Button>
          {next.hint && <small>{next.hint}</small>}
        </div>}
      </section>
      {capas.length > 0 && <section className="risk-panel quality-panel">
        <header><h3>{en ? 'Corrective actions' : 'Διορθωτικές ενέργειες'}{capas.length > 0 && <span className="quality-panel-count">{capas.length}</span>}</h3></header>
        {capas.length ? <ul className="quality-capa-cards">{capas.map(capa => {
          const progress = subActionProgress(capa.subActions || [])
          return <li key={capa.id}><button type="button" onClick={() => onOpenCapa(capa)}>
            <CheckSquare2 size={15} aria-hidden="true" />
            <span><strong>{qualityCode(capa, language)}</strong><small>{en ? capa.titleEn || capa.title : capa.title}</small>
              {progress.total > 0 && <Meter value={progress.done * 100 / progress.total} tone={progress.done === progress.total ? 'success' : 'neutral'} label={en ? `${progress.done}/${progress.total} steps` : `${progress.done}/${progress.total} βήματα`} />}
            </span>
            <StatusBadge tone={qualityStatusTone(capa.status)}>{t(capa.status)}</StatusBadge><ChevronRight size={15} aria-hidden="true" />
          </button></li>
        })}</ul> : null}
      </section>}
    </aside>
  )
}
