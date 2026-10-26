import { SectionHeader } from '../../design-system/SectionHeader'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RecordMetricStrip } from '../../design-system/RecordMetricStrip'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useEffect, useState } from 'react'
import { ClipboardCheck, Droplets, Pencil, Recycle, ShieldCheck, Trash2 } from 'lucide-react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { ExportMenu } from '../../design-system/ExportMenu'
import { downloadRecordJson } from '../../core/export/recordExport'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { WHO_MOMENTS, WHO_PROFESSIONS, WhoHandHygieneEditor } from './WhoHandHygieneEditor'
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
import { wasteCategoryTone } from './wasteVisuals'
import { ActionButton } from '../../design-system/ActionButton'
import { antisepticMethodLabel, isAbhrProduct } from './antisepticMethods'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { CAPABILITIES, ROLES, can } from '../../core/permissions/roles'
import { normalizeWhoMoments, sessionHandHygieneStats } from './whoHandHygieneStats'

const icons = {
  handHygiene: ShieldCheck,
  waste: Recycle,
  antiseptics: Droplets,
  bundles: ClipboardCheck,
}
const loaders = {
  handHygiene: loadHandHygieneSessions,
  waste: loadWasteMeasurements,
  antiseptics: loadAntisepticRecords,
  bundles: loadBundleAssessments,
}
const deleters = {
  handHygiene: deleteHandHygieneSession,
  waste: deleteWasteMeasurement,
  antiseptics: deleteAntisepticRecord,
  bundles: deleteBundleAssessment,
}
const editCapabilities = {
  handHygiene: CAPABILITIES.RECORD_HAND_HYGIENE,
  waste: CAPABILITIES.RECORD_WASTE,
  antiseptics: CAPABILITIES.RECORD_ANTISEPTIC,
  bundles: CAPABILITIES.RECORD_PREVENTION_BUNDLE,
}

export function PreventionRecordPage() {
  const { recordType, recordId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // A check opened from a device of an episode (Φόρμες & ερωτηματολόγια): it returns there.
  const episodeBundle = recordType === 'bundles' ? location.state?.episodeBundle || null : null
  const [searchParams] = useSearchParams()
  const { locale, language } = useLanguage()
  const en = language === 'en'
  const { notifyError, notify, confirm } = useFeedback()
  const { canAccessRecord, tenant, role, membership } = useTenant()
  const supportsPageEditor = ['handHygiene', 'waste', 'antiseptics', 'bundles'].includes(recordType)
  const creating = supportsPageEditor && recordId === 'new'
  const editing = supportsPageEditor && !creating && searchParams.get('edit') === '1'
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(!creating)
  const [handDepartments, setHandDepartments] = useState([])
  const [wasteSupport, setWasteSupport] = useState({ departments: [], wasteTypes: [] })
  const [antisepticSupport, setAntisepticSupport] = useState({ departments: [], products: [] })
  const [bundleSupport, setBundleSupport] = useState({ departments: [], templates: [] })
  const [bundleFollowUpItem, setBundleFollowUpItem] = useState(null)
  const recordNavigation = useRecordSequenceNavigation({
    registry: `prevention-${recordType}`,
    currentId: recordId,
    pathForId: id => `/prevention/${recordType}/${id}?fromTab=${recordType}`,
  })
  const addOns = membership?.capabilities ?? []
  const custom = membership?.customCapabilities ?? []
  const ownDepartment =
    membership?.previewDepartment || membership?.departmentName || membership?.department || ''
  const departmentScoped = [
    ROLES.DEPARTMENT_MANAGER,
    ROLES.DEPARTMENT_USER,
    ROLES.LINK_NURSE,
  ].includes(role)
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
    loader(tenant.id)
      .then(rows => {
        if (active) setRecord(rows.find(row => row.id === recordId) || null)
      })
      .catch(error => {
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
      loadHandHygieneDepartments(tenant.id)
        .then(rows => {
          if (active) setHandDepartments(rows)
        })
        .catch(error => notifyError(error, 'load', { operation: 'hand_hygiene_departments_load' }))
    if (recordType === 'waste')
      loadWasteSupportData(tenant.id)
        .then(data => {
          if (active) setWasteSupport(data)
        })
        .catch(error => notifyError(error, 'load', { operation: 'waste_support_load' }))
    if (recordType === 'antiseptics')
      loadAntisepticSupportData(tenant.id)
        .then(data => {
          if (active) setAntisepticSupport(data)
        })
        .catch(error => notifyError(error, 'load', { operation: 'antiseptic_support_load' }))
    if (recordType === 'bundles')
      loadBundleSupportData(tenant.id)
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
  const fmtDate = value => formatDay(value, language)
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
        ? `${en ? 'Edit waste measurement' : 'Επεξεργασία μέτρησης αποβλήτων'} · ${fmtDate(record?.date)}`
        : recordType === 'antiseptics'
          ? `${en ? 'Edit antiseptic consumption' : 'Επεξεργασία κατανάλωσης αντισηπτικού'} · ${formatMonth(record?.period)}`
          : recordType === 'bundles'
            ? `${en ? 'Edit bundle assessment' : 'Επεξεργασία αξιολόγησης δέσμης μέτρων'} · ${fmtDate(record?.date || record?.period)}`
            : `${en ? 'Edit WHO hand hygiene observation' : 'Επεξεργασία παρατήρησης Υγιεινής Χεριών WHO'} · ${fmtDate(record?.date)}`
      : recordType === 'handHygiene'
        ? `${en ? 'WHO hand hygiene observation' : 'Παρατήρηση Υγιεινής Χεριών WHO'} · ${fmtDate(record?.date)}`
        : recordType === 'waste'
          ? `${en ? 'Waste measurement' : 'Μέτρηση αποβλήτων'} · ${fmtDate(record?.date)}`
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
            : 'Μηνιαία κατανάλωση αντισηπτικών · Πρόληψη & Έλεγχος Λοιμώξεων'
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
      {record.allOrNone
        ? en
          ? 'All-or-none ✓'
          : 'Πλήρης συμμόρφωση ✓'
        : en
          ? 'All-or-none ✕'
          : 'Ελλιπής συμμόρφωση ✕'}
    </StatusBadge>
  ) : null

  async function saveHandHygiene(updated) {
    if (!canEditRecord) return
    try {
      const saved = await saveHandHygieneSession(tenant.id, updated, {
        existingId: creating ? null : record.id,
      })
      if (saved) setRecord(saved)
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
  async function saveWaste(updated) {
    if (!canEditRecord) return
    try {
      const saved = await saveWasteMeasurement(tenant.id, updated, {
        existingId: creating ? null : record.id,
      })
      if (saved) setRecord(saved)
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
  async function saveAntiseptic(updated) {
    if (!canEditRecord) return
    try {
      const saved = await saveAntisepticRecord(tenant.id, updated, {
        existingId: creating ? null : record.id,
      })
      if (saved) setRecord(saved)
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
  async function saveBundle(updated) {
    if (!canEditRecord) return
    try {
      const saved = await saveBundleAssessment(tenant.id, updated, {
        existingId: creating ? null : record.id,
      })
      if (saved) setRecord(saved)
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
  async function saveBundleFollowUpRecord(followUp) {
    if (!canEditRecord || !bundleFollowUpItem) return
    try {
      const saved = await saveBundleFollowUp(tenant.id, record.id, bundleFollowUpItem.id, followUp)
      if (saved) setRecord(saved)
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
      await deleters[recordType]?.(tenant.id, record.id)
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
                navigate(`/prevention/${recordType}/${record.id}?edit=1`, { replace: true })
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
        <ExportMenu onPrint={()=>window.print()} items={[{id:'json',kind:'data',label:'JSON',onClick:() => downloadRecordJson(record, { filename: record?.id })}]} />
      )}
    </>
  )
  const backToEpisode = () =>
    navigate(episodeBundle.returnTo, { replace: true, state: episodeBundle.returnState || { openTab: 'episodeForms' } })
  const backToList = () =>
    creating && episodeBundle?.returnTo ? backToEpisode() : navigate(`/prevention?tab=${recordType}`, { replace: true })
  const backToRecord = () =>
    navigate(`/prevention/${recordType}/${record.id}?fromTab=${recordType}`, { replace: true })
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
          findWastePatientDays(tenant.id, departmentId, from, to)
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
          findPatientDaysForPeriod(tenant.id, departmentId, from, to)
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

  return (
    <Page fill>
      <EntityRecordShell
        className="prevention-record-shell workspace-fill"
        avatar={<Icon size={19} />}
        title={recordTitle}
        subtitle={subtitle}
        status={recordStatus}
        recordNavigation={creating || editing ? null : recordNavigation}
        headerActions={recordActions}
        tabs={[]}
        onBack={creating ? backToList : editing ? backToRecord : backToList}
      >
        {creating || editing ? (
          <div className="record-section prevention-record-card prevention-page-editor-card">
            {editor}
          </div>
        ) : (
          <div className="record-section prevention-record-card">
            {recordType === 'handHygiene' ? (
              <HandHygieneDetails record={record} language={language} />
            ) : recordType === 'waste' ? (
              <WasteEntryEditor
                readOnly
                departments={wasteSupport.departments}
                wasteTypes={wasteSupport.wasteTypes}
                initialRecord={record}
              />
            ) : recordType === 'antiseptics' ? (
              <AntisepticDetails record={record} language={language} locale={locale} />
            ) : (
              <BundleDetails
                record={record}
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
          value={record?.followUps?.[bundleFollowUpItem.id]}
          onClose={() => setBundleFollowUpItem(null)}
          onSave={saveBundleFollowUpRecord}
        />
      )}
    </Page>
  )
}

const formatMonth = value =>
  /^\d{4}-\d{2}$/.test(String(value || ''))
    ? `${value.slice(5, 7)}/${value.slice(0, 4)}`
    : value || ''

// Prevention records share one layout: the context as a details sheet, the key
// figures as a metric strip, then the record's own list under a section header.
function HandHygieneDetails({ record, language }) {
  const en = language === 'en'
  const items = record.whoObservations || []
  const stats = sessionHandHygieneStats(record)
  const session = record.session || {}
  const actionLabel = item =>
    item.action === 'HR'
      ? en
        ? 'Alcohol-based hand rub'
        : 'Αλκοολούχο αντισηπτικό'
      : item.action === 'HW'
        ? en
          ? 'Hand wash with soap & water'
          : 'Πλύσιμο με σαπούνι & νερό'
        : en
          ? 'Not performed'
          : 'Δεν πραγματοποιήθηκε'
  const profession = item => {
    const p = WHO_PROFESSIONS.find(([el]) => el === item.professionalCategory)
    return p ? (en ? p[1] : p[0]) : item.professionalCategory || '—'
  }
  return (
    <div className="record-view-stack">
      <section>
        <SectionHeader title={en ? 'Observation session' : 'Στοιχεία παρατήρησης'} />
        <RecordDetailsGrid
          fields={[
            {
              id: 'date',
              label: en ? 'Date' : 'Ημερομηνία',
              value: formatDay(record.date || session.date, language),
            },
            {
              id: 'department',
              label: en ? 'Department' : 'Τμήμα',
              value: record.departmentEl || session.department,
            },
            {
              id: 'observer',
              label: en ? 'Observer' : 'Παρατηρητής',
              value: record.observer || session.observer,
            },
            {
              id: 'time',
              label: en ? 'Time' : 'Ώρα',
              value: `${session.startTime || '—'} – ${session.endTime || '—'}`,
            },
          ]}
        />
      </section>
      <RecordMetricStrip
        items={[
          {
            id: 'compliance',
            primary: true,
            label: en ? 'WHO compliance' : 'Συμμόρφωση WHO',
            value: `${stats.compliance}%`,
            note: `${stats.compliant || 0} / ${stats.opportunities || 0} ${en ? 'compliant opportunities' : 'συμμορφούμενες ευκαιρίες'}`,
          },
          {
            id: 'opportunities',
            label: en ? 'Opportunities' : 'Ευκαιρίες',
            value: stats.opportunities,
          },
          {
            id: 'professionals',
            label: en ? 'Professionals' : 'Επαγγελματίες',
            value: stats.professionals,
          },
          { id: 'hr', label: en ? 'Hand rub' : 'Αντισηπτικό', value: stats.handRub || 0 },
          { id: 'hw', label: en ? 'Hand wash' : 'Πλύσιμο', value: stats.handWash || 0 },
          {
            id: 'missed',
            tone: stats.missed ? 'danger' : undefined,
            label: en ? 'Not performed' : 'Μη συμμορφούμενες',
            value: stats.missed || 0,
          },
        ]}
      />
      <section>
        <SectionHeader
          title={en ? 'Recorded opportunities' : 'Καταγεγραμμένες ευκαιρίες'}
          subtitle={en ? 'WHO 5 Moments' : '5 Στιγμές του ΠΟΥ'}
          actions={<StatusBadge>{items.length}</StatusBadge>}
        />
        <RegistryTable
          className="who-record-table"
          columns={[
            { key: 'index', label: '#' },
            { key: 'professional', label: en ? 'Professional' : 'Επαγγελματίας' },
            { key: 'moments', label: en ? 'WHO indication' : 'Ένδειξη WHO' },
            { key: 'action', label: en ? 'Action' : 'Ενέργεια' },
            { key: 'gloves', label: en ? 'Gloves' : 'Γάντια' },
            { key: 'note', label: en ? 'Note' : 'Σημείωση' },
          ]}
          rows={items}
          rowKey={(item, index) => item.id || index}
          emptyTitle={en ? 'No opportunities recorded' : 'Δεν καταγράφηκαν ευκαιρίες'}
          renderRow={(item, index) => (
            <>
              <td>{index + 1}</td>
              <td>
                <strong>
                  {item.professionalsCount || 1} × {profession(item)}
                </strong>
              </td>
              <td>
                <div className="who-record-moments-cell">
                  {normalizeWhoMoments(item).map(id => {
                    const m = WHO_MOMENTS.find(x => x.id === id)
                    return (
                      <StatusBadge key={id}>
                        {id.replace('moment', '')} ·{' '}
                        {m
                          ? en
                            ? m.labelEn.replace(/^\d+\.\s*/, '')
                            : m.label.replace(/^\d+\.\s*/, '')
                          : id}
                      </StatusBadge>
                    )
                  })}
                </div>
              </td>
              <td>
                <StatusBadge tone={item.action === 'MISSED' ? 'danger' : 'success'}>
                  {actionLabel(item)}
                </StatusBadge>
              </td>
              <td>{item.gloves ? (en ? 'Yes' : 'Ναι') : en ? 'No' : 'Όχι'}</td>
              <td>{item.notes || '—'}</td>
            </>
          )}
        />
      </section>
    </div>
  )
}

function AntisepticDetails({ record, language, locale }) {
  const en = language === 'en'
  return (
    <div className="record-view-stack">
      <section>
        <SectionHeader
          title={en ? 'Monthly consumption' : 'Μηνιαία κατανάλωση'}
        />
        <RecordDetailsGrid
          fields={[
            { id: 'period', label: en ? 'Period' : 'Περίοδος', value: formatMonth(record.period) },
            { id: 'department', label: en ? 'Department' : 'Τμήμα', value: record.departmentEl },
            {
              id: 'product',
              label: en ? 'Product' : 'Προϊόν',
              value: en ? record.productEn || record.product : record.product,
            },
            {
              id: 'method',
              label: en ? 'Source / method' : 'Πηγή / μέθοδος',
              value: antisepticMethodLabel(record.method, language),
            },
            {
              id: 'reference',
              label: en ? 'Reference / document' : 'Αναφορά / παραστατικό',
              value: record.referenceNumber,
            },
            {
              id: 'responsible',
              label: en ? 'Responsible' : 'Υπεύθυνος',
              value: record.responsible,
            },
            {
              id: 'notes',
              className: 'is-wide',
              label: en ? 'Notes' : 'Σημειώσεις',
              value: record.notes,
              hidden: !record.notes,
            },
          ]}
        />
      </section>
      <RecordMetricStrip
        items={[
          {
            id: 'litres',
            label: en ? 'Consumption' : 'Κατανάλωση',
            value: Number(record.litres).toLocaleString(locale),
            unit: 'L',
          },
          {
            id: 'days',
            label: en ? 'Patient-days' : 'Νοσηλευτικές ημέρες',
            value: record.patientDays || '—',
          },
          {
            id: 'indicator',
            primary: true,
            label: en ? 'ABHR indicator' : 'Δείκτης ABHR',
            value: record.indicator != null ? Number(record.indicator).toLocaleString(locale) : '—',
            note: en ? 'L / 1,000 patient-days' : 'L / 1.000 νοσηλευτικές ημέρες',
          },
        ]}
      />
    </div>
  )
}

const SHIFT_LABELS = {
  morning: ['Πρωινή', 'Morning'],
  afternoon: ['Απογευματινή', 'Afternoon'],
  evening: ['Απογευματινή', 'Evening'],
  night: ['Νυχτερινή', 'Night'],
}
function shiftLabel(value, en) {
  const pair = SHIFT_LABELS[value]
  return pair ? (en ? pair[1] : pair[0]) : value || '—'
}
// Corrected, still open, no longer applicable, or not reviewed yet.
const FOLLOW_UP_TONES = { resolved: 'success', open: 'danger', not_applicable: 'neutral' }
export const bundleFollowUpTone = status => FOLLOW_UP_TONES[status] || 'warning'
function BundleDetails({ record, language, canEdit, onFollowUp }) {
  const en = language === 'en'
  const template = record.templateSnapshot || {}
  const elements = template.elements || []
  const findings =
    record.findings ||
    elements
      .filter(([id]) => record.answers?.[id] === 'no')
      .map(([id, label]) => ({ id, label, note: record.answerNotes?.[id] || '' }))
  const followUpLabel = status =>
    status === 'resolved'
      ? en
        ? 'Corrected'
        : 'Διορθώθηκε'
      : status === 'open'
        ? en
          ? 'Still pending'
          : 'Παραμένει'
        : status === 'not_applicable'
          ? en
            ? 'No longer applicable'
            : 'Δεν εφαρμόζεται πλέον'
          : en
            ? 'Pending review'
            : 'Προς επανέλεγχο'
  return (
    <div className="record-view-stack bundle-record-view">
      <section>
        <SectionHeader
          title={en ? record.templateName || template.name || record.bundle : record.templateTitle || template.title || record.templateName || template.name || record.bundle}
          subtitle={`${record.templateSource || template.source || ''} · v${record.templateVersion || template.version || '1.0'}`}
        />
        <RecordDetailsGrid
          className="record-details-cols-6"
          fields={[
            {
              id: 'date',
              label: en ? 'Date' : 'Ημερομηνία',
              value: formatDay(record.date || record.period, language),
            },
            { id: 'department', label: en ? 'Department' : 'Τμήμα', value: record.departmentEl },
            { id: 'shift', label: en ? 'Shift' : 'Βάρδια', value: shiftLabel(record.shift, en) },
            { id: 'owner', label: en ? 'Responsible' : 'Υπεύθυνος', value: record.owner },
            { id: 'patient', label: en ? 'Patient' : 'Ασθενής', value: record.patientRef },
            { id: 'device', label: en ? 'Device' : 'Συσκευή', value: record.deviceRef },
            {
              id: 'notes',
              className: 'is-wide',
              label: en ? 'Notes' : 'Σημειώσεις',
              value: record.generalNotes,
              hidden: !record.generalNotes,
            },
          ]}
        />
      </section>
      <RecordMetricStrip
        items={[
          {
            id: 'score',
            primary: true,
            label: en ? 'Score' : 'Βαθμολογία',
            value: record.score == null ? '—' : `${record.score}%`,
          },
          {
            id: 'applicable',
            label: en ? 'Applicable' : 'Εφαρμόσιμα',
            value: record.applicableCount ?? '—',
          },
          {
            id: 'deviations',
            tone: (record.failedCount ?? findings.length) ? 'danger' : undefined,
            label: en ? 'Deviations' : 'Αποκλίσεις',
            value: record.failedCount ?? findings.length,
          },
        ]}
      />
      <section className="bundle-record-elements">
        <SectionHeader title={en ? 'Bundle results' : 'Αποτελέσματα δέσμης μέτρων'} />
        <div className="bundle-detail-list">
          {elements.map(([id, label], index) => {
            const value = record.answers?.[id]
            return (
              <div
                className={`bundle-detail-row ${value === 'no' ? 'failed' : value === 'yes' ? 'passed' : 'na'}`}
                key={id}
              >
                <span className="bundle-detail-index">{index + 1}</span>
                <strong>{label}</strong>
                <span className="bundle-detail-answer">
                  {value === 'yes'
                    ? en
                      ? 'Yes'
                      : 'Ναι'
                    : value === 'no'
                      ? en
                        ? 'No'
                        : 'Όχι'
                      : value === 'na'
                        ? en
                          ? 'N/A'
                          : 'Μ/Ε'
                        : '—'}
                </span>
                {value === 'no' && record.answerNotes?.[id] && (
                  <small>{record.answerNotes[id]}</small>
                )}
              </div>
            )
          })}
        </div>
      </section>
      {findings.length > 0 && (
        <section className="bundle-record-findings">
          <SectionHeader
            title={en ? 'Items for follow-up' : 'Σημεία για επανέλεγχο'}
            subtitle={
              en
                ? 'Review each deviation and record whether it was corrected, remains open or no longer applies.'
                : 'Επανελέγξτε κάθε απόκλιση και καταγράψτε αν διορθώθηκε, παραμένει ή δεν εφαρμόζεται πλέον.'
            }
          />
          {findings.map(item => {
            const followUp = record.followUps?.[item.id]
            return (
              <div
                className={`bundle-record-finding bundle-followup-${followUp?.status || 'pending'}`}
                key={item.id}
              >
                <div className="bundle-followup-copy">
                  <strong>{item.label}</strong>
                  <span>
                    {item.note ||
                      (en
                        ? 'Investigation / corrective action required.'
                        : 'Απαιτείται διερεύνηση / διορθωτική ενέργεια.')}
                  </span>
                  {followUp?.comment && <small>{followUp.comment}</small>}
                </div>
                <div className="bundle-followup-meta">
                  <StatusBadge tone={bundleFollowUpTone(followUp?.status)}>
                    {followUpLabel(followUp?.status)}
                  </StatusBadge>
                  {followUp?.date && (
                    <small>
                      {en ? 'Review date' : 'Ημ. επανελέγχου'}: {formatDay(followUp.date, language)}
                    </small>
                  )}
                  {followUp?.reviewedBy && (
                    <small>
                      {en ? 'Reviewed by' : 'Επανέλεγχος από'}: {followUp.reviewedBy}
                    </small>
                  )}
                  {canEdit && (
                    <Button variant="secondary" onClick={() => onFollowUp?.(item)}>
                      {followUp
                        ? en
                          ? 'Edit follow-up'
                          : 'Επεξεργασία επανελέγχου'
                        : en
                          ? 'Follow-up'
                          : 'Επανέλεγχος'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
