import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, ClipboardList, Droplets, FileClock, FolderOpen, Pencil, Recycle, ShieldCheck, Trash2 } from 'lucide-react'
import './preventionRecordMenu.css'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { HistoryTimeline } from '../../design-system/HistoryTimeline'
import { formatDayTime } from '../../core/i18n/formatDay'
import { ExportMenu } from '../../design-system/ExportMenu'
import { downloadRecordJson } from '../../core/export/recordExport'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { WhoHandHygieneEditor } from './WhoHandHygieneEditor'
import { WasteEntryEditor } from './WasteEntryEditor'
import { AntisepticEntryEditor } from './AntisepticEntryEditor'
import { BundleExecutionEditor } from './BundleExecutionEditor'
import { BundleFollowUpDialog } from './BundleFollowUpDialog'
import {
  deleteHandHygieneSession,
  loadHandHygieneDepartments,
  loadHandHygieneSessions,
  saveHandHygieneSession,
} from './handHygieneCloudService'
import { signalDemoScenario } from '../demo/demoScenarioSignals'
import {
  deleteWasteMeasurement,
  findWastePatientDays,
  loadWasteMeasurements,
  loadWasteSupportData,
  saveWasteMeasurement,
} from './wasteCloudService'
import {
  deleteAntisepticRecord,
  findPatientDaysForPeriod,
  loadAntisepticRecords,
  loadAntisepticSupportData,
  saveAntisepticRecord,
} from './antisepticCloudService'
import {
  deleteBundleAssessment,
  loadBundleAssessments,
  loadBundleSupportData,
  saveBundleAssessment,
  saveBundleFollowUp,
} from './bundleCloudService'
import { useTenant } from '../../core/tenant/TenantContext'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { wasteCategoryTone, wastePeriodLabel } from './wasteVisuals'
import { ActionButton } from '../../design-system/ActionButton'
import { isAbhrProduct } from './antisepticMethods'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { CAPABILITIES, ROLES, can } from '../../core/permissions/roles'
import { AntisepticDetails, BundleDetails, HandHygieneDetails, formatMonth } from './PreventionRecordDetails'
import type { RecordNavigation } from '../../design-system/EntityRecordShell'
import type { AntisepticRecord, BundleAssessmentDraft, BundleFinding, BundleFollowUp, HandHygieneSession, PreventionDraft, PreventionRecord, PreventionTabRow, WasteMeasurement } from './preventionTypes'
import type { WasteSupport } from './wasteCloudService'
import type { AntisepticSupport } from './antisepticCloudService'
import type { BundleSupport } from './bundleCloudService'
import type { PreventionDepartment, PreventionOrgId } from './preventionCloud'

export { bundleFollowUpTone } from './PreventionRecordDetails'

const icons: Record<string, typeof ShieldCheck> = {
  handHygiene: ShieldCheck,
  waste: Recycle,
  antiseptics: Droplets,
  bundles: ClipboardCheck,
}
const loaders: Record<string, (organizationId: PreventionOrgId) => Promise<PreventionRecord[]>> = {
  handHygiene: loadHandHygieneSessions,
  waste: loadWasteMeasurements,
  antiseptics: loadAntisepticRecords,
  bundles: loadBundleAssessments,
}
const deleters: Record<string, (organizationId: PreventionOrgId, id: string) => Promise<unknown>> = {
  handHygiene: deleteHandHygieneSession,
  waste: deleteWasteMeasurement,
  antiseptics: deleteAntisepticRecord,
  bundles: deleteBundleAssessment,
}
const editCapabilities: Record<string, string> = {
  handHygiene: CAPABILITIES.RECORD_HAND_HYGIENE,
  waste: CAPABILITIES.RECORD_WASTE,
  antiseptics: CAPABILITIES.RECORD_ANTISEPTIC,
  bundles: CAPABILITIES.RECORD_PREVENTION_BUNDLE,
}

export function PreventionRecordPage() {
  // The route always names both (/prevention/:recordType/:recordId).
  const { recordType, recordId } = useParams() as { recordType: string; recordId: string }
  const navigate = useNavigate()
  const location = useLocation()
  // A check opened from a device of an episode (Φόρμες & ερωτηματολόγια): it returns there.
  const episodeBundle = recordType === 'bundles' ? location.state?.episodeBundle || null : null
  const [searchParams] = useSearchParams()
  const { locale, language } = useLanguage()
  const en = language === 'en'
  const { notifyError, notify, confirm } = useFeedback()
  const { canAccessRecord, tenant, role, membership, isDemo } = useTenant()
  // The record of the route's type; one state serves the four types (each part reads its own fields).
  // Every record has its documents and history, as in the other modules.
  const [recordTab, setRecordTab] = useState('details')
  const supportsPageEditor = ['handHygiene', 'waste', 'antiseptics', 'bundles'].includes(recordType)
  const creating = supportsPageEditor && recordId === 'new'
  const editing = supportsPageEditor && !creating && searchParams.get('edit') === '1'
  const [record, setRecord] = useState<PreventionTabRow | null>(null)
  const [loading, setLoading] = useState(!creating)
  const [handDepartments, setHandDepartments] = useState<PreventionDepartment[]>([])
  const [wasteSupport, setWasteSupport] = useState<WasteSupport>({ departments: [], wasteTypes: [] })
  const [antisepticSupport, setAntisepticSupport] = useState<AntisepticSupport>({ departments: [], products: [] })
  const [bundleSupport, setBundleSupport] = useState<BundleSupport>({ departments: [], templates: [] })
  const [bundleFollowUpItem, setBundleFollowUpItem] = useState<BundleFinding | null>(null)
  const recordNavigation = useRecordSequenceNavigation({
    registry: `prevention-${recordType}`,
    currentId: recordId,
    pathForId: (id: string) => `/prevention/${recordType}/${id}?fromTab=${recordType}`,
  })
  const addOns = membership?.capabilities ?? []
  const custom = membership?.customCapabilities ?? []
  const ownDepartment =
    membership?.previewDepartment || membership?.departmentName || (membership as { department?: string } | null)?.department || ''
  const departmentScoped = ([
    ROLES.DEPARTMENT_MANAGER,
    ROLES.DEPARTMENT_USER,
    ROLES.LINK_NURSE,
  ] as (string | null)[]).includes(role)
  const recordCapability = editCapabilities[recordType]
  const broadPreventionView = can(role, CAPABILITIES.VIEW_PREVENTION, [], custom)
  const recordTypeAccess =
    Boolean(recordCapability) &&
    (broadPreventionView || can(role, recordCapability, addOns, custom))
  const canEditRecord = Boolean(recordCapability) && can(role, recordCapability, addOns, custom)

  useEffect(() => {
    if (!recordTypeAccess) {
      setRecord(null)
      setLoading(false)
      return
    }
    if (creating) {
      setLoading(false)
      setRecord(null)
      return
    }
    const loader = loaders[recordType]
    if (!loader || !tenant?.id) {
      setRecord(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    loader(tenant?.id)
      .then(rows => {
        if (active) setRecord((rows.find(row => row.id === recordId) || null) as PreventionTabRow | null)
      })
      .catch((error: unknown) => {
        if (active) {
          setRecord(null)
          notifyError(error, 'load', { operation: `${recordType}_record_load` })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [creating, editing, recordType, recordId, tenant?.id, recordTypeAccess, notifyError])

  useEffect(() => {
    if (!tenant?.id || !recordTypeAccess) return
    let active = true
    if (recordType === 'handHygiene')
      loadHandHygieneDepartments(tenant?.id)
        .then(rows => {
          if (active) setHandDepartments(rows)
        })
        .catch(error => notifyError(error, 'load', { operation: 'hand_hygiene_departments_load' }))
    if (recordType === 'waste')
      loadWasteSupportData(tenant?.id)
        .then(data => {
          if (active) setWasteSupport(data)
        })
        .catch(error => notifyError(error, 'load', { operation: 'waste_support_load' }))
    if (recordType === 'antiseptics')
      loadAntisepticSupportData(tenant?.id)
        .then(data => {
          if (active) setAntisepticSupport(data)
        })
        .catch(error => notifyError(error, 'load', { operation: 'antiseptic_support_load' }))
    if (recordType === 'bundles')
      loadBundleSupportData(tenant?.id)
        .then(data => {
          if (active) setBundleSupport(data)
        })
        .catch(error => notifyError(error, 'load', { operation: 'bundle_support_load' }))
    return () => {
      active = false
    }
  }, [recordType, tenant?.id, recordTypeAccess, notifyError])

  if (!recordTypeAccess)
    return (
      <Page title={en ? 'Prevention Center' : 'Κέντρο Πρόληψης'}>
        <div className="inline-empty">
          {en
            ? 'You do not have access to this Prevention area.'
            : 'Δεν έχετε πρόσβαση σε αυτή την ενότητα της Πρόληψης.'}
        </div>
      </Page>
    )
  if (creating && !canEditRecord)
    return (
      <Page title={en ? 'Prevention Center' : 'Κέντρο Πρόληψης'}>
        <div className="inline-empty">
          {en
            ? 'You do not have permission to create this record.'
            : 'Δεν έχετε δικαίωμα δημιουργίας αυτής της εγγραφής.'}
        </div>
      </Page>
    )
  const recordInScope =
    creating ||
    !record ||
    canAccessRecord({ ...record, department: record.departmentEl || record.department })
  if (loading)
    return (
      <Page title={en ? 'Prevention Center' : 'Κέντρο Πρόληψης'}>
        <div className="inline-empty">{en ? 'Loading record…' : 'Φόρτωση εγγραφής…'}</div>
      </Page>
    )
  if (!creating && !record)
    return (
      <Page title={en ? 'Prevention Center' : 'Κέντρο Πρόληψης'}>
        <div className="inline-empty">{en ? 'Record not found.' : 'Δεν βρέθηκε η εγγραφή.'}</div>
      </Page>
    )
  if (!recordInScope)
    return (
      <Page title={en ? 'Prevention Center' : 'Κέντρο Πρόληψης'}>
        <div className="inline-empty">
          {en
            ? 'You do not have access to this record.'
            : 'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}
        </div>
      </Page>
    )

  const Icon = icons[recordType] || ShieldCheck
  const fmtDate = (value: string | null | undefined) => formatDay(value, language)
  const wasteCategory = record?.wasteType || record?.type
  const recordTitle = creating
    ? recordType === 'waste'
      ? en
        ? 'New waste measurement'
        : 'Νέα μέτρηση αποβλήτων'
      : recordType === 'antiseptics'
        ? en
          ? 'New antiseptic consumption'
          : 'Νέα κατανάλωση αντισηπτικού'
        : recordType === 'bundles'
          ? en
            ? 'New Bundle assessment'
            : 'Νέα αξιολόγηση δέσμης μέτρων'
          : en
            ? 'New WHO hand hygiene observation'
            : 'Νέα παρατήρηση Υγιεινής Χεριών WHO'
    : editing
      ? recordType === 'waste'
        ? `${en ? 'Edit waste measurement' : 'Επεξεργασία μέτρησης αποβλήτων'} · ${wastePeriodLabel(record, fmtDate)}`
        : recordType === 'antiseptics'
          ? `${en ? 'Edit antiseptic consumption' : 'Επεξεργασία κατανάλωσης αντισηπτικού'} · ${formatMonth(record?.period)}`
          : recordType === 'bundles'
            ? `${en ? 'Edit bundle assessment' : 'Επεξεργασία αξιολόγησης δέσμης μέτρων'} · ${fmtDate(record?.date || record?.period)}`
            : `${en ? 'Edit WHO hand hygiene observation' : 'Επεξεργασία παρατήρησης Υγιεινής Χεριών WHO'} · ${fmtDate(record?.date)}`
      : recordType === 'handHygiene'
        ? `${en ? 'WHO hand hygiene observation' : 'Παρατήρηση Υγιεινής Χεριών WHO'} · ${fmtDate(record?.date)}`
        : recordType === 'waste'
          ? `${en ? 'Waste measurement' : 'Μέτρηση αποβλήτων'} · ${wastePeriodLabel(record, fmtDate)}`
          : recordType === 'antiseptics'
            ? `${en ? 'Antiseptic consumption' : 'Κατανάλωση αντισηπτικού'} · ${formatMonth(record?.period)}`
            : `${en ? record?.templateName || record?.bundle : record?.templateTitle || record?.templateName || record?.bundle} · ${fmtDate(record?.date || record?.period)}`
  const subtitle =
    recordType === 'handHygiene'
      ? en
        ? 'WHO 5 Moments · Prevention & Infection Control'
        : '5 Στιγμές του ΠΟΥ · Πρόληψη & Έλεγχος Λοιμώξεων'
      : recordType === 'waste'
        ? en
          ? 'Waste management · Prevention & Infection Control'
          : 'Διαχείριση αποβλήτων · Πρόληψη & Έλεγχος Λοιμώξεων'
        : recordType === 'antiseptics'
          ? en
            ? 'Monthly antiseptic consumption · Prevention & Infection Control'
            : 'Κατανάλωση αντισηπτικών ανά μήνα ή έτος · Πρόληψη & Έλεγχος Λοιμώξεων'
          : recordType === 'bundles'
            ? en
              ? 'Prevention bundle assessment · all-or-none compliance'
              : 'Αξιολόγηση δέσμης μέτρων πρόληψης · συμμόρφωση «όλα ή τίποτα»'
            : undefined
  const recordStatus = !record ? null : recordType === 'waste' ? (
    <span className={`waste-category-badge ${wasteCategoryTone(wasteCategory)}`}>
      {en ? record.typeEn || wasteCategory : wasteCategory}
    </span>
  ) : recordType === 'antiseptics' ? (
    <StatusBadge
      tone={record.indicatorEligible !== false && isAbhrProduct(record) ? 'success' : 'info'}
    >
      {record.indicatorEligible !== false && isAbhrProduct(record)
        ? en
          ? 'ABHR · included in indicator'
          : 'ABHR · στον δείκτη'
        : en
          ? 'Outside ABHR indicator'
          : 'Εκτός δείκτη ABHR'}
    </StatusBadge>
  ) : recordType === 'bundles' ? (
    <StatusBadge tone={record.allOrNone ? 'success' : 'danger'}>
      {/* An icon, not «✕», which reads as a close button. */}
      {record.allOrNone ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}{' '}
      {record.allOrNone
        ? en
          ? 'Full compliance'
          : 'Πλήρης συμμόρφωση'
        : en
          ? 'Incomplete compliance'
          : 'Ελλιπής συμμόρφωση'}
    </StatusBadge>
  ) : null

  async function saveHandHygiene(updated: PreventionDraft<HandHygieneSession>) {
    if (!canEditRecord) return
    try {
      const saved = await saveHandHygieneSession(tenant!.id, updated, {
        existingId: creating ? null : record!.id,
      })
      if (saved) setRecord(saved as PreventionTabRow)
      if (creating) signalDemoScenario('hand_hygiene')
      notify(
        creating
          ? en
            ? 'Observation saved.'
            : 'Η παρατήρηση αποθηκεύτηκε.'
          : en
            ? 'Changes saved.'
            : 'Οι αλλαγές αποθηκεύτηκαν.',
        'success',
      )
      navigate(
        saved?.id
          ? `/prevention/handHygiene/${saved.id}?fromTab=handHygiene`
          : '/prevention?tab=handHygiene',
        { replace: true },
      )
    } catch (error) {
      notifyError(error, 'save', {
        operation: creating ? 'hand_hygiene_create' : 'hand_hygiene_record_update',
      })
      throw error
    }
  }
  async function saveWaste(updated: PreventionDraft<WasteMeasurement>) {
    if (!canEditRecord) return
    try {
      const saved = await saveWasteMeasurement(tenant!.id, updated, {
        existingId: creating ? null : record!.id,
      })
      if (saved) setRecord(saved as PreventionTabRow)
      notify(
        creating
          ? en
            ? 'Waste measurement saved.'
            : 'Η μέτρηση αποβλήτων αποθηκεύτηκε.'
          : en
            ? 'Changes saved.'
            : 'Οι αλλαγές αποθηκεύτηκαν.',
        'success',
      )
      navigate(
        saved?.id ? `/prevention/waste/${saved.id}?fromTab=waste` : '/prevention?tab=waste',
        { replace: true },
      )
    } catch (error) {
      notifyError(error, 'save', { operation: creating ? 'waste_create' : 'waste_record_update' })
      throw error
    }
  }
  async function saveAntiseptic(updated: PreventionDraft<AntisepticRecord>) {
    if (!canEditRecord) return
    try {
      const saved = await saveAntisepticRecord(tenant!.id, updated, {
        existingId: creating ? null : record!.id,
      })
      if (saved) setRecord(saved as PreventionTabRow)
      notify(
        creating
          ? en
            ? 'Antiseptic consumption saved.'
            : 'Η κατανάλωση αντισηπτικού αποθηκεύτηκε.'
          : en
            ? 'Changes saved.'
            : 'Οι αλλαγές αποθηκεύτηκαν.',
        'success',
      )
      navigate(
        saved?.id
          ? `/prevention/antiseptics/${saved.id}?fromTab=antiseptics`
          : '/prevention?tab=antiseptics',
        { replace: true },
      )
    } catch (error) {
      notifyError(error, 'save', {
        operation: creating ? 'antiseptic_create' : 'antiseptic_record_update',
      })
      throw error
    }
  }
  async function saveBundle(updated: BundleAssessmentDraft) {
    if (!canEditRecord) return
    try {
      const saved = await saveBundleAssessment(tenant!.id, updated, {
        existingId: creating ? null : record!.id,
      })
      if (saved) setRecord(saved as PreventionTabRow)
      notify(
        creating
          ? en
            ? 'Bundle assessment saved.'
            : 'Η αξιολόγηση δέσμης μέτρων αποθηκεύτηκε.'
          : en
            ? 'Changes saved.'
            : 'Οι αλλαγές αποθηκεύτηκαν.',
        'success',
      )
      if (creating && episodeBundle?.returnTo) {
        backToEpisode()
        return
      }
      navigate(
        saved?.id ? `/prevention/bundles/${saved.id}?fromTab=bundles` : '/prevention?tab=bundles',
        { replace: true },
      )
    } catch (error) {
      notifyError(error, 'save', { operation: creating ? 'bundle_create' : 'bundle_record_update' })
      throw error
    }
  }
  async function saveBundleFollowUpRecord(followUp: BundleFollowUp) {
    if (!canEditRecord || !bundleFollowUpItem) return
    try {
      const saved = await saveBundleFollowUp(tenant!.id, record!.id, bundleFollowUpItem!.id, followUp)
      if (saved) setRecord(saved as PreventionTabRow)
      setBundleFollowUpItem(null)
      notify(en ? 'Follow-up saved.' : 'Ο επανέλεγχος αποθηκεύτηκε.', 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'bundle_followup_save' })
      throw error
    }
  }

  async function deleteCurrent() {
    if (!canEditRecord) return
    const ok = await confirm({
      title: en ? 'Delete record' : 'Διαγραφή εγγραφής',
      message: en
        ? 'The record will be permanently deleted. Continue?'
        : 'Η εγγραφή θα διαγραφεί οριστικά. Θέλετε να συνεχίσετε;',
      confirmLabel: en ? 'Delete' : 'Διαγραφή',
      danger: true,
    })
    if (!ok) return
    try {
      await deleters[recordType]?.(tenant!.id, record!.id)
      notify(en ? 'Record deleted.' : 'Η εγγραφή διαγράφηκε.', 'success')
      navigate(`/prevention?tab=${recordType}`, { replace: true })
    } catch (error) {
      notifyError(error, 'delete', { operation: `${recordType}_record_delete` })
    }
  }
  const recordActions = (
    <>
      {!creating && !editing && canEditRecord && (
        <>
          {supportsPageEditor && (
            <ActionButton
              label={en ? 'Edit' : 'Επεξεργασία'}
              tone="edit"
              onClick={() =>
                navigate(`/prevention/${recordType}/${record!.id}?edit=1`, { replace: true })
              }
            >
              <Pencil size={16} />
              <span>{en ? 'Edit' : 'Επεξεργασία'}</span>
            </ActionButton>
          )}
          <ActionButton label={en ? 'Delete' : 'Διαγραφή'} tone="danger" onClick={deleteCurrent}>
            <Trash2 size={16} />
            <span>{en ? 'Delete' : 'Διαγραφή'}</span>
          </ActionButton>
        </>
      )}
      {!creating && (
        <ExportMenu onPrint={()=>window.print()} items={[{id:'json',kind:'data',label:'JSON',onClick:() => downloadRecordJson(record as Record<string, unknown> | null, { filename: record?.id })}]} />
      )}
    </>
  )
  const backToEpisode = () =>
    navigate(episodeBundle.returnTo, { replace: true, state: episodeBundle.returnState || { openTab: 'episodeForms' } })
  const backToList = () =>
    creating && episodeBundle?.returnTo ? backToEpisode() : navigate(`/prevention?tab=${recordType}`, { replace: true })
  const backToRecord = () =>
    navigate(`/prevention/${recordType}/${record!.id}?fromTab=${recordType}`, { replace: true })
  let editor = null
  if (recordType === 'handHygiene')
    editor = (
      <WhoHandHygieneEditor
        departments={handDepartments}
        initialRecord={editing ? record : null}
        fixedDepartment={departmentScoped ? ownDepartment : ''}
        onSave={saveHandHygiene}
      />
    )
  else if (recordType === 'waste')
    editor = (
      <WasteEntryEditor
        departments={wasteSupport.departments}
        wasteTypes={wasteSupport.wasteTypes}
        initialRecord={editing ? record : null}
        fixedDepartment={departmentScoped ? ownDepartment : ''}
        findPatientDays={(departmentId, from, to) =>
          findWastePatientDays(tenant!.id, departmentId, from, to)
        }
        onSave={saveWaste}
      />
    )
  else if (recordType === 'antiseptics')
    editor = (
      <AntisepticEntryEditor
        departments={antisepticSupport.departments}
        products={antisepticSupport.products}
        initialRecord={editing ? record : null}
        fixedDepartment={departmentScoped ? ownDepartment : ''}
        findPatientDays={(departmentId, from, to) =>
          findPatientDaysForPeriod(tenant!.id, departmentId, from, to)
        }
        onSave={saveAntiseptic}
      />
    )
  else if (recordType === 'bundles')
    editor = (
      <BundleExecutionEditor
        departments={bundleSupport.departments}
        templates={bundleSupport.templates}
        initialRecord={editing ? record : null}
        fixedDepartment={departmentScoped ? ownDepartment : ''}
        prefill={creating ? episodeBundle?.prefill || null : null}
        onSave={saveBundle}
      />
    )

  const recordTabs = [
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList },
    { id: 'attachments', label: en ? 'Documents' : 'Έγγραφα', icon: FolderOpen },
    { id: 'history', label: en ? 'History' : 'Ιστορικό', icon: FileClock },
  ]
  const recordHistory = [
    record?.createdAt && { at: record.createdAt, title: en ? 'Recorded' : 'Καταγραφή', detail: record.createdByName || record.responsible || record.observer || '' },
    record?.updatedAt && record.updatedAt !== record.createdAt && { at: record.updatedAt, title: en ? 'Last change' : 'Τελευταία αλλαγή', detail: record.updatedByName || '' },
    ...Object.values(record?.followUps || {}).map(item => item?.at && { at: item.at, title: en ? 'Re-check recorded' : 'Καταγραφή επανελέγχου', detail: item.note || '' }),
  ].filter(Boolean).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <Page fill>
      <EntityRecordShell
        className="prevention-record-shell workspace-fill"
        avatar={<Icon size={19} />}
        title={recordTitle}
        subtitle={subtitle}
        status={recordStatus}
        recordNavigation={creating || editing ? null : recordNavigation as RecordNavigation}
        headerActions={recordActions}
        tabs={creating || editing ? [] : recordTabs}
        activeTab={recordTab}
        onTabChange={setRecordTab}
        onBack={creating ? backToList : editing ? backToRecord : backToList}
      >
        {!creating && !editing && recordTab === 'attachments' ? (
          <DocumentsWorkspace
            title={en ? 'Documents' : 'Έγγραφα'}
            disabled={!canEditRecord}
            organizationId={isDemo ? null : tenant?.id}
            entityType={`prevention_${recordType}`}
            entityId={record?.id}
          />
        ) : !creating && !editing && recordTab === 'history' ? (
          <HistoryTimeline
            card
            title={en ? 'History' : 'Ιστορικό'}
            subtitle={en ? 'When the record was made and changed.' : 'Πότε καταγράφηκε και πότε άλλαξε η εγγραφή.'}
            events={recordHistory}
            when={value => formatDayTime(value, language)}
            emptyText={en ? 'No history yet.' : 'Δεν υπάρχει ιστορικό ακόμη.'}
          />
        ) : creating || editing ? (
          <div className="record-section prevention-record-card prevention-page-editor-card">
            {editor}
          </div>
        ) : (
          <div className="record-section prevention-record-card">
            {recordType === 'handHygiene' ? (
              <HandHygieneDetails record={record!} language={language} />
            ) : recordType === 'waste' ? (
              <WasteEntryEditor
                readOnly
                departments={wasteSupport.departments}
                wasteTypes={wasteSupport.wasteTypes}
                initialRecord={record}
              />
            ) : recordType === 'antiseptics' ? (
              <AntisepticDetails record={record!} language={language} locale={locale} />
            ) : (
              <BundleDetails
                record={record!}
                language={language}
                canEdit={canEditRecord}
                onFollowUp={setBundleFollowUpItem}
              />
            )}
          </div>
        )}
      </EntityRecordShell>
      {bundleFollowUpItem && (
        <BundleFollowUpDialog
          item={bundleFollowUpItem}
          value={record?.followUps?.[bundleFollowUpItem!.id]}
          onClose={() => setBundleFollowUpItem(null)}
          onSave={saveBundleFollowUpRecord}
        />
      )}
    </Page>
  )
}
