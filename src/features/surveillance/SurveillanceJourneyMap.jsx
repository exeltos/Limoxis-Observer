import {
  Activity,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  HeartPulse,
  Microscope,
  RefreshCcw,
  ShieldCheck,
  Syringe,
  Stethoscope,
} from 'lucide-react'
import { AttentionList } from '../../design-system/AttentionList'
import { useLanguage } from '../../core/i18n/LanguageContext'

const icons = {
  assessment: ShieldCheck,
  devices: Stethoscope,
  samples: Microscope,
  isolation: BedDouble,
  therapy: Syringe,
  hai: AlertTriangle,
  reassessment: RefreshCcw,
  outcome: Activity,
}

export function buildSurveillanceJourneyStages(record, t, fmtDate) {
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
  return [
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
  ].map(stage => ({ ...stage, locked: !unlocked[stage.id] }))
}

// extraStages: the sections of the protocols started on the episode (N3), shown
// after the clinical assessment only once a protocol exists.
export function SurveillanceJourneyMap({ record, t, fmtDate, activeStage, onSelect, extraStages = [] }) {
  const { language } = useLanguage()
  const baseStages = buildSurveillanceJourneyStages(record, t, fmtDate)
  const stages = extraStages.length ? [baseStages[0], ...extraStages, ...baseStages.slice(1)] : baseStages
  return (
    <div
      className="journey-map strict-journey-map episode-workspace-map"
      aria-label={t('surveillanceJourney')}
    >
      <nav
        className={`episode-section-tabs${extraStages.length ? ' has-protocol-tabs' : ''}`}
        aria-label={language === 'el' ? 'Ενότητες επεισοδίου' : 'Episode sections'}
      >
        {stages.map(stage => (
          <EpisodeTab
            key={stage.id}
            stage={stage}
            active={activeStage === stage.id}
            onSelect={onSelect}
          />
        ))}
      </nav>
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
function EpisodeTab({ stage, active, onSelect }) {
  const Icon = stage.protocol ? HeartPulse : icons[stage.id] || Activity
  return (
    <button
      type="button"
      className={`episode-section-tab ${active ? 'active' : ''} ${stage.status === 'complete' ? 'complete' : ''} ${stage.locked ? 'locked' : ''} ${stage.protocol ? 'protocol-tab' : ''}`.trim()}
      disabled={stage.locked}
      title={[stage.label, stage.meta].filter(Boolean).join(' · ')}
      aria-current={active ? 'page' : undefined}
      data-demo-step={
        DEMO_STEP_STAGES.has(stage.id) ? `clabsi_classification:${stage.id}` : undefined
      }
      onClick={() => onSelect?.(stage.id)}
    >
      <Icon size={16} />
      <span>
        <strong>{stage.label}</strong>
        <small>{stage.meta}</small>
      </span>
      {stage.status === 'complete' && <CheckCircle2 className="episode-tab-check" size={14} />}
    </button>
  )
}
