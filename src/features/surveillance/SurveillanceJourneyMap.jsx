import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { AttentionList } from '../../design-system/AttentionList'
import { useLanguage } from '../../core/i18n/LanguageContext'


export function buildSurveillanceJourneyStages(record, t, fmtDate, questionnaire = null) {
  const samples = record?.samples || [],
    validatedSamples = samples.filter(sample => Boolean(sample.organism))
  const reassessments = record?.reassessments || [],
    therapy = record?.therapy || [],
    devices = record?.devices || []
  const isolationDecided =
    Boolean(record?.isolation) || record?.isolationDecision?.required === false
  const assessed = Boolean(record?.assessment)
  const unlocked = {
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

// The episode as one list of steps (owner, 8/11/2026): a coloured dot, the step, a short line on where it stands; a
// click opens the step right under its row (children) and a second click closes it. extraStages: the protocols
// started on the episode (N3), right after the clinical assessment.
export function SurveillanceJourneyMap({ record, t, fmtDate, activeStage, onSelect, extraStages = [], questionnaire = null, children = null }) {
  const { language } = useLanguage()
  const baseStages = buildSurveillanceJourneyStages(record, t, fmtDate, questionnaire)
  const at = baseStages.findIndex(stage => stage.id === 'assessment') + 1
  const stages = extraStages.length ? [...baseStages.slice(0, at), ...extraStages, ...baseStages.slice(at)] : baseStages
  return (
    <div className="episode-steps" aria-label={language === 'el' ? 'Βήματα επιτήρησης' : 'Surveillance steps'}>
      {stages.map(stage => {
        const open = activeStage === stage.id
        return (
          <div key={stage.id} className={`episode-step${open ? ' is-open' : ''}`}>
            <EpisodeStep stage={stage} active={open} onSelect={id => onSelect?.(open ? '' : id)} />
            {open && <div className="episode-step-body">{children}</div>}
          </div>
        )
      })}
    </div>
  )
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
}) {
  // A short list: the first three, the rest behind «and N more».
  const cues = [...extraCues],
    samples = record?.samples || [],
    pendingSamples = samples.filter(sample => !sample.organism)
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
  if (canAssess && record?.assessment && !record?.haiClassification?.criteriaMet && (record?.haiClassification || samples.some(sample => Boolean(sample.organism))))
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
  return (
    <AttentionList
      className="journey-attention"
      title={t('clinicalRecords.attentionNeeded')}
      limit={3}
      moreLabel={count => String(t('clinicalRecords.attentionMore')).replace('{count}', String(count))}
      items={cues.map(cue => ({ id: cue.id, text: cue.title, tone: cue.tone === 'danger' ? 'danger' : cue.tone === 'warning' || cue.tone === 'due' ? 'warning' : 'info', onClick: onSelect ? () => onSelect(cue.id) : null }))}
    />
  )
}

// Stages that are steps of the Demo guide's CLABSI scenario (outlined while it runs).
const DEMO_STEP_STAGES = new Set(['hai', 'reassessment'])
function EpisodeStep({ stage, active, onSelect }) {
  const Chevron = active ? ChevronDown : ChevronRight
  const tone = stage.status === 'complete' ? 'done' : stage.status === 'due' || stage.status === 'waiting' ? 'due' : 'pending'
  return (
    <button
      type="button"
      className={`episode-step-row tone-${tone}${stage.protocol ? ' is-protocol' : ''}`}
      disabled={stage.locked}
      aria-expanded={active}
      data-demo-step={
        DEMO_STEP_STAGES.has(stage.id) ? `clabsi_classification:${stage.id}` : undefined
      }
      onClick={() => onSelect?.(stage.id)}
    >
      <i className="episode-step-dot" aria-hidden="true" />
      <strong><Chevron size={14} aria-hidden="true" />{stage.label}</strong>
      <span className="episode-step-meta">{stage.meta}</span>
    </button>
  )
}
