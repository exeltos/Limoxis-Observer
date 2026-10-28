import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, BedDouble, Microscope, Pill, RefreshCcw, ShieldCheck, Stethoscope } from 'lucide-react'
import { Button } from '../../design-system/Button'

import { translate } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { SurveillanceJourneyGuidance, SurveillanceJourneyMap } from './SurveillanceJourneyMap'
import { patientAgeDays } from '../clinical-scales/clinicalScaleContext'
import { Detail } from './ClinicalAdmissions'
import { ClinicalEntryDetail, StageTable, StateBadge } from './ClinicalJourneyParts'
import { clinicalTerm, episodeTypeLabel } from './clinicalRecordLabels'
import { AssessmentDialog, DeviceDialog, SampleRequestDialog, HaiDialog, TherapyDialog, IsolationDialog, EndDialog, ReassessmentDialog, OutcomeDialog, ReasonDialog } from './ClinicalRecordDialogs'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { StagePanel, TagList, CompletedReport } from './ClinicalRecordViews'
import { binMemoryRow } from '../../core/recycleBin/recycleBinService'
import { signalDemoStep } from '../demo/demoScenarioSignals'

import { useAuditActor } from '../../core/audit/useAuditActor'
import { ProtocolPanel, ProtocolPickerDialog } from './protocols/ProtocolViews'
import { TherapyReviewCard } from './protocols/TherapyReviewCard'
import { protocolCues, protocolStages, useEpisodeProtocols } from './protocols/useEpisodeProtocols'
import { reviewWindow, showsReviewCard } from './protocols/therapyReview'
import { changeRecognitionTime, createTherapyReview, finishProtocolRun, recordProtocolStep, removeDemoProtocolRun, setProtocolWeight, startProtocolRun } from './protocols/protocolService'

// Surveillance episode journey: stages, clinical entries and their detail view.

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
}) {
  const { notify } = useFeedback()
  const actor = useAuditActor()
  // N3: protocols started on the episode and the 48–72 h antimicrobial reviews.
  const protocols = useEpisodeProtocols(record, { organizationId, isDemo })
  const [protocolPreset, setProtocolPreset] = useState(null)
  const [stage, setStage] = useState(initialStage || 'assessment')
  useEffect(() => {
    if (initialStage) setStage(initialStage)
  }, [initialStage])
  // Demo evaluation guide: reviewing these stages are steps of the CLABSI scenario.
  useEffect(() => {
    if (stage === 'hai' || stage === 'reassessment') signalDemoStep('clabsi_classification', stage)
  }, [stage])
  const [dialog, setDialog] = useState(null),
    [reason, setReason] = useState(''),
    [entryDetail, setEntryDetail] = useState(null)
  const active = record.status === 'active'
  // «Delete» of an entry of the episode, for a «…» menu (null when the person may not delete it).
  const ENTRY_TABLES = {
    assessment: ['clinical_assessments', row => row.byId],
    hai: ['hai_classifications', row => row.classifiedBy],
    isolation: ['isolation_episodes', row => row.createdBy],
    outcome: ['surveillance_outcomes', row => row.recordedById],
    therapy: ['antimicrobial_therapies', row => row.createdBy],
    reassessment: ['surveillance_reassessments', row => row.byId],
    device: ['surveillance_devices', row => row.createdBy],
  }
  const entryDelete = (kind, row, label) =>
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
  async function runProtocol(work, message) {
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
  const cueDialogs = {
    assessment: 'assessment',
    isolation: 'isolation',
    therapy: 'therapy',
    hai: 'hai',
    reassessment: 'reassessment',
  }
  function openCue(id) {
    setStage(id === 'therapyReview' ? 'therapy' : id)
    if (cueDialogs[id]) setDialog(cueDialogs[id])
  }
  async function run(work, message) {
    try {
      await work()
      setDialog(null)
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
          fmtDateTime={fmtDateTime}
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
    <div className="clinical-data-hub">
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
        onSelect={setStage}
        extraStages={extraStages}
      />
      <div className="clinical-data-grid">
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
        {stage === 'assessment' && (
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
                  <Detail label={t('assessmentDate')} value={fmtDate(record.assessment.date)} />
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
              </>
            ) : (
              <div className="inline-empty">{t('clinicalRecords.assessmentPending')}</div>
            )}
          </StagePanel>
        )}
        {stage === 'devices' && (
          <StagePanel
            icon={Stethoscope}
            title={translate(
              'copy.clinicalRecordCopy.devicesRiskFactors',
              language === 'el' ? 'el' : 'en',
            )}
            action={
              permissions.canAssess ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('device')}
                >
                  {translate(
                    'copy.clinicalRecordCopy.recordDevice',
                    language === 'el' ? 'el' : 'en',
                  )}
                </Button>
              ) : null
            }
          >
            {record.devices?.length ? (
              <StageTable
                columns={[
                  {
                    key: 'device',
                    label: translate(
                      'copy.clinicalRecordCopy.device',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  {
                    key: 'start',
                    label: translate(
                      'copy.clinicalRecordCopy.startDate',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  ...(deviceBundles ? [{ key: 'day', label: t('episodeForms.bundles.dayColumn') }] : []),
                  { key: 'status', label: t('status') },
                  ...(deviceBundles ? [{ key: 'bundle', label: t('episodeForms.bundles.column') }, { key: 'check', label: '' }] : []),
                  ...(deleteItem ? [{ key: 'menu', label: '' }] : []),
                ]}
                rows={record.devices}
                renderRow={x => {
                  // The one place a bundle check starts: only a device still in place has one.
                  const bundle = deviceBundles && !x.removedAt && x.status !== 'removed' ? deviceBundles.info(x) : null
                  const hasBundle = Boolean(bundle?.bundleKeys.length)
                  return (
                  <>
                    <td>{x.name || x.type || '—'}</td>
                    <td>{fmtDate(x.insertedAt || x.startedAt)}</td>
                    {deviceBundles && <td>{bundle?.deviceDay ?? '—'}</td>}
                    <td>
                      <StateBadge status={x.status || 'active'} label={t(x.status || 'active')} />
                    </td>
                    {deviceBundles && (
                      <td>
                        {hasBundle ? (
                          <>
                            {bundle.bundleKeys[0]}
                            <small className="entry-detail-note">{t(`episodeForms.status.${bundle.status}`)}</small>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {deviceBundles && (
                      <td className="open-record-cell">
                        {hasBundle && deviceBundles.canCheck && (
                          <Button variant={bundle.status === 'overdue' ? 'primary' : 'secondary'} onClick={() => deviceBundles.check(x, record)}>
                            {t('episodeForms.bundles.check')}
                          </Button>
                        )}
                      </td>
                    )}
                    {deleteItem && (
                      <td className="open-record-cell">
                        {entryDelete('device', x, x.name || x.type) && <OverflowMenu label={t('episodeForms.rowActions')} items={[entryDelete('device', x, x.name || x.type)]} />}
                      </td>
                    )}
                  </>
                  )
                }}
              />
            ) : (
              <div className="inline-empty">
                {translate(
                  'copy.clinicalRecordCopy.noInvasiveDevicesRecordedRiskFactors',
                  language === 'el' ? 'el' : 'en',
                )}
              </div>
            )}
          </StagePanel>
        )}
        {stage === 'samples' && (
          <StagePanel
            icon={Microscope}
            title={t('samples')}
            action={
              permissions.canLab ? (
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
        {stage === 'hai' && (
          <StagePanel
            icon={AlertTriangle}
            menu={[entryDelete('hai', record.haiClassification, t('haiClassification'))]}
            title={translate(
              'copy.clinicalRecordCopy.haiHealthcareAssociatedInfectionsAmrAntimicrobial',
              language === 'el' ? 'el' : 'en',
            )}
            action={
              permissions.canAssess ? (
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
        {stage === 'therapy' && (
          <StagePanel
            icon={Pill}
            title={t('therapy')}
            action={
              permissions.canTherapy ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('therapy')}
                >
                  {translate(
                    'copy.clinicalRecordCopy.newAntimicrobialTherapy',
                    language === 'el' ? 'el' : 'en',
                  )}
                </Button>
              ) : null
            }
          >
            {record.therapy?.length ? (
              <StageTable
                columns={[
                  {
                    key: 'drug',
                    label: translate(
                      'copy.clinicalRecordCopy.antimicrobial',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  {
                    key: 'dose',
                    label: translate(
                      'copy.clinicalRecordCopy.doseRoute',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  {
                    key: 'start',
                    label: translate(
                      'copy.clinicalRecordCopy.start',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  { key: 'status', label: t('status') },
                ]}
                rows={record.therapy}
                onOpen={x => setEntryDetail({ kind: 'therapy', row: x })}
                renderRow={x => (
                  <>
                    <td>
                      <strong>{x.antimicrobial}</strong>
                    </td>
                    <td>
                      {x.dose || '—'} · {x.route || '—'}
                    </td>
                    <td>{fmtDate(x.startedAt)}</td>
                    <td>
                      <StateBadge status={x.status || 'active'} label={t(x.status || 'active')} />
                    </td>
                  </>
                )}
              />
            ) : (
              <div className="inline-empty">{t('clinicalRecords.noTherapyRecorded')}</div>
            )}
            {(record.therapy || []).map(therapy => {
              const window = reviewWindow(therapy, protocols.reviews, now)
              return showsReviewCard(window) ? (
                <TherapyReviewCard
                  key={`review-${therapy.id}`}
                  record={record}
                  therapy={therapy}
                  window={window}
                  t={t}
                  actorName={actor?.name}
                  canReview={permissions.canTherapy}
                  onSave={draft =>
                    runProtocol(
                      () => createTherapyReview(organizationId, record, therapy, draft, protocolOptions),
                      t('sepsis.review.saved'),
                    )
                  }
                />
              ) : null
            })}
          </StagePanel>
        )}
        {stage === 'isolation' && (
          <StagePanel
            icon={BedDouble}
            title={t('isolation')}
            menu={[entryDelete('isolation', record.isolation, t('isolation'))]}
            action={
              permissions.canIsolation ? (
                <div className="row-actions">
                  {record.isolation?.status === 'active' ? (
                    <Button
                      className="clinical-stage-action"
                      variant="secondary"
                      onClick={() => setDialog('endIsolation')}
                    >
                      {translate(
                        'copy.clinicalRecordCopy.endIsolation',
                        language === 'el' ? 'el' : 'en',
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="clinical-stage-action"
                      variant="secondary"
                      onClick={() => setDialog('isolation')}
                    >
                      {translate(
                        'copy.clinicalRecordCopy.startIsolation',
                        language === 'el' ? 'el' : 'en',
                      )}
                    </Button>
                  )}
                  {/* «Not required» is the infection-control decision on the case
                      (surveillance_cases + its event); the departments only start and end isolation. */}
                  {!record.isolation && permissions.canReassess && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        run(() => repository.setIsolationNotRequired(record), t('actionCompleted'))
                      }
                    >
                      {t('notRequired')}
                    </Button>
                  )}
                </div>
              ) : null
            }
          >
            {record.isolation ? (
              <div className="detail-grid">
                <Detail label={t('status')} value={t(record.isolation.status)} />
                <Detail label={t('startDate')} value={fmtDate(record.isolation.startedAt)} />
                <Detail label={t('reason')} value={record.isolation.reason} />
                <Detail label={t('room')} value={record.isolation.room} />
              </div>
            ) : (
              <div className="inline-empty">
                {record.isolationDecision?.required === false
                  ? t('notRequired')
                  : t('clinicalRecords.noIsolationRecorded')}
              </div>
            )}
          </StagePanel>
        )}
        {stage === 'reassessment' && (
          <StagePanel
            icon={RefreshCcw}
            title={t('reassessment')}
            action={
              permissions.canReassess ? (
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
                {record.reassessments.map(x => (
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
        {stage === 'outcome' && (
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
                <Detail label={t('status')} value={t(record.outcome.status)} />
                <Detail label={t('date')} value={fmtDate(record.outcome.date)} />
                <Detail label={t('notes')} value={record.outcome.notes} />
              </div>
            ) : (
              <div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>
            )}
          </StagePanel>
        )}
      </div>
      {dialog === 'protocolPicker' && (
        <ProtocolPickerDialog
          t={t}
          runs={protocols.runs}
          preset={protocolPreset}
          onClose={() => setDialog(null)}
          onStart={async draft => {
            const run = await runProtocol(() =>
              startProtocolRun(organizationId, record, draft, protocolOptions),
            )
            if (run?.id) setStage(`protocol:${run.id}`)
            return run
          }}
        />
      )}
      {dialog === 'assessment' && (
        <AssessmentDialog
          t={t}
          record={record}
          symptomRows={libraries.clinicalSymptoms || []}
          riskRows={libraries.clinicalRiskFactors || []}
          onClose={() => setDialog(null)}
          onSave={draft =>
            run(() => repository.saveAssessment(record, draft), t('actionCompleted'))
          }
        />
      )}{' '}
      {dialog === 'device' && (
        <DeviceDialog
          t={t}
          items={libraries.deviceTypes || []}
          onAddLibraryItem={item => onLibraryAdded?.('deviceTypes', item)}
          onClose={() => setDialog(null)}
          onSave={draft => run(() => repository.addDevice(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {dialog === 'sample' && (
        <SampleRequestDialog
          t={t}
          context={{
            patient: language === 'el' ? record.patient : record.patientEn || record.patient,
            episode: [episodeTypeLabel(record, t), fmtDate(record.startedAt)].filter(Boolean).join(' · '),
            department: language === 'el' ? record.department : record.departmentEn || record.department,
          }}
          epi={{ episode: record, admission: null, samples: record.samples || [] }}
          onClose={() => setDialog(null)}
          onSave={draft => run(() => repository.requestSample(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {dialog === 'hai' && (
        <HaiDialog
          t={t}
          items={libraries.surveillanceDefinitions || []}
          patientAgeDays={patientAgeDays(record.dateOfBirth)}
          organizationId={organizationId}
          isDemo={isDemo}
          onAddLibraryItem={item => onLibraryAdded?.('surveillanceDefinitions', item)}
          onClose={() => setDialog(null)}
          onSave={draft => run(() => repository.saveHai(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {dialog === 'therapy' && (
        <TherapyDialog
          t={t}
          antibiotics={libraries.antibiotics || []}
          advancedAntibiotics={libraries.advancedAntibiotics || []}
          onClose={() => setDialog(null)}
          onSave={draft => run(() => repository.addTherapy(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {dialog === 'isolation' && (
        <IsolationDialog
          t={t}
          onClose={() => setDialog(null)}
          onSave={draft =>
            run(() => repository.beginIsolation(record, draft), t('actionCompleted'))
          }
        />
      )}{' '}
      {dialog === 'endIsolation' && (
        <EndDialog
          title={t('isolation')}
          t={t}
          onClose={() => setDialog(null)}
          onSave={draft =>
            run(() => repository.finishIsolation(record, draft), t('actionCompleted'))
          }
        />
      )}{' '}
      {dialog === 'reassessment' && (
        <ReassessmentDialog
          t={t}
          onClose={() => setDialog(null)}
          onSave={draft => run(() => repository.reassess(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {dialog === 'outcome' && (
        <OutcomeDialog
          t={t}
          onClose={() => setDialog(null)}
          onSave={draft =>
            run(() => repository.complete(record, draft), t('clinicalRecords.outcomeSaved'))
          }
        />
      )}{' '}
      {entryDetail && (
        <ClinicalEntryDetail
          entry={entryDetail}
          t={t}
          language={language}
          fmtDate={fmtDate}
          fmtDateTime={fmtDateTime}
          canManage={active}
          onClose={() => setEntryDetail(null)}
          onDelete={
            entryDetail.kind === 'therapy' || entryDetail.kind === 'reassessment'
              ? entryDelete(entryDetail.kind, entryDetail.row, entryDetail.kind === 'therapy' ? entryDetail.row.antimicrobial : t('reassessment'))
              : null
          }
          onEdit={() => {
            const kind = entryDetail.kind
            setEntryDetail(null)
            if (kind === 'therapy') return
            setDialog(kind === 'sample' ? 'sample' : kind)
          }}
          onFinishTherapy={
            entryDetail.kind === 'therapy' &&
            entryDetail.row?.status === 'active' &&
            permissions.canTherapy
              ? () => {
                  const row = entryDetail.row
                  setEntryDetail(null)
                  run(
                    () =>
                      repository.finishTherapy(record, row.id, {
                        endedAt: new Date().toISOString().slice(0, 10),
                      }),
                    t('actionCompleted'),
                  )
                }
              : null
          }
          onApproveTherapy={
            entryDetail.kind === 'therapy' && permissions.canTherapy
              ? () => {
                  const row = entryDetail.row
                  setEntryDetail(null)
                  run(
                    () => repository.updateTherapyApproval(record, row.id, 'approved'),
                    t('actionCompleted'),
                  )
                }
              : null
          }
          onRejectTherapy={
            entryDetail.kind === 'therapy' && permissions.canTherapy
              ? () => {
                  const row = entryDetail.row
                  setEntryDetail(null)
                  run(
                    () => repository.updateTherapyApproval(record, row.id, 'rejected'),
                    t('actionCompleted'),
                  )
                }
              : null
          }
          onRecordAdministration={
            entryDetail.kind === 'therapy' && permissions.canTherapy
              ? draft => {
                  const row = entryDetail.row
                  setEntryDetail(null)
                  run(
                    () => repository.recordAdministration(record, row.id, draft),
                    t('actionCompleted'),
                  )
                }
              : null
          }
        />
      )}
    </div>
  )
}
