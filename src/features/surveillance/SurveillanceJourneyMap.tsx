import { Check, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler } from './surveillanceTypes'
import type { ReactNode } from 'react'


export function buildSurveillanceJourneyStages(record: AnyRecord, t: (key: string) => string, fmtDate: (value: unknown) => string, questionnaire: AnyRecord | null = null) {
  const samples = record?.samples || [],
    validatedSamples = samples.filter((sample: AnyRecord) => Boolean(sample.organism))
  const reassessments = record?.reassessments || [],
    therapy = record?.therapy || [],
    devices = record?.devices || []
  const isolationDecided =
    Boolean(record?.isolation) || record?.isolationDecision?.required === false
  const assessed = Boolean(record?.assessment)
  const unlocked: Record<string, boolean> = {
    assessment: true,
    devices: true,
    samples: true,
    isolation: true,
    therapy: true,
    hai: true,
    reassessment: true,
    outcome: true,
  }
  const built = [
    {
      id: 'assessment',
      label: t('clinicalRecords.stageAssessment'),
      status: record?.assessment ? 'complete' : 'pending',
      meta: record?.assessment ? fmtDate(record.assessment.date || record.startedAt) : t('pending'),
    },
    {
      id: 'devices',
      label: t('clinicalRecords.stageDevices'),
      status: devices.length ? 'complete' : 'pending',
      meta: devices.length ? String(devices.length) : t('clinicalRecords.notStarted'),
    },
    {
      id: 'samples',
      label: t('clinicalRecords.stageSamples'),
      status: samples.length ? (validatedSamples.length ? 'complete' : 'waiting') : 'pending',
      meta: samples.length
        ? validatedSamples.length
          ? `${samples.length} · ${validatedSamples.length} ${t('clinicalRecords.validated').toLowerCase()}`
          : `${samples.length} · ${t('waitingForLaboratory')}`
        : t('clinicalRecords.notStarted'),
    },
    {
      id: 'hai',
      label: t('clinicalRecords.stageHai'),
      status: record?.haiClassification ? 'complete' : 'pending',
      meta: record?.resistance || t(record?.haiClassification?.status || 'pending'),
    },
    {
      id: 'isolation',
      label: t('isolation'),
      status: isolationDecided ? 'complete' : 'pending',
      meta: record?.isolation
        ? t(record.isolation.status)
        : isolationDecided
          ? t('notRequired')
          : t('clinicalRecords.notStarted'),
    },
    {
      id: 'therapy',
      label: t('clinicalRecords.stageTherapy'),
      status: therapy.length ? 'complete' : 'pending',
      meta: therapy[0]?.antimicrobial || t('clinicalRecords.notStarted'),
    },
    {
      id: 'reassessment',
      label: t('reassessment'),
      status: reassessments.length ? 'complete' : assessed ? 'due' : 'pending',
      meta: reassessments[0]
        ? fmtDate(reassessments[0].date)
        : record?.reviewDue
          ? fmtDate(record.reviewDue)
          : t('notScheduled'),
    },
    {
      id: 'outcome',
      label: t('outcome'),
      status: record?.outcome ? 'complete' : 'pending',
      meta: record?.outcome ? t(record.outcome.status) : t('pending'),
    },
    // The epidemiological questionnaire of the episode, a step of its own right after the samples (owner, 8/11/2026).
    ...(questionnaire
      ? [{
          id: 'questionnaire',
          label: t('epiQuestionnaire.sectionTitle'),
          status: questionnaire.done ? 'complete' : 'pending',
          meta: questionnaire.done ? t('episodeForms.status.done') : t('epiQuestionnaire.notStarted'),
        }]
      : []),
  ]
  // The order of the work (owner, 8/11/2026): samples, questionnaire, assessment, HAI, devices, isolation, therapy,
  // reassessment, outcome.
  const order = ['samples', 'questionnaire', 'assessment', 'hai', 'devices', 'isolation', 'therapy', 'reassessment', 'outcome']
  return order
    .map(id => built.find(stage => stage.id === id))
    .filter(Boolean)
    .map(stage => ({ ...stage, locked: !unlocked[stage.id] && stage.id !== 'questionnaire' }))
}

interface SurveillanceJourneyMapProps {
  record: AnyRecord
  t: (key: string) => string
  fmtDate: (value: unknown) => string
  activeStage: string
  onSelect: Handler
  extraStages?: AnyRecord[]
  questionnaire?: AnyRecord | null
  children?: ReactNode
}
// The surveillance sheet (owner, 8/11/2026, design 2): every section on one page, one under the other, and on the
// left a small index of the steps (numbered, ✓ when done, the progress under them); a click on a step scrolls to it.
// extraStages: the protocols started on the episode (N3), right after the clinical assessment.
export function SurveillanceJourneyMap({ record, t, fmtDate, activeStage, onSelect, extraStages = [], questionnaire = null, children = null }: SurveillanceJourneyMapProps) {
  const { language } = useLanguage()
  const baseStages = buildSurveillanceJourneyStages(record, t, fmtDate, questionnaire)
  const at = baseStages.findIndex(stage => stage.id === 'assessment') + 1
  const stages = extraStages.length ? [...baseStages.slice(0, at), ...extraStages, ...baseStages.slice(at)] : baseStages
  const done = baseStages.filter(stage => stage.status === 'complete').length
  const atIndex = stages.findIndex(stage => stage.id === activeStage)
  const go = (id: string) => {
    onSelect?.(id)
    document.getElementById(`sheet-${id}-${record.id}`)?.scrollIntoView?.({ block: 'nearest' })
  }
  return (
    <div className="sheet-layout">
      <nav className="sheet-index" aria-label={language === 'el' ? 'Βήματα επιτήρησης' : 'Surveillance steps'}>
        {stages.map((stage, index) => <EpisodeStep key={stage.id} number={index + 1} stage={stage} active={activeStage === stage.id} onSelect={go} />)}
        <div className="sheet-progress">
          <span>{language === 'el' ? `${done} από ${baseStages.length} συμπληρωμένα` : `${done} of ${baseStages.length} completed`}</span>
          <i><b style={{ width: `${Math.round((done / Math.max(1, baseStages.length)) * 100)}%` }} /></i>
        </div>
      </nav>
      <div className="sheet-body">
        {children}
        {/* One section at a time, no long scroll (owner, 8/11/2026): «Previous» / «Next» under it, or the index. */}
        <div className="sheet-pager">
          {atIndex > 0 && <button type="button" className="sheet-pager-button" onClick={() => go(stages[atIndex - 1].id)}>← {stages[atIndex - 1].label}</button>}
          {atIndex >= 0 && atIndex < stages.length - 1 && <button type="button" className="sheet-pager-button is-next" onClick={() => go(stages[atIndex + 1].id)}>{stages[atIndex + 1].label} →</button>}
        </div>
      </div>
    </div>
  )
}

interface SurveillanceJourneyGuidanceProps {
  record: AnyRecord
  t: (key: string) => string
  canAssess: boolean
  canLab: boolean
  canIsolation: boolean
  canTherapy: boolean
  canReassess: boolean
  onSelect: Handler
  extraCues?: AnyRecord[]
}
export function SurveillanceJourneyGuidance({
  record,
  t,
  canAssess,
  canLab,
  canIsolation,
  canTherapy,
  canReassess,
  onSelect,
  extraCues = [],
}: SurveillanceJourneyGuidanceProps) {
  // A short list: the first three, the rest behind «and N more».
  const cues = [...extraCues],
    samples = record?.samples || [],
    pendingSamples = samples.filter((sample: AnyRecord) => !sample.organism)
  if (canAssess && !record?.assessment)
    cues.push({
      id: 'assessment',
      tone: 'warning',
      title: t('clinicalRecords.initialAssessmentRequired'),
    })
  if (canLab && pendingSamples.length)
    cues.push({ id: 'samples', tone: 'info', title: t('clinicalRecords.pendingLaboratoryResult') })
  if (canIsolation && !record?.isolation && !record?.isolationDecision)
    cues.push({ id: 'isolation', tone: 'neutral', title: t('isolation') })
  if (canTherapy && !record?.therapy?.length)
    cues.push({ id: 'therapy', tone: 'neutral', title: t('therapy') })
  if (canAssess && record?.assessment && !record?.haiClassification?.criteriaMet && (record?.haiClassification || samples.some((sample: AnyRecord) => Boolean(sample.organism))))
    cues.push({ id: 'hai', tone: 'warning', title: t('clinicalRecords.haiCriteriaNeedReview') })
  if (canReassess && !record?.reassessments?.length)
    cues.push({ id: 'reassessment', tone: 'due', title: t('clinicalRecords.reassessmentRequired') })
  if (canReassess && record?.reviewDue)
    cues.push({ id: 'reassessment', tone: 'neutral', title: t('nextReview') })
  if (!cues.length)
    return (
      <div className="journey-guidance clear">
        <CheckCircle2 size={16} />
        <span>{t('clinicalRecords.noImmediateIntervention')}</span>
      </div>
    )
  // One line on top of the sheet (owner, 8/11/2026): what needs attention, each item a link to its section.
  return (
    <div className="sheet-attention" role="note">
      <strong>{t('clinicalRecords.attentionNeeded')}:</strong>
      {cues.map((cue, index) => (
        <button key={`${cue.id}-${index}`} type="button" className={`sheet-attention-item tone-${cue.tone === 'danger' ? 'danger' : cue.tone === 'warning' || cue.tone === 'due' ? 'warning' : 'info'}`} onClick={onSelect ? () => onSelect(cue.id) : undefined}>
          {cue.title}
        </button>
      ))}
    </div>
  )
}

// Stages that are steps of the Demo guide's CLABSI scenario (outlined while it runs).
const DEMO_STEP_STAGES = new Set(['hai', 'reassessment'])
interface EpisodeStepProps {
  number: number
  stage: AnyRecord
  active: boolean
  onSelect: Handler
}
function EpisodeStep({ number, stage, active, onSelect }: EpisodeStepProps) {
  const tone = stage.status === 'complete' ? 'done' : stage.status === 'due' || stage.status === 'waiting' ? 'due' : 'pending'
  return (
    <button
      type="button"
      className={`sheet-index-step tone-${tone}${active ? ' is-active' : ''}${stage.protocol ? ' is-protocol' : ''}`}
      disabled={stage.locked}
      aria-current={active ? 'step' : undefined}
      title={[stage.label, stage.meta].filter(Boolean).join(' · ')}
      data-demo-step={
        DEMO_STEP_STAGES.has(stage.id) ? `clabsi_classification:${stage.id}` : undefined
      }
      onClick={() => onSelect?.(stage.id)}
    >
      {/* Numbered steps, ✓ once the step holds data (owner's choice «Α», 8/11/2026). */}
      <i className="episode-step-number" aria-hidden="true">{tone === 'done' && !active ? <Check size={13} strokeWidth={3} /> : number}</i>
      <span>{stage.label}</span>
    </button>
  )
}
