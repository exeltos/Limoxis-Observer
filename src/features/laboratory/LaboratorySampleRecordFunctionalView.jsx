import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileClock,
  FileSearch,
  FlaskConical,
  LockKeyhole,
  Microscope,
  Paperclip,
  Pencil,
  PhoneCall,
  PlayCircle,
  Printer,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { EmptyState } from '../../design-system/EmptyState'
import { EntityAttachmentsPanel } from '../../design-system/EntityAttachmentsPanel'
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
import { LaboratoryStatus as Status } from './LaboratoryStatus'
import { LaboratorySampleSummary, LaboratoryWorkflow } from './LaboratorySampleSummary'
import { useLaboratoryRepository } from './hooks/useLaboratoryRepository'
import { loadManagementLibraries } from '../management/managementCloudService'
import { demoLibrarySeed } from '../management/managementData'
import { sampleProgress, workflowStates } from './laboratorySampleProgress'
import { copy } from './laboratorySampleFormat'
import { ResultCard, LabHistory } from './LaboratorySampleViews'
import { ResultDialog, AstDialog, AmrDialog, CommunicationDialog } from './LaboratorySampleDialogs'
import { signalDemoStep } from '../demo/demoScenarioSignals'

export function LaboratorySampleRecordFunctionalView() {
  const { sampleId } = useParams()
  const { t, locale, language } = useLanguage()
  const tx = key => copy[language]?.[key] || copy.en[key] || key
  const { notify } = useFeedback()
  const { role, membership, tenant, isDemo, canAccessRecord } = useTenant()
  const repository = useLaboratoryRepository()
  const { goBack } = useContextualNavigation('/laboratory')
  const recordNavigation = useRecordSequenceNavigation({
    registry: 'laboratory',
    currentId: sampleId,
    pathForId: id => `/laboratory/${id}`,
  })
  const [sample, setSample] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tab, setTab] = useState('sample'),
    [dialog, setDialog] = useState(null),
    [standards, setStandards] = useState([]),
    [libraries, setLibraries] = useState({})
  const has = cap =>
    can(role, cap, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const canManage = has(CAPABILITIES.MANAGE_LAB_SAMPLES),
    canValidate = has(CAPABILITIES.VALIDATE_LAB_RESULTS),
    canCommunicate = has(CAPABILITIES.COMMUNICATE_CRITICAL_RESULTS),
    canReopen = has(CAPABILITIES.REOPEN_LAB_RECORD)
  const fmt = value =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
          new Date(value),
        )
      : '—'
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
  useEffect(() => {
    if (isDemo) {
      setLibraries(demoLibrarySeed)
      return
    }
    if (tenant?.id)
      loadManagementLibraries(tenant.id)
        .then(setLibraries)
        .catch(() => setLibraries({}))
  }, [isDemo, tenant?.id])
  const isEnvironmental =
    sample?.subjectType === 'environment' || ENVIRONMENTAL_CATEGORIES.includes(sample?.type)
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
      { id: 'attachments', label: t('attachments'), icon: Paperclip },
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
  if (loading)
    return (
      <Page title={t('laboratoryRecords.sample')}>
        <div className="inline-empty">{t('loading')}</div>
      </Page>
    )
  if (error || !sample)
    return (
      <Page title={t('laboratoryRecords.sample')}>
        <EmptyState title={t('actionFailed')} description={error || t('noData')} />
      </Page>
    )
  if (!canAccessRecord(sample))
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
  const steps = workflowStates(pending).map(step => ({
    ...step,
    hint:
      step.action || step.state !== 'next'
        ? step.hint
        : `${step.hint} — ${tx('awaitingPermission')}`,
  }))
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
    canManageActive &&
      received && {
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
    {
      id: 'print',
      label: tx('print'),
      icon: Printer,
      separatorBefore: canManageActive || (finalized && canReopen),
      onClick: () => window.print(),
    },
    {
      id: 'export',
      label: tx('export'),
      icon: Download,
      onClick: () => downloadRecordJson(sample, { filename: sample.id }),
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

  return (
    <Page fill>
      <EntityRecordShell
        className="laboratory-record-shell workspace-fill"
        recordNavigation={recordNavigation}
        avatar={<FlaskConical size={20} />}
        eyebrow={sample.id}
        title={sampleTypeLabel(sample.type, t)}
        subtitle={`${sample.subjectName || sample.patient || '—'}${sample.subjectCode || sample.patientId ? ` · ${sample.subjectCode || sample.patientId}` : ''} · ${sample.department || '—'}`}
        status={
          <Status
            text={rejected ? t('rejected') : finalized ? t('completed') : t(sample.status)}
            kind={rejected ? 'rejected' : finalized ? 'completed' : sample.status}
          />
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        onBack={goBack}
        backLabel={t('backToLaboratory')}
      >
        {tab === 'sample' && (
          <div className="lab-record-stack">
            <LaboratoryWorkflow steps={steps} language={language} closedNote={closedNote} />
            <LaboratorySampleSummary
              sample={sample}
              t={t}
              language={language}
              fmt={fmt}
              menu={<OverflowMenu items={sampleMenu} />}
            />
          </div>
        )}
        {tab === 'result' && (
          <div className="lab-record-stack">
            <ResultCard
              t={t}
              tx={tx}
              language={language}
              result={result}
              organisms={organisms}
              isEnvironmental={isEnvironmental}
              standard={standard}
              menu={
                <OverflowMenu
                  items={[
                    canManageActive &&
                      received && {
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
                <div className="record-section-header">
                  <div>
                    <span className="eyebrow">{tx('organisms')}</span>
                    <h3>
                      <ShieldAlert size={15} />{' '}
                      {language === 'el' ? 'Αντιβιόγραμμα και AMR' : 'AST and AMR'}
                    </h3>
                  </div>
                </div>
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
                          {current && (
                            <span className="status-badge danger">{current.classification}</span>
                          )}
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
                      <div className="record-table-wrap">
                        <table className="record-table lab-ast-table">
                          <thead>
                            <tr>
                              <th>{tx('antibiotic')}</th>
                              <th>MIC</th>
                              <th>S/I/R</th>
                              <th>{tx('method')}</th>
                              <th>{tx('standard')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tagged.length ? (
                              tagged.map(row => (
                                <tr key={row.id}>
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
                                    <span
                                      className={`lab-sir-badge sir-${String(row.sir || '').toLowerCase()}`}
                                    >
                                      {row.sir || '—'}
                                    </span>
                                  </td>
                                  <td>{row.method || '—'}</td>
                                  <td>
                                    {[row.standard, row.version].filter(Boolean).join(' ') || '—'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="5" className="lab-table-empty">
                                  {tx('noAst')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )
                })}
              </section>
            )}
            {communicationRequired && (
              <section className="lab-record-card lab-communication-card" data-demo-step="microbiology_mdro:communication">
                <div className="record-section-header">
                  <div>
                    <span className="eyebrow">
                      {communicationComplete
                        ? tx('critical')
                        : t('laboratoryRecords.criticalCommunicationRequired')}
                    </span>
                    <h3>
                      <PhoneCall size={15} /> {tx('communicationTitle')}
                    </h3>
                  </div>
                  {canCommunicate && !locked && (
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
                </div>
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
                            <span className="status-badge active">
                              {t('laboratoryRecords.readBack')}
                            </span>
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
        {tab === 'attachments' && (
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
        {tab === 'history' && (
          <section className="lab-record-card">
            <div className="record-section-header">
              <div>
                <span className="eyebrow">{t('laboratoryRecords.sample')}</span>
                <h3>
                  <FileClock size={15} /> {t('history')}
                </h3>
              </div>
            </div>
            <LabHistory sample={sample} t={t} tx={tx} fmt={fmt} />
          </section>
        )}
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
