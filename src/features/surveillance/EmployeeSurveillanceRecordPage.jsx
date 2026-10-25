import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ClipboardList, FileClock, FolderOpen, Pencil, Trash2, UserRound, XCircle } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { ActionButton } from '../../design-system/ActionButton'
import { ExportMenu } from '../../design-system/ExportMenu'
import { DetailList } from '../../design-system/DetailList'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { HistoryTimeline } from '../../design-system/HistoryTimeline'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RouteLoading } from '../../design-system/RouteLoading'
import { EmptyState } from '../../design-system/EmptyState'
import { StatusBadge } from '../../design-system/StatusBadge'
import { YesNoField } from '../../design-system/YesNoField'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { FormSubmit, useFormValidation } from '../../design-system/FormValidation'
import { formatDay } from '../../core/i18n/formatDay'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { Button } from '../../design-system/Button'
import { binMemoryRow } from '../../core/recycleBin/recycleBinService'
import { useRecordDelete } from '../recycle-bin/useRecordDelete'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { downloadRecordJson } from '../../core/export/recordExport'
import { laboratorySamples as demoLaboratorySamples } from '../laboratory/laboratoryDemoData'
import { loadEmployeeSurveillanceSamples, sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import {
  cancelLaboratoryRequest,
  deleteLaboratoryRequest,
  laboratoryRequestEditable,
  updateLaboratoryRequest,
} from '../laboratory/laboratoryRequestManagementService'
import { employeeSurveillanceRecords, removeDemoEmployeeSurveillance, updateEmployeeSurveillanceRecord } from './employeeSurveillanceData'
import {
  loadEmployeeSurveillanceRecords,
  updateEmployeeSurveillanceFollowup,
} from './employeeSurveillanceCloudService'
import {
  REQUEST_MATERIALS,
  compactCode,
  hasFollowup,
  hasPositiveHistory,
  isPositive,
  materialLabels,
  splitMaterials,
  toggleMaterial,
} from './EmployeeSurveillanceRecordDialog'
import { employeeScreeningLabel, priorityOptions, statusTone } from './surveillanceOptions'
import { surveillanceTabAccess } from './surveillanceTabAccess'
import { EmployeeExposureSection } from './EmployeeExposureSection'
import './employeeLabRequest.css'

// A staff screening opened from the «Εργαζόμενοι» list of the Surveillance
// Center: a record page like the episode's (shared EntityRecordShell, DetailList,
// tabs Summary · Documents · History), instead of a window. The follow-up
// (intervention, recheck) is recorded from the one header button.
export function EmployeeSurveillanceRecordPage() {
  const { recordId } = useParams()
  const { t, language } = useLanguage()
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const { notify, notifyError, confirm } = useFeedback()
  const { tenant, isDemo, role, actualRole, membership, canSeeSensitiveEmployeeHealth } = useTenant()
  const { goBack } = useContextualNavigation('/surveillance')
  const deleteItem = useRecordDelete()
  const recordNavigation = useRecordSequenceNavigation({
    registry: 'surveillance-employees',
    currentId: recordId,
    pathForId: id => `/surveillance/staff/${id}`,
  })
  const fmt = value => formatDay(value, language)
  const [record, setRecord] = useState(null)
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('summary')
  const [followupOpen, setFollowupOpen] = useState(false)
  const [requestEditor, setRequestEditor] = useState(null)
  const [requestSaving, setRequestSaving] = useState(false)
  const recordRef = useRef(null)
  recordRef.current = record
  const organizationId = tenant?.id
  const { employees: allowed } = surveillanceTabAccess({ role, actualRole, canSeeSensitiveEmployeeHealth })
  const has = capability => can(role, capability, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const canManageFollowup = isDemo || has(CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH)
  const canManageLab = !isDemo && has(CAPABILITIES.MANAGE_LAB_SAMPLES)

  const loadSamples = useCallback(
    async row => {
      if (!row) return setSamples([])
      if (isDemo) return setSamples(demoLaboratorySamples.filter(sample => sample.employeeSurveillanceCase === row.id))
      if (!organizationId || !row.recordId) return setSamples([])
      try {
        const rows = await loadEmployeeSurveillanceSamples(organizationId, [row.recordId])
        setSamples((rows || []).filter(sample => sample.employeeSurveillanceId === row.recordId))
      } catch (error) {
        setSamples([])
        notifyError(error, 'load', { operation: 'employee_surveillance_laboratory_load' })
      }
    },
    [isDemo, organizationId, notifyError],
  )

  useEffect(() => {
    let alive = true
    async function read() {
      try {
        const rows = isDemo
          ? employeeSurveillanceRecords
          : organizationId
            ? await loadEmployeeSurveillanceRecords(organizationId)
            : []
        const found = rows.find(row => String(row.recordId || row.id) === String(recordId)) || null
        if (!alive) return
        setRecord(found ? { ...found } : null)
        await loadSamples(found)
      } catch (error) {
        if (alive) notifyError(error, 'load', { operation: 'employee_surveillance_record_load' })
      } finally {
        if (alive) setLoading(false)
      }
    }
    setLoading(true)
    void read()
    return () => {
      alive = false
    }
  }, [recordId, isDemo, organizationId, loadSamples, notifyError])

  const followupEligible = Boolean(
    record && (isPositive(record) || record.resultStatus === 'cleared' || hasFollowup(record) || hasPositiveHistory(samples)),
  )
  const resultKnown = Boolean(
    record &&
      (['negative', 'positive', 'cleared'].includes(record.resultStatus) ||
        samples.some(sample => sample.result && (sample.finalizedAt || sample.resultStatus === 'validated'))),
  )
  const currentRecheck = record?.recheckDue || record?.recheckDate || ''

  const tabs = useMemo(
    () => [
      { id: 'summary', label: t('summary'), icon: ClipboardList },
      { id: 'attachments', label: t('documents'), icon: FolderOpen },
      { id: 'history', label: t('history'), icon: FileClock },
    ],
    [t],
  )

  async function saveFollowup(patch) {
    const stamped = { ...patch, updatedAt: new Date().toISOString() }
    const updated = isDemo
      ? await Promise.resolve(updateEmployeeSurveillanceRecord(record.id, stamped))
      : await updateEmployeeSurveillanceFollowup(organizationId, record, patch)
    setRecord({ ...updated })
    setFollowupOpen(false)
    notify(L('Η παρακολούθηση αποθηκεύτηκε.', 'Follow-up saved.'), 'success')
  }
  async function saveRequest() {
    if (!requestEditor || requestSaving) return
    setRequestSaving(true)
    try {
      await updateLaboratoryRequest(organizationId, requestEditor.sample.recordId, {
        source: requestEditor.source,
        priority: requestEditor.priority,
        sampleType: requestEditor.sampleType,
      })
      await loadSamples(recordRef.current)
      setRequestEditor(null)
      notify(L('Το αίτημα εργαστηρίου ενημερώθηκε.', 'Laboratory request updated.'), 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'employee_laboratory_request_update' })
    } finally {
      setRequestSaving(false)
    }
  }
  async function cancelRequest(sample) {
    const ok = await confirm({
      title: L('Ακύρωση αιτήματος εργαστηρίου', 'Cancel laboratory request'),
      message: L('Το εκκρεμές αίτημα θα ακυρωθεί.', 'The pending request will be cancelled.'),
      confirmLabel: L('Ακύρωση αιτήματος', 'Cancel request'),
      danger: true,
    })
    if (!ok) return
    try {
      await cancelLaboratoryRequest(organizationId, sample.recordId)
      await loadSamples(recordRef.current)
      notify(L('Το αίτημα εργαστηρίου ακυρώθηκε.', 'Laboratory request cancelled.'), 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'employee_laboratory_request_cancel' })
    }
  }
  async function deleteRequest(sample) {
    const ok = await confirm({
      title: L('Διαγραφή αιτήματος εργαστηρίου', 'Delete laboratory request'),
      message: L(
        'Να διαγραφεί οριστικά το αίτημα; Επιτρέπεται μόνο πριν το παραλάβει το Εργαστήριο ή καταχωρηθεί αποτέλεσμα.',
        'Delete this request permanently? This is only allowed before Laboratory receives it or records a result.',
      ),
      confirmLabel: L('Διαγραφή', 'Delete'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteLaboratoryRequest(organizationId, sample.recordId)
      await loadSamples(recordRef.current)
      notify(L('Το αίτημα εργαστηρίου διαγράφηκε.', 'Laboratory request deleted.'), 'success')
    } catch (error) {
      notifyError(error, 'delete', { operation: 'employee_laboratory_request_delete' })
    }
  }

  if (loading) return <RouteLoading />
  if (!allowed)
    return (
      <Page title={t('employee')}>
        <EmptyState title={t('scopeAccessDeniedTitle')} description={t('scopeAccessDeniedDescription')} />
      </Page>
    )
  if (!record)
    return (
      <Page title={t('employee')}>
        <EmptyState title={t('actionFailed')} description={t('noData')} />
      </Page>
    )

  const name = en ? record.employeeNameEn || record.employeeName : record.employeeName
  const department = en ? record.departmentEn || record.department : record.department
  const screening = (record.screeningTypes || []).map(id => employeeScreeningLabel(id, language)).join(', ')
  const resultStatus = record.resultStatus || 'pending'
  // «Delete» of the screening (with its requests and results) is made from inside the record.
  const screeningDelete = deleteItem({
    createdBy: record.createdBy,
    table: 'employee_surveillance_records',
    id: record.recordId,
    label: name,
    detail: record.id,
    demo: async () => {
      const removed = removeDemoEmployeeSurveillance(record.id)
      if (removed) await binMemoryRow(null, { module: 'clinical', kind: 'employee_surveillance_records', label: name, detail: record.id, store: 'employee_surveillance', row: removed })
    },
    onDone: goBack,
  })
  const statusBadge = (
    <StatusBadge tone={statusTone(record.status === 'active' ? resultStatus : record.status)}>
      {t(record.status === 'active' ? resultStatus : record.status)}
    </StatusBadge>
  )
  const interventionText = record.noIntervention
    ? L('Δεν προγραμματίστηκε παρέμβαση', 'No intervention planned')
    : record.interventionType || record.intervention || ''
  const recheckText = record.noRecheck
    ? L('Δεν προγραμματίστηκε επανέλεγχος', 'No recheck planned')
    : currentRecheck
      ? fmt(currentRecheck)
      : ''
  const steps = followupEligible
    ? [
        { label: L('Θετικό αποτέλεσμα', 'Positive result'), state: 'done', note: L('Ολοκληρώθηκε', 'Completed') },
        { label: L('Παρέμβαση', 'Intervention'), state: hasFollowup(record) ? 'done' : 'current', note: L('Προαιρετικό', 'Optional') },
        { label: L('Επανέλεγχος', 'Recheck'), state: currentRecheck || record.noRecheck ? 'done' : '', note: L('Προαιρετικό', 'Optional') },
        {
          label: L('Έκβαση', 'Outcome'),
          state: record.resultStatus === 'cleared' ? 'done' : '',
          note: record.resultStatus === 'cleared' ? L('Ολοκληρώθηκε', 'Completed') : L('Ανοιχτό', 'Open'),
        },
      ]
    : []

  const sampleRows = samples.map(sample => {
    const editable = canManageLab && laboratoryRequestEditable(sample)
    const actions = editable
      ? [
          { id: 'edit', label: L('Επεξεργασία αιτήματος', 'Edit request'), icon: Pencil, onClick: () => setRequestEditor({ sample, source: sample.source || '', priority: sample.priority || 'routine', sampleType: sample.type || 'surveillance' }) },
          { id: 'cancel', label: L('Ακύρωση αιτήματος', 'Cancel request'), icon: XCircle, onClick: () => cancelRequest(sample) },
          { id: 'delete', label: L('Διαγραφή αιτήματος', 'Delete request'), icon: Trash2, tone: 'danger', separatorBefore: true, onClick: () => deleteRequest(sample) },
        ]
      : []
    return (
      <div key={sample.recordId || sample.id} className="employee-sample-row">
        <div className="employee-sample-main">
          <strong className="employee-code-compact" title={sample.id}>{compactCode(sample.id)}</strong>
          <span>
            {sampleTypeLabel(sample.type, t)}
            {sample.source ? ` · ${materialLabels(sample.source, en)}` : ''}
          </span>
        </div>
        <div className="employee-lab-actions">
          <StatusBadge tone={sample.result === 'negative' ? 'success' : 'neutral'}>
            {sample.result ? t(sample.result) : t(sample.status)}
          </StatusBadge>
          {sample.organism && <small>{sample.organism}</small>}
          {actions.length > 0 && <OverflowMenu label={L('Ενέργειες αιτήματος εργαστηρίου', 'Laboratory request actions')} items={actions} />}
        </div>
      </div>
    )
  })

  const history = [
    record.startedAt && { at: record.startedAt, title: L('Έναρξη επιτήρησης', 'Surveillance started') },
    ...samples.flatMap(sample => [
      sample.collectedAt && { at: sample.collectedAt, title: `${L('Λήψη δείγματος', 'Sample collected')} · ${compactCode(sample.id)}` },
      (sample.resultedAt || sample.finalizedAt) && {
        at: sample.resultedAt || sample.finalizedAt,
        title: `${L('Αποτέλεσμα', 'Result')} · ${sample.result ? t(sample.result) : t(sample.status)}`,
      },
    ]),
    ...(record.timeline || []).map(entry => entry?.at && { at: entry.at, title: entry.type === 'employeeFollowupCorrected' ? L('Διόρθωση παρακολούθησης', 'Follow-up corrected') : L('Καταγραφή παρακολούθησης', 'Follow-up recorded'), detail: entry.detail }),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at) - new Date(a.at))

  const renderTab = tabId => (
    <>
      {tabId === 'summary' && (
        <div className="record-section employee-record-page-summary">
          <DetailList
            sections={[
              {
                title: L('Έλεγχος', 'Screening'),
                items: [
                  { label: L('Εργαζόμενος', 'Employee'), value: name },
                  { label: L('Κωδικός', 'Code'), value: record.employeeId },
                  { label: L('Τμήμα', 'Department'), value: department },
                  { label: L('Έναρξη', 'Started'), value: fmt(record.startedAt) },
                  { label: L('Τύπος ελέγχου', 'Screening type'), value: screening },
                  { label: L('Αποτέλεσμα', 'Result'), value: t(resultStatus) },
                ],
              },
              followupEligible && {
                title: L('Παρέμβαση & επανέλεγχος', 'Intervention & recheck'),
                items: [
                  { label: L('Παρέμβαση', 'Intervention'), value: interventionText },
                  { label: L('Λεπτομέρειες', 'Details'), value: record.interventionType ? record.intervention : '' },
                  { label: L('Έναρξη παρέμβασης', 'Intervention start'), value: record.interventionStart ? fmt(record.interventionStart) : '' },
                  { label: L('Λήξη παρέμβασης', 'Intervention end'), value: record.interventionEnd ? fmt(record.interventionEnd) : '' },
                  { label: L('Επανέλεγχος', 'Recheck'), value: recheckText },
                ],
                collapseMissing: true,
              },
            ]}
          />
          {steps.length > 0 && (
            <div className="employee-screening-flow">
              {steps.map((step, index) => (
                <div key={step.label} className={`screening-flow-step ${step.state}`.trim()}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{step.label}</strong>
                  <small>{step.note}</small>
                </div>
              ))}
            </div>
          )}
          <section className="employee-record-section">
            <div className="followup-section-title">
              <strong>{L('Εργαστηριακά αποτελέσματα', 'Laboratory results')}</strong>
              <span>{L('Το εργαστήριο είναι η πηγή για τα αποτελέσματα. Τα εκκρεμή αιτήματα διορθώνονται πριν την παραλαβή.', 'Laboratory is the source for results. Pending requests can be corrected before receipt.')}</span>
            </div>
            <div className="employee-sample-list">
              {sampleRows.length ? sampleRows : <div className="inline-empty">{L('Δεν υπάρχουν εργαστηριακά δείγματα για αυτόν τον έλεγχο.', 'No laboratory samples for this screening yet.')}</div>}
            </div>
          </section>
          <EmployeeExposureSection record={record} department={department} />
          {!followupEligible && (
            <div className="source-truth-note employee-record-note">
              {resultKnown
                ? L('Αυτός ο έλεγχος δεν απαιτεί παρακολούθηση.', 'This screening does not require follow-up.')
                : L('Αναμένεται το εργαστηριακό αποτέλεσμα. Η ανάγκη παρακολούθησης κρίνεται μετά την επικύρωσή του.', 'Awaiting the laboratory result. Follow-up is decided once the result is validated.')}
            </div>
          )}
        </div>
      )}
      {tabId === 'attachments' && (
        <DocumentsWorkspace
          title={t('documents')}
          disabled={!canManageFollowup}
          organizationId={isDemo ? null : organizationId}
          entityType="employee_surveillance"
          entityId={record.recordId || record.id}
          categories={[
            ['medicalReport', L('Ιατρική γνωμάτευση', 'Medical report')],
            ['laboratoryDocument', L('Εργαστηριακό έγγραφο', 'Laboratory document')],
            ['generalDocument', L('Γενικό έγγραφο', 'General document')],
          ]}
        />
      )}
      {tabId === 'history' && (
        <HistoryTimeline title={t('history')} events={history} when={fmt} emptyText={t('noData')} />
      )}
    </>
  )

  const printReport = () => ({
    kind: L('Έλεγχος εργαζομένου', 'Employee screening'),
    code: compactCode(record.id),
    title: name,
    subtitle: [record.employeeId, department].filter(Boolean).join(' · '),
    statusLabel: L('Αποτέλεσμα', 'Result'),
    status: t(resultStatus),
    summaryText: `${L('Έλεγχος', 'Screening')}: ${screening || '—'}. ${L('Αποτέλεσμα', 'Result')}: ${t(resultStatus)}.`,
    sections: [
      {
        id: 'screening',
        title: L('Στοιχεία ελέγχου', 'Screening details'),
        pairs: [
          [L('Εργαζόμενος', 'Employee'), name],
          [L('Κωδικός', 'Code'), record.employeeId],
          [L('Τμήμα', 'Department'), department],
          [L('Έναρξη', 'Started'), fmt(record.startedAt)],
          [L('Τύπος ελέγχου', 'Screening type'), screening],
          [L('Αποτέλεσμα', 'Result'), t(resultStatus)],
        ],
      },
      {
        id: 'followup',
        title: L('Παρέμβαση & επανέλεγχος', 'Intervention & recheck'),
        pairs: [
          [L('Παρέμβαση', 'Intervention'), interventionText],
          [L('Λεπτομέρειες', 'Details'), record.interventionType ? record.intervention : ''],
          [L('Επανέλεγχος', 'Recheck'), recheckText],
        ],
      },
      {
        id: 'samples',
        title: L('Εργαστηριακά αποτελέσματα', 'Laboratory results'),
        list: samples.map(sample => [compactCode(sample.id), sampleTypeLabel(sample.type, t), sample.result ? t(sample.result) : t(sample.status), sample.organism].filter(Boolean).join(' · ')),
      },
      { id: 'documents', title: L('Έγγραφα', 'Documents'), documents: { organizationId: isDemo ? null : organizationId, entityType: 'employee_surveillance', entityId: record.recordId || record.id } },
      { id: 'history', title: L('Ιστορικό', 'History'), events: history.map(event => ({ when: fmt(event.at), sort: String(event.at), title: event.title, detail: event.detail })), keep: true },
    ],
  })

  const followupLabel = hasFollowup(record) ? L('Επεξεργασία παρακολούθησης', 'Edit follow-up') : L('Καταγραφή παρακολούθησης', 'Record follow-up')
  return (
    <Page fill>
      <EntityRecordShell
        className="workspace-fill"
        printReport={printReport}
        recordNavigation={recordNavigation}
        avatar={<UserRound size={20} />}
        eyebrow={compactCode(record.id)}
        title={name}
        subtitle={[record.employeeId, department].filter(Boolean).join(' · ')}
        status={statusBadge}
        tabs={tabs}
        activeTab={tab}
        renderTab={renderTab}
        onTabChange={setTab}
        headerActions={
          <>
            {screeningDelete && <Button tone="danger" label={t('clinicalRecords.deleteEmployeeScreening')} onClick={screeningDelete.onClick} />}
            {canManageFollowup && followupEligible && (
              <ActionButton tone={hasFollowup(record) ? 'edit' : 'primary'} label={followupLabel} onClick={() => setFollowupOpen(true)}>
                {hasFollowup(record) ? <Pencil size={15} /> : <CheckCircle2 size={15} />}
                <span>{followupLabel}</span>
              </ActionButton>
            )}
            <ExportMenu
              onPrint={() => window.print()}
              items={[{ id: 'json', kind: 'data', label: 'JSON', onClick: () => downloadRecordJson(record, { filename: record.id }) }]}
            />
          </>
        }
        onBack={goBack}
        backLabel={t('clinicalRecords.backToSurveillance')}
      >
        {renderTab(tab)}
      </EntityRecordShell>
      {followupOpen && <FollowupDialog record={record} language={language} fmtLabel={followupLabel} onClose={() => setFollowupOpen(false)} onSave={saveFollowup} />}
      {requestEditor && (
        <RequestDialog
          editor={requestEditor}
          saving={requestSaving}
          language={language}
          onChange={setRequestEditor}
          onClose={() => !requestSaving && setRequestEditor(null)}
          onSave={saveRequest}
        />
      )}
    </Page>
  )
}

// Intervention and recheck: a small window as tall as its fields; a change to an
// existing follow-up needs its reason.
function FollowupDialog({ record, language, fmtLabel, onClose, onSave }) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const { notifyError } = useFeedback()
  const [saving, setSaving] = useState(false)
  const [intervention, setIntervention] = useState(record.intervention || '')
  const [interventionType, setInterventionType] = useState(record.interventionType || '')
  const [interventionStart, setInterventionStart] = useState(record.interventionStart || '')
  const [interventionEnd, setInterventionEnd] = useState(record.interventionEnd || '')
  const [noIntervention, setNoIntervention] = useState(Boolean(record.noIntervention))
  const [recheckDate, setRecheckDate] = useState(record.recheckDue || record.recheckDate || '')
  const [noRecheck, setNoRecheck] = useState(Boolean(record.noRecheck))
  const [correctionReason, setCorrectionReason] = useState('')
  const current = record.recheckDue || record.recheckDate || ''
  const changed =
    hasFollowup(record) &&
    ((record.intervention || '') !== intervention.trim() ||
      (record.interventionType || '') !== interventionType ||
      (record.interventionStart || '') !== interventionStart ||
      (record.interventionEnd || '') !== interventionEnd ||
      Boolean(record.noIntervention) !== noIntervention ||
      current !== recheckDate ||
      Boolean(record.noRecheck) !== noRecheck)
  const form = useFormValidation([
    changed && {
      key: 'correctionReason',
      label: L('Αιτιολογία διόρθωσης', 'Correction reason'),
      valid: Boolean(correctionReason.trim()),
    },
  ])
  async function save() {
    setSaving(true)
    try {
      await onSave({
        intervention,
        interventionType,
        interventionStart,
        interventionEnd,
        noIntervention,
        recheckDue: recheckDate,
        recheckDate,
        noRecheck,
        correctionReason,
      })
    } catch (error) {
      notifyError(error, 'save', { operation: 'employee_surveillance_followup_update' })
      setSaving(false)
    }
  }
  return (
    <ObserverDialog
      width="standard"
      eyebrow={L('Παρακολούθηση', 'Follow-up')}
      title={fmtLabel}
      subtitle={L('Προαιρετική· μπορεί να διορθωθεί αργότερα με αιτιολόγηση.', 'Optional; it can be corrected later with a reason.')}
      onClose={onClose}
      footer={
        <FormSubmit form={form} disabled={saving} loading={saving} onSubmit={save}>
          {L('Αποθήκευση', 'Save')}
        </FormSubmit>
      }
    >
      <div className="employee-followup-edit-grid" ref={form.scopeRef}>
        <YesNoField
          className="entry-span-2 followup-choice-row"
          label={L('Προγραμματίζεται παρέμβαση', 'Intervention planned')}
          value={!noIntervention}
          onChange={planned => {
            setNoIntervention(!planned)
            if (!planned) {
              setIntervention('')
              setInterventionType('')
              setInterventionStart('')
              setInterventionEnd('')
            }
          }}
        />
        {!noIntervention && (
          <>
            <Field label={L('Τύπος παρέμβασης', 'Intervention type')}>
              <input value={interventionType} onChange={e => setInterventionType(e.target.value)} />
            </Field>
            <Field label={L('Λεπτομέρειες παρέμβασης', 'Intervention details')}>
              <input value={intervention} onChange={e => setIntervention(e.target.value)} />
            </Field>
            <ManualDateField className="field" label={L('Έναρξη', 'Start')} value={interventionStart} onChange={setInterventionStart} />
            <ManualDateField className="field" label={L('Λήξη', 'End')} value={interventionEnd} onChange={setInterventionEnd} />
          </>
        )}
        <YesNoField
          className="entry-span-2 followup-choice-row"
          label={L('Προγραμματίζεται επανέλεγχος', 'Recheck planned')}
          value={!noRecheck}
          onChange={planned => {
            setNoRecheck(!planned)
            if (!planned) setRecheckDate('')
          }}
        />
        {!noRecheck && (
          <div className="entry-span-2">
            <ManualDateField className="field" label={L('Ημερομηνία επανελέγχου', 'Recheck date')} value={recheckDate} onChange={setRecheckDate} />
          </div>
        )}
        {changed && (
          <div className="entry-span-2">
            <Field label={L('Αιτιολογία διόρθωσης', 'Correction reason')} {...form.field('correctionReason')}>
              <textarea rows="2" value={correctionReason} onChange={e => setCorrectionReason(e.target.value)} />
            </Field>
          </div>
        )}
      </div>
    </ObserverDialog>
  )
}

function RequestDialog({ editor, saving, language, onChange, onClose, onSave }) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const form = useFormValidation([
    { key: 'source', label: L('Ζητούμενος έλεγχος / υλικό', 'Requested examination / material'), valid: splitMaterials(editor.source).length > 0 },
  ])
  return (
    <ObserverDialog
      width="standard"
      eyebrow={L('Αίτημα εργαστηρίου', 'Laboratory request')}
      title={compactCode(editor.sample.id)}
      subtitle={L('Διορθώσεις επιτρέπονται μόνο όσο το αίτημα είναι εκκρεμές και δεν έχει αποτέλεσμα.', 'Corrections are allowed only while the request is pending and has no result.')}
      onClose={onClose}
      footer={
        <FormSubmit form={form} disabled={saving} loading={saving} onSubmit={onSave}>
          {L('Αποθήκευση αλλαγών', 'Save changes')}
        </FormSubmit>
      }
    >
      <div className="employee-lab-request-editor" ref={form.scopeRef}>
        <div className="entry-span-2 lab-request-materials" data-field-key="source">
          <ChoiceChips
            label={L('Ζητούμενος έλεγχος / υλικό', 'Requested examination / material')}
            options={REQUEST_MATERIALS.map(item => ({ value: item.id, label: en ? item.en : item.el }))}
            selected={splitMaterials(editor.source)}
            onToggle={id => onChange(value => ({ ...value, source: toggleMaterial(value.source, id) }))}
          />
          {form.errorFor('source') && <span className="field-error">{form.errorFor('source')}</span>}
        </div>
        <ChoiceField
          label={L('Τύπος αιτήματος', 'Request type')}
          value={editor.sampleType}
          onChange={value => onChange(v => ({ ...v, sampleType: value }))}
          options={[
            { value: 'surveillance', label: L('Επιτήρηση', 'Surveillance') },
            { value: 'screening', label: L('Προληπτικός έλεγχος', 'Screening') },
            { value: 'other', label: L('Άλλο', 'Other') },
          ]}
        />
        <ChoiceField label={L('Προτεραιότητα', 'Priority')} value={editor.priority} onChange={value => onChange(v => ({ ...v, priority: value }))} options={priorityOptions(language)} />
      </div>
    </ObserverDialog>
  )
}
