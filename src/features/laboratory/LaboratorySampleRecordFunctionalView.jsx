import { SectionHeader } from '../../design-system/SectionHeader'
import { isOutsideLimit } from './environmentalLimit'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileClock, FileSearch, FlaskConical, LockKeyhole, Microscope, FolderOpen, Pencil, PhoneCall, PlayCircle, RotateCcw, ShieldAlert } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { RouteLoading } from '../../design-system/RouteLoading'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { useRecordDelete } from '../recycle-bin/useRecordDelete'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { EmptyState } from '../../design-system/EmptyState'
import { EntityAttachmentsPanel } from '../../design-system/EntityAttachmentsPanel'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDateTime } from '../../core/i18n/formatDay'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { downloadRecordJson } from '../../core/export/recordExport'
import {
  ENVIRONMENTAL_CATEGORIES,
  resolveEnvironmentalStandard,
  sampleTypeLabel,
} from './laboratoryCloudService'
import { LaboratoryStatus as Status, labSampleStatus } from './LaboratoryStatus'
import { LaboratorySampleSummary, LaboratoryWorkflow } from './LaboratorySampleSummary'
import { useLaboratoryRepository } from './hooks/useLaboratoryRepository'
import { useLibraries } from '../management/useLibraries'
import { sampleProgress, workflowStates } from './laboratorySampleProgress'
import { copy } from './laboratorySampleFormat'
import { ResultCard, LabHistory } from './LaboratorySampleViews'
import { ResultDialog, AstDialog, AmrDialog, CommunicationDialog } from './LaboratorySampleDialogs'
import { buildLaboratorySampleReport } from './laboratorySampleReport'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import { canReviewSamples, reviewTag, sampleEpisodeTarget } from './sampleReviewModel'

export function LaboratorySampleRecordFunctionalView() {
  const { sampleId } = useParams()
  const { t, language } = useLanguage()
  const tx = key => copy[language]?.[key] || copy.en[key] || key
  const { notify } = useFeedback()
  const { role, membership, tenant, canAccessRecord } = useTenant()
  const { libraries } = useLibraries()
  const repository = useLaboratoryRepository()
  // An environmental sample opened from the Surveillance Center stays there:
  // its own address, back and previous/next follow the surveillance list.
  const inSurveillance = useLocation().pathname.startsWith('/surveillance/')
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation(inSurveillance ? '/surveillance' : '/laboratory')
  const deleteItem = useRecordDelete()
  const recordNavigation = useRecordSequenceNavigation({
    registry: inSurveillance ? 'surveillance-environmental' : 'laboratory',
    currentId: sampleId,
    pathForId: id => (inSurveillance ? `/surveillance/environment/${id}` : `/laboratory/${id}`),
  })
  const [sample, setSample] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tab, setTab] = useState('sample'),
    [dialog, setDialog] = useState(null),
    [standards, setStandards] = useState([])
  const has = cap =>
    can(role, cap, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const canManage = has(CAPABILITIES.MANAGE_LAB_SAMPLES),
    canValidate = has(CAPABILITIES.VALIDATE_LAB_RESULTS),
    canCommunicate = has(CAPABILITIES.COMMUNICATE_CRITICAL_RESULTS),
    canReopen = has(CAPABILITIES.REOPEN_LAB_RECORD)
  const fmt = value => formatDateTime(value, language)
  async function reload() {
    setLoading(true)
    setError('')
    try {
      setSample(await repository.get(sampleId))
    } catch (err) {
      setError(err?.message || t('actionFailed'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    reload()
  }, [sampleId, repository]) // eslint-disable-line react-hooks/exhaustive-deps
  const isEnvironmental =
    sample?.subjectType === 'environment' || ENVIRONMENTAL_CATEGORIES.includes(sample?.type)
  // Same rule as the environmental surveillance list (environmentalNeedsAction): a result outside its limits on a sample that is not closed.
  const environmentNeedsAction =
    isEnvironmental && !['cancelled', 'rejected', 'voided'].includes(sample?.status) && (sample?.microbiologyResults || []).some(item => isOutsideLimit(item))
  useEffect(() => {
    if (isEnvironmental)
      repository
        .loadStandards()
        .then(setStandards)
        .catch(() => setStandards([]))
  }, [isEnvironmental, repository])
  const standard =
    isEnvironmental && sample
      ? resolveEnvironmentalStandard(standards, sample.type, sample.environmentalMethod)
      : null
  const {
      result,
      ast,
      amr,
      communications,
      organisms,
      finalized,
      rejected,
      locked,
      received,
      resultValidated,
      astRequired,
      astComplete,
      astDone,
      firstMissingAst,
      communicationRequired,
      communicationComplete,
      documentsReviewed,
      readyToFinalize,
    } = sampleProgress(sample),
    canManageActive = canManage && !locked
  const tabs = useMemo(
    () => [
      { id: 'sample', label: t('laboratoryRecords.sample'), icon: FlaskConical },
      { id: 'result', label: t('laboratoryRecords.microbiologyResult'), icon: Microscope },
      { id: 'attachments', label: t('documents'), icon: FolderOpen },
      { id: 'history', label: t('history'), icon: FileClock },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  )
  async function run(work, message) {
    try {
      await work()
      setDialog(null)
      await reload()
      notify(message, 'success')
    } catch (err) {
      notify(err?.message || t('actionFailed'), 'error')
    }
  }
  const startProcessing = () =>
    run(
      () =>
        repository.updateStatus(sample.id, 'processing', {
          receivedAt: sample.receivedAt || new Date(),
        }),
      tx('processing'),
    )
  const openResult = () => {
    setTab('result')
    setDialog('result')
  }
  const openAst = organism => {
    setTab('result')
    setDialog(`ast:${organism || organisms[0] || ''}`)
  }
  const openCommunication = () => {
    setTab('result')
    setDialog('communication')
  }
  async function reject(reason) {
    if (finalized && canReopen) await repository.reopen(sample.id, `${tx('reject')}: ${reason}`)
    await run(
      () => repository.updateStatus(sample.id, 'rejected', { rejectionReason: reason }),
      tx('rejected'),
    )
  }
  // The sample's first read: the page placeholder, not a generic «sample» page.
  if (loading) return <RouteLoading />
  if (error || !sample)
    return (
      <Page title={t('laboratoryRecords.sample')}>
        <EmptyState title={t('actionFailed')} description={error || t('noData')} />
      </Page>
    )
  // The surveillance address opens environmental samples only; a patient or
  // employee sample stays behind the Laboratory's own access.
  if (!canAccessRecord(sample) || (inSurveillance && !isEnvironmental))
    return (
      <Page title={t('laboratoryRecords.sample')}>
        <EmptyState
          title={t('scopeAccessDeniedTitle')}
          description={t('scopeAccessDeniedDescription')}
        />
      </Page>
    )

  const pending = [
    {
      id: 'receive',
      label: tx('stepReceive'),
      done: received,
      meta: received ? fmt(sample.receivedAt) : '',
      hint: tx('hintReceive'),
      action: canManageActive
        ? { label: tx('process'), icon: PlayCircle, onClick: startProcessing }
        : null,
    },
    {
      id: 'result',
      label: tx('stepResult'),
      done: resultValidated,
      meta: result
        ? [result.result && t(result.result), tx(result.resultStatus || 'draft')]
            .filter(Boolean)
            .join(' · ')
        : '',
      hint: tx('hintResult'),
      action: canManageActive
        ? {
            label: result ? tx('editResult') : tx('enterResult'),
            icon: Pencil,
            onClick: openResult,
          }
        : null,
    },
    {
      id: 'ast',
      label: tx('stepAst'),
      done: astComplete,
      na: !astRequired,
      meta: astRequired ? `${astDone}/${organisms.length}` : '',
      hint: firstMissingAst ? `${tx('hintAst')} · ${firstMissingAst}` : tx('hintAst'),
      action: canManageActive
        ? { label: tx('addAst'), icon: Microscope, onClick: () => openAst(firstMissingAst) }
        : null,
    },
    {
      id: 'communication',
      label: tx('stepCommunication'),
      done: communicationComplete,
      na: !communicationRequired,
      meta: communications.length ? fmt(communications[communications.length - 1].at) : '',
      hint: tx('hintCommunication'),
      action:
        canCommunicate && !locked
          ? { label: tx('addCommunication'), icon: PhoneCall, onClick: openCommunication }
          : null,
    },
    {
      id: 'documents',
      label: tx('stepDocuments'),
      done: documentsReviewed,
      meta: documentsReviewed ? fmt(sample.documentsReviewedAt) : '',
      hint: tx('hintDocuments'),
      action: !locked
        ? { label: tx('documents'), icon: FileSearch, onClick: () => setTab('attachments') }
        : null,
    },
    {
      id: 'finalize',
      label: tx('stepFinalize'),
      done: finalized,
      meta: finalized ? fmt(sample.finalizedAt) : '',
      hint: tx('hintFinalize'),
      action:
        canValidate && !locked && readyToFinalize
          ? {
              label: tx('finalizeRecord'),
              icon: CheckCircle2,
              onClick: () => run(() => repository.finalize(sample.id), tx('finalized')),
            }
          : null,
    },
  ]
  const steps = workflowStates(pending)
  const closedNote = rejected ? (
    <>
      <AlertTriangle size={16} />
      <span>
        {tx('rejectedReadOnly')}
        {sample.rejectionReason ? ` · ${sample.rejectionReason}` : ''}
      </span>
    </>
  ) : finalized ? (
    <>
      <LockKeyhole size={16} />
      <span>{tx('finalizedReadOnly')}</span>
    </>
  ) : null

  const sampleMenu = [
    canManageActive &&
      !received && {
        id: 'process',
        label: tx('process'),
        icon: PlayCircle,
        onClick: startProcessing,
      },
    // «Edit result» is the visible next-step button while the result is the next step: not repeated in this menu.
    canManageActive &&
      received &&
      steps.find(step => step.state === 'next')?.id !== 'result' && {
        id: 'result',
        label: result ? tx('editResult') : tx('enterResult'),
        icon: Pencil,
        onClick: openResult,
      },
    finalized &&
      canReopen &&
      !rejected && {
        id: 'correct',
        label: tx('correction'),
        icon: RotateCcw,
        onClick: () => setDialog('correction'),
      },
    (canManageActive || (finalized && canReopen && !rejected)) && {
      id: 'reject',
      label: tx('reject'),
      icon: AlertTriangle,
      tone: 'danger',
      separatorBefore: true,
      onClick: () => setDialog('reject'),
    },
  ].filter(Boolean)

  // The Result tab of a sample with no outcome yet: an empty state with the one primary action.
  const resultEmpty = !(result?.result || organisms.length)
  const resultAction = canManageActive
    ? received
      ? { label: tx('enterResult'), icon: Pencil, onClick: openResult }
      : { label: tx('process'), icon: PlayCircle, onClick: startProcessing }
    : null
  const resultEmptyState = (
    <RegistryEmptyState
      icon={Microscope}
      title={tx('noResult')}
      text={received ? (canManageActive ? tx('noResultHint') : '') : tx('noResultNotReceived')}
      action={resultAction}
    />
  )

  // One tab of the sample: on screen the active one; when the record is printed
  // (EntityRecordShell renderTab) every tab, one after the other.
  const renderTab = tabId => (
    <>
      {tabId === 'sample' && (
        <div className="lab-record-stack">
          <LaboratoryWorkflow steps={steps} language={language} closedNote={closedNote} />
          <LaboratorySampleSummary
            sample={sample}
            t={t}
            language={language}
            fmt={fmt}
            menu={<OverflowMenu items={[...sampleMenu, sampleDelete].filter(Boolean)} />}
          />
        </div>
      )}
      {tabId === 'result' && (
        <div className="lab-record-stack">
          <ResultCard
            t={t}
            tx={tx}
            language={language}
            result={result}
            organisms={organisms}
            isEnvironmental={isEnvironmental}
            standard={standard}
            emptyState={resultEmptyState}
            menu={
              <OverflowMenu
                items={[
                  // With no result yet «Καταχώριση αποτελέσματος» is the button of the empty state: not repeated here.
                  canManageActive &&
                    received &&
                    !resultEmpty && {
                      id: 'result',
                      label: result ? tx('editResult') : tx('enterResult'),
                      icon: Pencil,
                      onClick: openResult,
                    },
                  canManageActive &&
                    astRequired && {
                      id: 'ast',
                      label: tx('addAst'),
                      icon: Microscope,
                      onClick: () => openAst(firstMissingAst),
                    },
                  canCommunicate &&
                    !locked &&
                    communicationRequired && {
                      id: 'communication',
                      label: tx('addCommunication'),
                      icon: PhoneCall,
                      onClick: openCommunication,
                    },
                  finalized &&
                    canReopen &&
                    !rejected && {
                      id: 'correct',
                      label: tx('correction'),
                      icon: RotateCcw,
                      separatorBefore: true,
                      onClick: () => setDialog('correction'),
                    },
                ].filter(Boolean)}
              />
            }
          />
          {astRequired && (
            <section className="lab-record-card lab-ast-card">
              <SectionHeader title={language === 'el' ? 'Αντιβιόγραμμα και AMR' : 'AST and AMR'} />
              {organisms.map(name => {
                const tagged = ast.filter(row => row.organism === name)
                const current = amr.filter(row => row.organism === name).slice(-1)[0] || null
                return (
                  <article className="lab-isolate-card" key={name} data-demo-step="microbiology_mdro:amr">
                    <div className="lab-isolate-summary">
                      <div className="lab-isolate-identity">
                        <span className="lab-isolate-icon">
                          <Microscope size={18} />
                        </span>
                        <div>
                          <span className="eyebrow">{tx('organism')}</span>
                          <h3>{name}</h3>
                        </div>
                      </div>
                      <div className="record-section-actions">
                        {current && <StatusBadge tone="danger">{current.classification}</StatusBadge>}
                        {canManageActive && (
                          <OverflowMenu
                            items={[
                              {
                                id: 'add-ast',
                                label: tx('addAst'),
                                icon: Microscope,
                                onClick: () => openAst(name),
                              },
                              {
                                id: 'classify-amr',
                                label: current ? tx('changeAmr') : tx('classifyAmr'),
                                icon: ShieldAlert,
                                onClick: () => setDialog(`amr:${name}`),
                              },
                            ]}
                          />
                        )}
                      </div>
                    </div>
                    {current && (
                      <div className="lab-amr-strip">
                        <ShieldAlert size={16} />
                        <div>
                          <span>{tx('amrTitle')}</span>
                          <strong>
                            {current.classification} · {current.definitionSource || '—'}{' '}
                            {current.definitionVersion || ''}
                          </strong>
                          {current.rationale && <small>{current.rationale}</small>}
                        </div>
                      </div>
                    )}
                    <RegistryTable
                      className="lab-ast-table"
                      wrapperClassName="lab-ast-scroll"
                      columns={[
                        { key: 'drug', label: tx('antibiotic') },
                        { key: 'mic', label: 'MIC' },
                        { key: 'sir', label: 'S/I/R' },
                        { key: 'method', label: tx('method') },
                        { key: 'standard', label: tx('standard') },
                      ]}
                      rows={tagged}
                      rowKey={(row, index) => row.id ?? index}
                      emptyTitle={tx('noAst')}
                      renderRow={row => (
                        <>
                          <td>
                            <strong>{row.drug}</strong>
                          </td>
                          <td>
                            {row.mic != null && row.mic !== ''
                              ? `${row.operator || ''}${row.mic}`
                              : row.zone != null
                                ? `${row.zone} mm`
                                : '—'}
                          </td>
                          <td>
                            <span className={`lab-sir-badge sir-${String(row.sir || '').toLowerCase()}`}>
                              {row.sir || '—'}
                            </span>
                          </td>
                          <td>{row.method || '—'}</td>
                          <td>{[row.standard, row.version].filter(Boolean).join(' ') || '—'}</td>
                        </>
                      )}
                    />
                  </article>
                )
              })}
            </section>
          )}
          {communicationRequired && (
            <section className="lab-record-card lab-communication-card" data-demo-step="microbiology_mdro:communication">
              <SectionHeader
                title={tx('communicationTitle')}
                subtitle={communicationComplete ? null : t('laboratoryRecords.criticalCommunicationRequired')}
                actions={canCommunicate && !locked && (
                  <OverflowMenu
                    items={[
                      {
                        id: 'add-communication',
                        label: tx('addCommunication'),
                        icon: PhoneCall,
                        onClick: openCommunication,
                      },
                    ]}
                  />
                )}
              />
              {communications.length ? (
                <div className="lab-communication-list">
                  {communications.map(row => (
                    <article className="lab-communication-row" key={row.id}>
                      <div>
                        <strong>{row.to || row.recipientName || '—'}</strong>
                        {(row.recipientRole || row.recipientDepartment) && (
                          <span>
                            {[row.recipientRole, row.recipientDepartment]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </div>
                      <div>
                        <span>{fmt(row.at)}</span>
                        <span>{t(row.method)}</span>
                        {row.readBack && (
                          <StatusBadge tone="success">{t('laboratoryRecords.readBack')}</StatusBadge>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="lab-inline-warning">
                  <AlertTriangle size={16} />
                  {tx('noCommunication')}
                </div>
              )}
            </section>
          )}
        </div>
      )}
      {tabId === 'attachments' && (
        <div className="lab-record-stack">
          {!locked && !documentsReviewed && (
            <div className="lab-inline-action">
              <div>
                <strong>{tx('stepDocuments')}</strong>
                <span>{tx('documentsHint')}</span>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  run(() => repository.markDocumentsReviewed(sample.id), tx('documentsDone'))
                }
              >
                <CheckCircle2 size={15} />
                {tx('documents')}
              </Button>
            </div>
          )}
          <div className="lab-attachments-card">
            <EntityAttachmentsPanel
              organizationId={tenant?.id}
              entityType="laboratory_sample"
              entityRecordId={sample.recordId}
              category="laboratory_evidence"
              canManage={canManage && !locked}
              t={t}
              notify={notify}
            />
          </div>
        </div>
      )}
      {tabId === 'history' && <LabHistory sample={sample} t={t} tx={tx} fmt={fmt} />}
    </>
  )
  // The printed report (EntityRecordShell printReport): a document, not the screen.
  const printReport = () =>
    buildLaboratorySampleReport({
      sample,
      steps,
      progress: { result, ast, amr, communications, organisms },
      isEnvironmental,
      standard,
      language,
      t,
      tx,
      fmt,
      statusWord: rejected ? t('rejected') : finalized ? t('completed') : t(sample.status),
      documents: { organizationId: tenant?.id, entityType: 'laboratory_sample', entityId: sample.recordId },
    })
  // «Delete» of the sample (with its results) is made from inside the record, in its «…» menu.
  const sampleDelete = deleteItem({
    createdBy: sample.createdBy,
    table: 'laboratory_samples',
    id: sample.recordId,
    label: sample.id,
    detail: language === 'el' ? sample.patient : sample.patientEn,
    demo: () => repository.remove(sample.id),
    onDone: goBack,
  })
  return (
    <Page fill>
      <EntityRecordShell
        printReport={printReport}
        className="laboratory-record-shell workspace-fill"
        recordNavigation={recordNavigation}
        avatar={<FlaskConical size={20} />}
        eyebrow={sample.id}
        title={sampleTypeLabel(sample.type, t)}
        subtitle={`${sample.subjectName || sample.patient || '—'}${sample.subjectCode || sample.patientId ? ` · ${sample.subjectCode || sample.patientId}` : ''} · ${sample.department || '—'}`}
        status={
          <>
            {/* An environmental point outside its limits needs action whatever the laboratory status says: the header reads as the surveillance list does. */}
            {environmentNeedsAction
              ? <StatusBadge tone="warning">{t('surveillanceList.actionNeeded')}</StatusBadge>
              : rejected || finalized
                ? <Status text={rejected ? t('rejected') : t('completed')} kind={rejected ? 'rejected' : 'completed'} />
                : <Status {...labSampleStatus(sample, language)} />}
            {reviewTag(sample, language) && <StatusBadge tone="neutral">{reviewTag(sample, language)}</StatusBadge>}
          </>
        }
        tabs={tabs}
        activeTab={tab}
        renderTab={renderTab}
        onTabChange={setTab}
        headerActions={<>
          {/* «Επαναδειγματοληψία»: an environmental point outside its limits is sampled again, from the surveillance list's create flow. */}
          {environmentNeedsAction && can(role, CAPABILITIES.CREATE_SURVEILLANCE, membership?.capabilities ?? [], membership?.customCapabilities ?? []) && (
            <Button variant="secondary" title={t('surveillanceList.resampleHelp')} onClick={() => navigate('/surveillance?tab=environmental', { state: { resampleOf: sample } })}>
              <RotateCcw size={15} />{t('surveillanceList.resample')}
            </Button>
          )}
          {/* «Άνοιγμα επεισοδίου»: here only (not also in the menu) — a positive patient sample with no episode, for the infection-control roles. */}
          {canReviewSamples(role) && can(role, CAPABILITIES.CREATE_SURVEILLANCE, membership?.capabilities ?? [], membership?.customCapabilities ?? []) && sample.subjectType === 'patient' && !sample.surveillanceCase && sample.result === 'positive' && (
            <Button variant="secondary" className="sample-open-episode" onClick={() => { const target = sampleEpisodeTarget(sample); navigate(target.path, { state: target.state }) }}>
              <PlayCircle size={15} />{language === 'en' ? 'Open episode' : 'Άνοιγμα επεισοδίου'}
            </Button>
          )}
          <ExportMenu onPrint={() => window.print()} items={[{ id: 'json', kind: 'data', label: 'JSON', onClick: () => downloadRecordJson(sample, { filename: sample.id }) }]} />
        </>}
        onBack={goBack}
        backLabel={inSurveillance ? t('clinicalRecords.backToSurveillance') : t('backToLaboratory')}
      >
        {renderTab(tab)}
      </EntityRecordShell>
      {dialog === 'result' && (
        <ResultDialog
          t={t}
          tx={tx}
          language={language}
          result={result}
          isEnvironmental={isEnvironmental}
          standard={standard}
          libraries={libraries}
          canValidate={canValidate}
          onClose={() => setDialog(null)}
          onSave={draft => run(() => repository.saveResult(sample.id, draft), t('saved'))}
        />
      )}
      {String(dialog || '').startsWith('ast:') && (
        <AstDialog
          tx={tx}
          language={language}
          libraries={libraries}
          organisms={organisms}
          initialOrganism={String(dialog).slice(4)}
          defaultVersion={result?.interpretationVersion || (result?.ast || []).map(row => row.version).find(Boolean) || ''}
          onClose={() => setDialog(null)}
          onSave={draft =>
            run(async () => {
              await repository.addAst(sample.id, result.id, draft)
              signalDemoStep('microbiology_mdro', 'ast')
            }, t('saved'))
          }
        />
      )}
      {String(dialog || '').startsWith('amr:') && (
        <AmrDialog
          tx={tx}
          language={language}
          organism={String(dialog).slice(4)}
          initialClassification={
            amr.filter(row => row.organism === String(dialog).slice(4)).slice(-1)[0]
              ?.classification || ''
          }
          onClose={() => setDialog(null)}
          onSave={draft =>
            run(async () => {
              await repository.saveAmr(sample.id, result.id, draft)
              signalDemoStep('microbiology_mdro', 'amr')
            }, t('saved'))
          }
        />
      )}
      {dialog === 'communication' && (
        <CommunicationDialog
          tx={tx}
          onClose={() => setDialog(null)}
          onSave={draft =>
            run(async () => {
              await repository.communicate(sample.id, result.id, draft)
              signalDemoStep('microbiology_mdro', 'communication')
            }, t('saved'))
          }
        />
      )}
      <GovernedReasonDialog
        open={dialog === 'reject'}
        danger
        title={tx('reject')}
        description={tx('rejectHelp')}
        label={`${tx('rejectReason')} *`}
        confirmLabel={tx('reject')}
        onCancel={() => setDialog(null)}
        onConfirm={reject}
      />
      <GovernedReasonDialog
        open={dialog === 'correction'}
        title={tx('correction')}
        description={tx('correctionHelp')}
        confirmLabel={tx('correction')}
        onCancel={() => setDialog(null)}
        onConfirm={reason =>
          run(() => repository.reopen(sample.id, reason), tx('correction')).then(() =>
            setTab('result'),
          )
        }
      />
    </Page>
  )
}
