import { useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, ClipboardList, Microscope, RefreshCcw, ShieldCheck } from 'lucide-react'
import { Button } from '../../design-system/Button'

import { translate } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { SurveillanceJourneyGuidance, SurveillanceJourneyMap } from './SurveillanceJourneyMap'
import { Detail } from './ClinicalAdmissions'
import { StageTable, StateBadge } from './ClinicalJourneyParts'
import { clinicalTerm } from './clinicalRecordLabels'
import { AssessmentDialog, ReassessmentDialog, OutcomeDialog, ReasonDialog } from './ClinicalRecordDialogs'
import { InlineDialogContext } from '../../design-system/ObserverDialog'
import { SheetEditingContext, StagePanel, TagList, CompletedReport } from './ClinicalRecordViews'
import { binMemoryRow } from '../../core/recycleBin/recycleBinService'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import { useTenant } from '../../core/tenant/TenantContext'
import { EPI_ANSWERS, EPI_QUESTIONS, EPI_SOURCE, answerOf, epiText, isCoreComplete } from './epiQuestionnaire/epiQuestionnaireModel'
import { canWriteEpi } from './epiQuestionnaire/epiQuestionnaireText'
import { loadEpiQuestionnaires, loadEpiSettings, saveEpiCoreAnswers } from './epiQuestionnaire/epiQuestionnaireService'
import { ModeSwitch } from '../../design-system/ModeSwitch'

import { useAuditActor } from '../../core/audit/useAuditActor'
import { ProtocolPanel } from './protocols/ProtocolViews'
import { protocolCues, protocolStages, useEpisodeProtocols } from './protocols/useEpisodeProtocols'
import { changeRecognitionTime, finishProtocolRun, recordProtocolStep, removeDemoProtocolRun, setProtocolWeight } from './protocols/protocolService'
import { JourneyWindows } from './ClinicalJourneyWindows'
import { JourneyCareStages } from './ClinicalJourneyCareStages'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler } from './surveillanceTypes'

// Surveillance episode journey: stages, clinical entries and their detail view.

// The questions of the initial screening of the clinical assessment (the same as its form).
const SCREENING_QUESTIONS = [
  ['recentSurgery', 'recentSurgery'],
  ['currentAntibiotics', 'currentOrRecentAntimicrobialTherapy'],
  ['recentHospitalization', 'recentHospitalization'],
  ['transferFromFacility', 'transferFromAnotherHealthcareFacility'],
  ['knownMdro', 'knownMultidrugResistantOrganismMdroHistory'],
  ['immunosuppression', 'immunosuppression'],
  ['recentProcedure', 'recentInvasiveProcedure'],
]
interface CanonicalJourneyProps {
  record: AnyRecord
  repository: AnyRecord
  libraries?: AnyRecord
  organizationId: string
  isDemo: boolean
  onLibraryAdded: Handler
  onReload: Handler
  t: (key: string) => string
  language: string
  fmtDate: (value: unknown) => string
  fmtDateTime: (value: unknown) => string
  permissions: AnyRecord
  deviceBundles?: AnyRecord | null
  initialStage?: string | null
  startProtocolRequest?: AnyRecord | null
  onProtocolRequestHandled: Handler
  deleteItem?: Handler | null
  patient?: AnyRecord | null
  admission?: AnyRecord | null
  askSample?: boolean
  onSampleAsked: Handler
  editing?: boolean
  actionRequest?: AnyRecord | null
  onActionHandled: Handler
}
export function CanonicalJourney({
  record,
  repository,
  libraries = {},
  organizationId,
  isDemo,
  onLibraryAdded,
  onReload,
  t,
  language,
  fmtDate,
  fmtDateTime,
  permissions,
  deviceBundles = null,
  initialStage = null,
  startProtocolRequest = null,
  onProtocolRequestHandled,
  deleteItem = null,
  patient = null,
  admission = null,
  askSample = false,
  onSampleAsked,
  editing = false,
  actionRequest = null,
  onActionHandled,
}: CanonicalJourneyProps) {
  const { notify } = useFeedback()
  const { role } = useTenant()
  const copyText = (key: string) => translate(`copy.clinicalRecordCopy.${key}`, language === 'el' ? 'el' : 'en')
  interface SheetDetailProps {
    label: string
    value: AnyRecord
  }
  // Read-only value of the sheet, laid out like the form's field; an empty one says so (owner, 8/11/2026).
  const SheetDetail = ({ label, value }: SheetDetailProps) => (
    <Detail label={label} value={value || <em className="sheet-empty">{copyText('notFilled')}</em>} />
  )
  const actor = useAuditActor()
  // N3: protocols started on the episode and the 48–72 h antimicrobial reviews.
  const protocols = useEpisodeProtocols(record, { organizationId, isDemo })
  const [protocolPreset, setProtocolPreset] = useState<AnyRecord | null>(null)
  const [stage, setStage] = useState(initialStage || 'samples')
  useEffect(() => {
    if (initialStage) setStage(initialStage)
  }, [initialStage])
  // An action of the sheet's «⋯» (new sample, device, …): its step and its window.
  useEffect(() => {
    if (!actionRequest?.nonce) return
    setStage(actionRequest.stage)
    setDialog(actionRequest.dialog)
    onActionHandled?.()
  }, [actionRequest, onActionHandled])
  useEffect(() => {
    if (!askSample) return
    setStage('samples')
    setDialog('sample')
    onSampleAsked?.()
  }, [askSample, onSampleAsked])
  // The epidemiological questionnaire of the episode, a step of its own (owner, 8/11/2026).
  const epiKey = isDemo ? record.id : record.recordId || record.id
  const [epi, setEpi] = useState({ row: null, settings: [], ready: false, nonce: 0 })
  useEffect(() => {
    let alive = true
    Promise.all([
      loadEpiQuestionnaires(organizationId, [epiKey], { isDemo }),
      loadEpiSettings(organizationId, { isDemo }).catch(() => []),
    ])
      .then(([rows, settings]) => alive && setEpi(current => ({ ...current, row: rows?.[String(epiKey)] || null, settings, ready: true })))
      .catch(() => alive && setEpi(current => ({ ...current, ready: false })))
    return () => {
      alive = false
    }
  }, [organizationId, isDemo, epiKey, epi.nonce])
  const epiDone = Boolean(epi.row && isCoreComplete(epi.row.answers))
  // Demo evaluation guide: reviewing these stages are steps of the CLABSI scenario.
  useEffect(() => {
    if (stage === 'hai' || stage === 'reassessment') signalDemoStep('clabsi_classification', stage)
  }, [stage])
  const [bundleDevice, setBundleDevice] = useState<AnyRecord | null>(null),
    [formNonce, setFormNonce] = useState(0)
  const [dialog, setDialog] = useState<AnyRecord | null>(null),
    [reason, setReason] = useState(''),
    [entryDetail, setEntryDetail] = useState(null)
  const active = record.status === 'active'
  // «Delete» of an entry of the episode, for a «…» menu (null when the person may not delete it).
  const ENTRY_TABLES = {
    assessment: ['clinical_assessments', (row: AnyRecord) => row.byId],
    hai: ['hai_classifications', (row: AnyRecord) => row.classifiedBy],
    isolation: ['isolation_episodes', (row: AnyRecord) => row.createdBy],
    outcome: ['surveillance_outcomes', (row: AnyRecord) => row.recordedById],
    therapy: ['antimicrobial_therapies', (row: AnyRecord) => row.createdBy],
    reassessment: ['surveillance_reassessments', (row: AnyRecord) => row.byId],
    device: ['surveillance_devices', (row: AnyRecord) => row.createdBy],
  }
  const entryDelete = (kind: string, row: AnyRecord, label: string) =>
    row?.id && deleteItem
      ? deleteItem({
          createdBy: ENTRY_TABLES[kind][1](row),
          table: ENTRY_TABLES[kind][0],
          id: row.id,
          label,
          detail: record.id,
          demo: () => repository.deleteEntry(record, kind, row),
          onDone: onReload,
        })
      : null
  // "Start protocol" from the episode header or from a qSOFA / SOFA prompt.
  useEffect(() => {
    if (!startProtocolRequest?.nonce || !active) return
    setProtocolPreset(startProtocolRequest)
    setDialog('protocolPicker')
    onProtocolRequestHandled?.()
  }, [startProtocolRequest, active, onProtocolRequestHandled])
  async function runProtocol(work, message: string) {
    try {
      const result = await work()
      setDialog(null)
      await protocols.reload()
      notify(message || t('actionCompleted'), 'success')
      return result ?? true
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
      return false
    }
  }
  const protocolOptions = { isDemo, actor }
  const now = new Date()
  const extraStages = protocolStages(protocols.runs, t, language, now)
  const extraCues = protocolCues(protocols.runs, record, protocols.reviews, t, {
    canProtocol: permissions.canProtocol,
    canTherapy: permissions.canTherapy,
    now,
  })
  const activeRun = stage.startsWith('protocol:')
    ? protocols.runs.find(run => `protocol:${run.id}` === stage) || null
    : null
  // The sheet's fields (owner, 8/11/2026): the forms of the assessment, the isolation, the reassessment and the outcome
  // sit on the page itself, with their own Save, instead of a window over it.
  // Only in «Edit sheet», one step at a time (owner, 8/11/2026).
  const sheetEdit = {
    assessment: editing && active && permissions.canAssess,
    isolation: editing && active && permissions.canIsolation && !record.isolation && record.isolationDecision?.required !== false,
    reassessment: editing && active && permissions.canReassess,
    outcome: editing && active && permissions.canOutcome && !record.outcome,
  }
  // «Next» saves the form of the step when it was changed (owner, 8/11/2026): the inline form on show registers
  // itself here (InlineDialogContext), and moving to another step saves it first.
  const pendingForm = useRef(null)
  const inlineForms = { register: (entry: AnyRecord) => (pendingForm.current = entry), unregister: (entry: AnyRecord) => pendingForm.current === entry && (pendingForm.current = null) }
  const sheetForm = node => <InlineDialogContext.Provider key={formNonce} value={inlineForms}>{node}</InlineDialogContext.Provider>
  // In «Edit sheet» every step opens with its form, no button to press first (owner, 8/11/2026): a new sample, HAI
  // assessment, device or therapy; the full questionnaire; the end of an active isolation.
  const stageForms =
    editing && active
      ? {
          samples: permissions.canLab ? 'sample' : null,
          questionnaire: canWriteEpi(role) ? 'epi' : null,
          hai: permissions.canAssess ? 'hai' : null,
          devices: permissions.canAssess ? 'device' : null,
          therapy: permissions.canTherapy ? 'therapy' : null,
          isolation: permissions.canIsolation && record.isolation?.status === 'active' ? 'endIsolation' : null,
        }
      : {}
  const shownDialog = dialog || stageForms[stage] || null
  // The step's own form has nothing to close to; a form opened on purpose closes back to it.
  const closeDialog = dialog && dialog !== stageForms[stage] ? () => setDialog(null) : null
  function goToStage(id: string) {
    const form = pendingForm.current
    if (id !== stage && form?.dirty() && !form.save()) return
    if (id !== stage) {
      setDialog(null)
      setEntryDetail(null)
    }
    setStage(id)
  }
  const cueDialogs: Record<string, string> = {
    assessment: 'assessment',
    isolation: 'isolation',
    therapy: 'therapy',
    hai: 'hai',
    reassessment: 'reassessment',
  }
  function openCue(id: string) {
    goToStage(id === 'therapyReview' ? 'therapy' : id)
    if (cueDialogs[id] && !editing) setDialog(cueDialogs[id])
  }
  async function run(work, message: string) {
    try {
      await work()
      setDialog(null)
      setBundleDevice(null)
      setFormNonce(value => value + 1)
      setReason('')
      await onReload()
      notify(message || t('actionCompleted'), 'success')
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
    }
  }
  if (!active)
    return (
      <div className="clinical-data-hub">
        {permissions.canReopen && (
          <div className="clinical-data-heading">
            <Button variant="secondary" onClick={() => setDialog('reopen')}>
              <RefreshCcw size={15} />
              {t('clinicalRecords.reopenSurveillance')}
            </Button>
          </div>
        )}
        <CompletedReport
          record={record}
          t={t}
          fmtDate={fmtDate}
          language={language}
          libraries={libraries}
        />
        {dialog === 'reopen' && (
          <ReasonDialog
            title={t('clinicalRecords.reopenSurveillance')}
            t={t}
            reason={reason}
            setReason={setReason}
            onClose={() => setDialog(null)}
            onSave={() =>
              run(() => repository.reopen(record, reason), t('clinicalRecords.surveillanceUpdated'))
            }
          />
        )}
      </div>
    )
  return (
    <SheetEditingContext.Provider value={editing}>
    <div className={`clinical-data-hub${editing ? ' sheet-editing' : ''}`}>
      <SurveillanceJourneyGuidance
        record={record}
        t={t}
        canAssess={permissions.canAssess}
        canLab={permissions.canLab}
        canIsolation={permissions.canIsolation}
        canTherapy={permissions.canTherapy}
        canReassess={permissions.canReassess}
        onSelect={openCue}
        extraCues={extraCues}
      />
      <SurveillanceJourneyMap
        record={record}
        t={t}
        fmtDate={fmtDate}
        activeStage={stage}
        onSelect={goToStage}
        extraStages={extraStages}
        questionnaire={epi.ready ? { done: epiDone } : null}
      >
      <div className="clinical-data-grid">
        <div className="sheet-anchor" id={`sheet-samples-${record.id}`}>
        {stage === 'samples' && (
          <StagePanel
            icon={Microscope}
            title={t('samples')}
            action={
              permissions.canLab && !stageForms.samples ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('sample')}
                >
                  {translate('copy.clinicalRecordCopy.sampleRequest', language === 'el' ? 'el' : 'en')}
                </Button>
              ) : null
            }
          >
            {record.samples?.length ? (
              <StageTable
                columns={[
                  { key: 'type', label: t('sampleType') },
                  { key: 'status', label: t('status') },
                  { key: 'organism', label: t('organism') },
                  {
                    key: 'amr',
                    label: translate(
                      'copy.clinicalRecordCopy.amrResistance',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                ]}
                rows={record.samples}
                onOpen={x => setEntryDetail({ kind: 'sample', row: x })}
                renderRow={x => (
                  <>
                    <td>{t(x.type) || x.type}</td>
                    <td>
                      <StateBadge
                        status={x.result || x.status || 'pending'}
                        label={t(x.result || x.status || 'pending')}
                      />
                    </td>
                    <td>{x.organism || '—'}</td>
                    <td>{x.resistance || '—'}</td>
                  </>
                )}
              />
            ) : (
              <div className="inline-empty">{t('clinicalRecords.noSamplesRecorded')}</div>
            )}
          </StagePanel>
        )}
        </div>
        <div className="sheet-anchor" id={`sheet-questionnaire-${record.id}`}>
        {stage === 'questionnaire' && shownDialog !== 'epi' && (
          <StagePanel
            icon={ClipboardList}
            title={t('epiQuestionnaire.sectionTitle')}
            action={
              stageForms.questionnaire ? null : (
                <Button className="clinical-stage-action" variant={epiDone ? 'secondary' : 'primary'} onClick={() => setDialog('epi')}>
                  {epiDone ? t('episodeForms.open') : t('epiQuestionnaire.fillIn')}
                </Button>
              )
            }
          >
            {/* The three core questions are answered right on the sheet, one click each (owner, 8/11/2026); the full
                questionnaire stays one click away. */}
            {shownDialog !== 'epi' && <div className="sheet-questions">
              {EPI_QUESTIONS.filter(question => question.core).map(question => (
                <div key={question.key} className="sheet-question">
                  <span>{epiText(question.label, language)}</span>
                  <ModeSwitch
                    ariaLabel={epiText(question.label, language)}
                    disabled={!editing || !canWriteEpi(role)}
                    value={answerOf(epi.row?.answers, question.key) || ''}
                    options={EPI_ANSWERS.map(answer => ({ value: answer, label: t(`epiQuestionnaire.${answer}`) }))}
                    onChange={async answer => {
                      try {
                        await saveEpiCoreAnswers(organizationId, epiKey, { [question.key]: { a: answer, src: EPI_SOURCE.MANUAL } }, { isDemo })
                        setEpi(current => ({ ...current, nonce: current.nonce + 1 }))
                      } catch (error) {
                        notify(error?.message || t('epiQuestionnaire.saveFailed'), 'danger')
                      }
                    }}
                  />
                </div>
              ))}
            </div>}
          </StagePanel>
        )}
        </div>
        <div className="sheet-anchor" id={`sheet-assessment-${record.id}`}>
        {stage === 'assessment' && !sheetEdit.assessment && (
          <StagePanel
            icon={ShieldCheck}
            title={t('clinicalAssessment')}
            menu={[entryDelete('assessment', record.assessment, t('clinicalAssessment'))]}
            action={
              permissions.canAssess ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('assessment')}
                >
                  {record.assessment
                    ? translate(
                        'copy.clinicalRecordCopy.editAssessment',
                        language === 'el' ? 'el' : 'en',
                      )
                    : translate(
                        'copy.clinicalRecordCopy.newClinicalAssessment',
                        language === 'el' ? 'el' : 'en',
                      )}
                </Button>
              ) : null
            }
          >
            {record.assessment ? (
              <>
                <div className="detail-grid">
                  <SheetDetail label={t('assessmentDate')} value={fmtDate(record.assessment.date)} />
                  <Detail
                    label={t('classification')}
                    value={clinicalTerm(
                      record.assessment.classification || 'undetermined',
                      language,
                      t,
                    )}
                  />
                </div>
                {(record.assessment.summary || record.assessment.notes) && (
                  <p className="clinical-summary">
                    {record.assessment.summary || record.assessment.notes}
                  </p>
                )}
                <TagList
                  title={t('signsSymptoms')}
                  items={record.assessment.signsSymptoms || record.assessment.symptoms}
                  rows={libraries.clinicalSymptoms || []}
                  t={t}
                  language={language}
                />
                <TagList
                  title={t('riskFactors')}
                  items={record.assessment.riskFactors}
                  rows={libraries.clinicalRiskFactors || []}
                  t={t}
                  language={language}
                />
                {/* The initial screening answers, each question with its answer (owner, 8/11/2026). */}
                {Object.keys(record.assessment.screening || {}).length > 0 && (
                  <>
                    <span className="lo-field-label tag-list-label">{copyText('initialSurveillanceQuestionnaire')}</span>
                    <div className="sheet-answers">
                      {SCREENING_QUESTIONS.map(([id, key]) => (
                        <div key={id} className="sheet-answer">
                          <span>{copyText(key)}</span>
                          <strong>{copyText(record.assessment.screening[id] || 'unknown')}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="inline-empty">{t('clinicalRecords.assessmentPending')}</div>
            )}
          </StagePanel>
        )}
        {stage === 'assessment' && sheetEdit.assessment && sheetForm(
          <AssessmentDialog
            t={t}
            record={record}
            symptomRows={libraries.clinicalSymptoms || []}
            riskRows={libraries.clinicalRiskFactors || []}
            onClose={null}
            onSave={draft => run(() => repository.saveAssessment(record, draft), t('actionCompleted'))}
          />,
        )}
        </div>
        {activeRun && (
          <ProtocolPanel
            run={activeRun}
            menu={[
              deleteItem?.({
                createdBy: activeRun.startedBy,
                table: 'clinical_protocol_runs',
                id: activeRun.id,
                label: t(`sepsis.protocols.${activeRun.protocolKey}.panelTitle`),
                detail: record.id,
                demo: async () => {
                  const removed = removeDemoProtocolRun(activeRun.id)
                  if (removed) await binMemoryRow(null, { module: 'clinical', kind: 'clinical_protocol_runs', label: t(`sepsis.protocols.${activeRun.protocolKey}.panelTitle`), detail: record.id, store: 'protocol_runs', row: removed })
                },
                onDone: async () => {
                  await protocols.reload()
                  setStage('assessment')
                  await onReload()
                },
              }),
            ]}
            record={record}
            t={t}
            language={language}
            canRecord={permissions.canProtocol}
            onRecordStep={draft =>
              runProtocol(() => recordProtocolStep(organizationId, activeRun, draft, protocolOptions))
            }
            onChangeTime={async draft => {
              if (
                draft.recognizedAt &&
                !(await runProtocol(() =>
                  changeRecognitionTime(organizationId, activeRun, draft, protocolOptions),
                ))
              )
                return false
              if (draft.weightKg !== undefined)
                return runProtocol(() =>
                  setProtocolWeight(organizationId, activeRun, draft.weightKg, protocolOptions),
                )
              return true
            }}
            onFinish={draft =>
              runProtocol(() => finishProtocolRun(organizationId, activeRun, draft, protocolOptions))
            }
          />
        )}
        <div className="sheet-anchor" id={`sheet-hai-${record.id}`}>
        {stage === 'hai' && (
          <StagePanel
            icon={AlertTriangle}
            menu={[entryDelete('hai', record.haiClassification, t('haiClassification'))]}
            title={translate(
              'copy.clinicalRecordCopy.haiHealthcareAssociatedInfectionsAmrAntimicrobial',
              language === 'el' ? 'el' : 'en',
            )}
            action={
              permissions.canAssess && !stageForms.hai ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('hai')}
                >
                  {translate(
                    'copy.clinicalRecordCopy.newHaiAssessment',
                    language === 'el' ? 'el' : 'en',
                  )}
                </Button>
              ) : null
            }
          >
            {record.haiClassification ? (
              <div className="evidence-box">
                <strong>
                  {record.haiClassification.type ? t(record.haiClassification.type) : '—'} ·{' '}
                  {t(record.haiClassification.status)}
                </strong>
                <span>
                  {record.haiClassification.rationale ||
                    record.haiClassification.definitionSet ||
                    '—'}
                </span>
              </div>
            ) : (
              <div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>
            )}
            {record.resistance ? (
              <div className="evidence-box">
                <strong>{record.resistance}</strong>
                <span>
                  {translate(
                    'copy.clinicalRecordCopy.derivedFromValidatedMicrobiologyAstEvidence',
                    language === 'el' ? 'el' : 'en',
                  )}
                </span>
              </div>
            ) : (
              <div className="inline-empty">
                {translate(
                  'copy.clinicalRecordCopy.noMdrXdrPdrClassificationIs',
                  language === 'el' ? 'el' : 'en',
                )}
              </div>
            )}
          </StagePanel>
        )}
        </div>
        <JourneyCareStages j={{ actor, deleteItem, deviceBundles, editing, entryDelete, fmtDate, language, now, organizationId, permissions, protocolOptions, protocols, record, repository, run, runProtocol, setBundleDevice, setDialog, setEntryDetail, SheetDetail, sheetEdit, sheetForm, stage, stageForms, t }} />
        <div className="sheet-anchor" id={`sheet-reassessment-${record.id}`}>
        {stage === 'reassessment' && (
          <StagePanel
            icon={RefreshCcw}
            title={t('reassessment')}
            action={
              permissions.canReassess && !sheetEdit.reassessment ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('reassessment')}
                >
                  {translate(
                    'copy.clinicalRecordCopy.newReassessment',
                    language === 'el' ? 'el' : 'en',
                  )}
                </Button>
              ) : null
            }
          >
            {record.reassessments?.length ? (
              <div className="clinical-timeline">
                {record.reassessments.map((x: AnyRecord) => (
                  <article
                    key={x.id}
                    className="clickable-entry"
                    tabIndex={0}
                    onClick={() => setEntryDetail({ kind: 'reassessment', row: x })}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setEntryDetail({ kind: 'reassessment', row: x })
                      }
                    }}
                  >
                    <div>
                      <header>
                        <strong>{t(x.status)}</strong>
                        <time>{fmtDate(x.date)}</time>
                      </header>
                      <p>{x.notes || '—'}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="inline-empty">{t('clinicalRecords.noReassessmentRecorded')}</div>
            )}
          </StagePanel>
        )}
        {stage === 'reassessment' && sheetEdit.reassessment && sheetForm(
          <ReassessmentDialog
            t={t}
            onClose={null}
            onSave={draft => run(() => repository.reassess(record, draft), t('actionCompleted'))}
          />,
        )}
        </div>
        <div className="sheet-anchor" id={`sheet-outcome-${record.id}`}>
        {stage === 'outcome' && !sheetEdit.outcome && (
          <StagePanel
            icon={Activity}
            title={t('outcome')}
            menu={[entryDelete('outcome', record.outcome, t('outcome'))]}
            action={
              permissions.canOutcome ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('outcome')}
                >
                  {record.outcome
                    ? translate(
                        'copy.clinicalRecordCopy.editOutcome',
                        language === 'el' ? 'el' : 'en',
                      )
                    : translate(
                        'copy.clinicalRecordCopy.recordOutcome',
                        language === 'el' ? 'el' : 'en',
                      )}
                </Button>
              ) : null
            }
          >
            {record.outcome ? (
              <div className="detail-grid">
                <SheetDetail label={t('status')} value={t(record.outcome.status)} />
                <SheetDetail label={t('date')} value={fmtDate(record.outcome.date)} />
                <SheetDetail label={t('notes')} value={record.outcome.notes} />
              </div>
            ) : (
              <div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>
            )}
          </StagePanel>
        )}
        {stage === 'outcome' && sheetEdit.outcome && sheetForm(
          <OutcomeDialog
            t={t}
            onClose={null}
            onSave={draft => run(() => repository.complete(record, draft), t('clinicalRecords.outcomeSaved'))}
          />,
        )}
        </div>
      {/* The windows of the sheet open in it, under their step, not over the page (owner, 8/11/2026). */}
      <InlineDialogContext.Provider value={inlineForms}>
      <div className="sheet-inline-forms" key={formNonce}>
      <JourneyWindows j={{ active, admission, bundleDevice, closeDialog, deviceBundles, dialog, entryDelete, entryDetail, epi, fmtDate, fmtDateTime, isDemo, language, libraries, onLibraryAdded, organizationId, patient, permissions, protocolOptions, protocolPreset, protocols, record, repository, role, run, runProtocol, setBundleDevice, setDialog, setEntryDetail, setEpi, setFormNonce, setStage, shownDialog, t }} />
      </div>
      </InlineDialogContext.Provider>
      </div>
      </SurveillanceJourneyMap>
    </div>
    </SheetEditingContext.Provider>
  )
}
