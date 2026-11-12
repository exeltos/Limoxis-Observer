import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { Button } from '../../design-system/Button'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { useRecordTabExport, type RecordTabProps } from './employeeTabExport'
import { employeeDocumentCategories, type AttachmentFile } from '../../design-system/AttachmentField'
import { loadAttachments } from '../../core/attachments/attachmentService'
import { loadEmployeeHistoryAsync } from './employeeHistoryService'
import { demoEmployeeDocuments } from './employeeDemoData'
import { loadTrainingState } from '../training/trainingData'
import {
  getEmployeeSurveillanceForEmployee,
  updateEmployeeSurveillanceRecord,
} from '../surveillance/employeeSurveillanceData'
import { EmployeeSurveillanceRecordDialog } from '../surveillance/EmployeeSurveillanceRecordDialog'
import { loadEmployeeSurveillanceRecordsForEmployee } from '../surveillance/employeeSurveillanceCloudService'
import { loadEmployeeSurveillanceSamples } from '../laboratory/laboratoryCloudService'
import { laboratorySamples as demoLaboratorySamples } from '../laboratory/laboratoryDemoData'
import {
  SectionTitle,
  Empty,
  State,
  Pager,
  RegistryFilter,
  useRegistryRows,
  statusClass,
  label,
  compactEpisodeCode,
} from './employeeRecordShared'
import './employeeRecordTabsRefinements.css'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import type { AnyRecord } from '../../types/featureTypes'
export {
  EmployeeHealthTab,
  EmployeeOccupationalTab,
  EmployeeVaccinationsTab,
  EmployeeExposureIncidentsTab,
} from './EmployeeHealthTabs'
export { EmployeeTrainingTab } from './EmployeeTrainingTab'
export { EmployeeEvaluationsTab } from './EmployeeEvaluationsTab'

export function EmployeeCertificatesTab({
  employee,
  language,
  organizationId,
  canEdit = false,
  isDemo = false,
  onExportItems,
}: RecordTabProps & { organizationId: string | null | undefined, canEdit?: boolean, isDemo?: boolean, fmt?: (value: unknown) => string }) {
  const en = language === 'en'
  const [demoFiles, setDemoFiles] = useState<AttachmentFile[]>(() =>
    isDemo
      ? demoEmployeeDocuments(employee, loadTrainingState().certificates, language === 'en')
      : [],
  )
  // The list of files for the print and the Excel (the files card keeps its own copy).
  const [cloudFiles, setCloudFiles] = useState<AnyRecord[]>([])
  useEffect(() => {
    if (isDemo || !organizationId) return undefined
    let active = true
    loadAttachments(organizationId, 'employee-certificate', employee.dbId || employee.id).then(rows => { if (active) setCloudFiles(rows || []) }).catch(() => { if (active) setCloudFiles([]) })
    return () => { active = false }
  }, [isDemo, organizationId, employee.dbId, employee.id])
  const files: AnyRecord[] = isDemo ? demoFiles : cloudFiles
  const categoryText = (code: string) => employeeDocumentCategories[en ? 'en' : 'el'].find(([value]) => value === code)?.[1] || code || ''
  const day = (value: string | number | null | undefined) => (value ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR').format(new Date(value)) : '')
  const exportDialog = useRecordTabExport({
    onExportItems, id: 'documents', label: { el: 'Έγγραφα', en: 'Documents' }, employee, language, count: files.length,
    table: () => ({ headers: en ? ['Document', 'Kind', 'Notes', 'Added'] : ['Έγγραφο', 'Είδος', 'Σημειώσεις', 'Καταχώριση'], rows: files.map(file => [file.name, categoryText(file.category), file.description || '', day(file.createdAt)]) }),
  })
  return (
    <>
    {exportDialog}
    <DocumentsWorkspace
      title={language === 'en' ? 'Documents & certifications' : 'Έγγραφα & Πιστοποιήσεις'}
      subtitle={
        language === 'en'
          ? 'Licences, certifications and training certificates of the employee.'
          : 'Άδειες, πιστοποιήσεις και πιστοποιητικά εκπαίδευσης του εργαζομένου.'
      }
      disabled={!canEdit}
      organizationId={isDemo ? null : organizationId}
      entityType="employee-certificate"
      entityId={employee.dbId || employee.id}
      value={isDemo ? demoFiles : undefined}
      onChange={isDemo ? setDemoFiles : undefined}
    />
    </>
  )
}

export function EmployeeSurveillanceTab({
  employee,
  t,
  language,
  fmt,
  version,
  onNew,
  readOnly = false,
  isDemo = false,
  organizationId = null,
  canManageFollowup = false,
  onExportItems,
}: RecordTabProps & { t: (key: string) => string, fmt: (value: unknown) => string, version: number, onNew: () => void, readOnly?: boolean, isDemo?: boolean, organizationId?: string | null, canManageFollowup?: boolean }) {
  const demoRows = isDemo ? getEmployeeSurveillanceForEmployee(employee.id) : []
  const [cloudRecords, setCloudRecords] = useState<AnyRecord[]>([])
  const [cloudSamples, setCloudSamples] = useState<AnyRecord[]>([])
  const [selected, setSelected] = useState<AnyRecord | null>(null)
  const [loading, setLoading] = useState(!isDemo)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [reloadToken, setReloadToken] = useState(0)
  useEffect(() => {
    if (isDemo || !organizationId || !employee?.dbId) {
      setLoading(false)
      setLoadError(null)
      return
    }
    let active = true
    setLoading(true)
    setLoadError(null)
    // Only this employee's episodes, then only the samples linked to them.
    loadEmployeeSurveillanceRecordsForEmployee(organizationId, employee.dbId)
      .then(async rows => {
        const records = rows.filter((row: AnyRecord) => row.employeeDbId === employee.dbId)
        return [records, await loadEmployeeSurveillanceSamples(organizationId, records.map((row: AnyRecord) => row.recordId))]
      })
      .then(([records, samples]) => {
        if (!active) return
        setCloudRecords(records)
        setCloudSamples(samples)
      })
      .catch(error => {
        if (active) {
          setCloudRecords([])
          setCloudSamples([])
          setLoadError(error)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isDemo, organizationId, employee?.dbId, version, reloadToken])
  const rows = isDemo ? demoRows : cloudRecords
  const registry = useRegistryRows(rows)
  const paging = registry.paging
  const exportDialog = useRecordTabExport({
    onExportItems, id: 'surveillance', label: { el: 'Επιτήρηση', en: 'Surveillance' }, employee, language, count: registry.filtered.length,
    table: () => ({ headers: language === 'en' ? ['Episode', 'Start date', 'Screening', 'Status'] : ['Επεισόδιο', 'Έναρξη', 'Έλεγχος', 'Κατάσταση'], rows: registry.filtered.map((row: AnyRecord) => [compactEpisodeCode(row.id), fmt(row.startedAt), row.screeningTypes?.map((type: string) => label(type, t)).join(', ') || '', label(row.status, t)]) }),
  })
  if (loadError)
    return (
      <section className="record-section record-secondary-registry">
        <SectionTitle
          title={language === 'en' ? 'Surveillance' : 'Επιτήρηση'}
          subtitle={
            language === 'en'
              ? 'Employee screening episodes and their linked laboratory samples.'
              : 'Επεισόδια επιτήρησης εργαζομένου και τα συνδεδεμένα εργαστηριακά δείγματα.'
          }
        />
        <div className="data-access-state error">
          <span>
            {language === 'en'
              ? 'Could not load employee surveillance data.'
              : 'Δεν ήταν δυνατή η φόρτωση των δεδομένων επιτήρησης του εργαζομένου.'}
          </span>
          <Button variant="secondary" onClick={() => setReloadToken(value => value + 1)}>
            {language === 'en' ? 'Retry' : 'Επανάληψη'}
          </Button>
        </div>
      </section>
    )
  const selectedSamples = selected
    ? isDemo
      ? demoLaboratorySamples.filter(sample => sample.employeeSurveillanceCase === selected.id)
      : cloudSamples.filter(sample => sample.employeeSurveillanceId === selected.recordId)
    : []
  const saveDemoFollowup = (record: AnyRecord, patch: AnyRecord) =>
    Promise.resolve(
      updateEmployeeSurveillanceRecord(record.id, {
        ...patch,
        updatedAt: new Date().toISOString(),
      }),
    )
  return (
    <section className="record-section record-secondary-registry">
      {exportDialog}
      <SectionTitle
        title={language === 'en' ? 'Surveillance' : 'Επιτήρηση'}
        subtitle={
          language === 'en'
            ? 'Employee screening episodes and their linked laboratory samples.'
            : 'Επεισόδια επιτήρησης εργαζομένου και τα συνδεδεμένα εργαστηριακά δείγματα.'
        }
        action={
          !readOnly && (
            <ActionButton tone="primary" label={t('newScreening')} onClick={onNew}>
              <Plus size={15} />
              <span>{t('newScreening')}</span>
            </ActionButton>
          )
        }
      />
      {!loading && (
        <RegistryFilter
          query={registry.query}
          setQuery={registry.setQuery}
          language={language}
          count={registry.filtered.length}
        />
      )}{' '}
      {loading ? (
        <TableSkeleton/>
      ) : registry.filtered.length ? (
        <>
          <div className="scroll-table">
            <table className="data-table sticky-table record-table-clickable">
              <thead>
                <tr>
                  <th>{language === 'en' ? 'Episode' : 'Επεισόδιο'}</th>
                  <th>{language === 'en' ? 'Start date' : 'Έναρξη'}</th>
                  <th>{language === 'en' ? 'Screening' : 'Έλεγχος'}</th>
                  <th>{language === 'en' ? 'Status' : 'Κατάσταση'}</th>
                </tr>
              </thead>
              <tbody>
                {paging.paged.map((row: AnyRecord) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => setSelected(row)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelected(row)
                      }
                    }}
                  >
                    <td>
                      <strong className="employee-code-compact" title={row.id}>
                        {compactEpisodeCode(row.id)}
                      </strong>
                    </td>
                    <td>{fmt(row.startedAt)}</td>
                    <td>{row.screeningTypes?.map((type: string) => label(type, t)).join(', ') || '—'}</td>
                    <td>
                      <span className={`status-badge ${statusClass(row.status)}`}>
                        {label(row.status, t)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager paging={paging} total={registry.filtered.length} language={language} />
        </>
      ) : (
        <Empty
          language={language}
          title={
            language === 'en' ? 'No surveillance episodes' : 'Δεν υπάρχουν επεισόδια επιτήρησης'
          }
        />
      )}{' '}
      {/* The dialog (surveillance, still JS) types its samples from an empty default. */}
      {selected && (
        <EmployeeSurveillanceRecordDialog
          organizationId={organizationId}
          record={selected}
          samples={selectedSamples as never[]}
          canManage={canManageFollowup}
          t={t}
          language={language}
          fmt={fmt}
          onClose={() => setSelected(null)}
          onSaveFollowup={isDemo ? saveDemoFollowup : undefined}
          onUpdated={(updated: AnyRecord) => {
            if (!isDemo)
              setCloudRecords(current =>
                current.map(row => (row.recordId === updated.recordId ? updated : row)),
              )
            setSelected(updated)
          }}
        />
      )}
    </section>
  )
}

export function EmployeeHistoryTab({ employee, language, onExportItems }: RecordTabProps) {
  const state = useEmployeeSubRecords(
    loadEmployeeHistoryAsync,
    employee.organizationId,
    employee.dbId,
    employee.id,
  )
  const fallback: AnyRecord[] = []
  if (employee.createdAt)
    fallback.push({
      id: 'legacy-created',
      action: 'insert',
      at: employee.createdAt,
      actorName: '',
      actorRole: '',
      changedFields: [],
    })
  if (employee.updatedAt && employee.updatedAt !== employee.createdAt)
    fallback.push({
      id: 'legacy-updated',
      action: 'update',
      at: employee.updatedAt,
      actorName: '',
      actorRole: '',
      changedFields: [],
    })
  const rows = (state.data.length ? state.data : fallback)
    .slice()
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
  const registry = useRegistryRows(rows)
  const paging = registry.paging
  const format = (value: string | null | undefined) => {
    if (!value) return '—'
    const d = new Date(value)
    return Number.isNaN(d.getTime())
      ? '—'
      : new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', {
          dateStyle: 'medium',
          timeStyle: 'short', hourCycle: 'h23',
        }).format(d)
  }
  const eventLabel = (action: string) =>
    action === 'insert'
      ? language === 'en'
        ? 'Employee record created'
        : 'Δημιουργία καρτέλας εργαζομένου'
      : action === 'delete'
        ? language === 'en'
          ? 'Employee record deleted'
          : 'Διαγραφή καρτέλας εργαζομένου'
        : language === 'en'
          ? 'Employee record updated'
          : 'Ενημέρωση καρτέλας εργαζομένου'
  const fieldLabels: Record<string, string[]> = {
    employee_code: ['Κωδικός εργαζομένου', 'Employee code'],
    department_id: ['Τμήμα', 'Department'],
    department_name: ['Τμήμα', 'Department'],
    department_name_en: ['Τμήμα (EN)', 'Department (EN)'],
    first_name: ['Όνομα', 'First name'],
    first_name_en: ['Όνομα (EN)', 'First name (EN)'],
    last_name: ['Επώνυμο', 'Last name'],
    last_name_en: ['Επώνυμο (EN)', 'Last name (EN)'],
    father_name: ['Πατρώνυμο', 'Father name'],
    profession_name: ['Ιδιότητα', 'Profession'],
    profession_name_en: ['Ιδιότητα (EN)', 'Profession (EN)'],
    employment_status: ['Κατάσταση εργασίας', 'Employment status'],
    email: ['Email', 'Email'],
    phone: ['Τηλέφωνο', 'Phone'],
    hire_date: ['Ημερομηνία πρόσληψης', 'Hire date'],
    birth_date: ['Ημερομηνία γέννησης', 'Birth date'],
    user_id: ['Σύνδεση λογαριασμού', 'Account link'],
  }
  // A related record (training, visit, vaccination…) is stored as «history_<kind>:<detail>»: the detail is shown as is.
  const changedLabel = (fields: string[]) =>
    fields?.length
      ? fields.map((key: string) => (String(key).startsWith('history_') ? relatedText(String(key)) : fieldLabels[key]?.[language === 'en' ? 1 : 0] || key)).join(' · ')
      : '—'
  const visitTypes: Record<string, string[]> = { periodic: ['Περιοδική εξέταση', 'Periodic examination'], preEmployment: ['Προπρόσληψη εξέταση', 'Pre-employment examination'], followUp: ['Επανέλεγχος', 'Follow-up'], vaccinationReview: ['Έλεγχος εμβολιασμού', 'Vaccination review'] }
  const relatedText = (key: string) => {
    const detail = key.split(':').slice(1).join(':')
    if (key.startsWith('history_occupational:')) return visitTypes[detail]?.[language === 'en' ? 1 : 0] || detail || '—'
    return detail || '—'
  }
  const kindLabels: Record<string, string[]> = {
    training: ['Εκπαίδευση', 'Training'],
    evaluation: ['Αξιολόγηση', 'Evaluation'],
    occupational: ['Ιατρός Εργασίας', 'Occupational health'],
    vaccination: ['Εμβολιασμός', 'Vaccination'],
    certificate: ['Έγγραφο / πιστοποίηση', 'Document / certification'],
    surveillance: ['Επιτήρηση', 'Surveillance'],
  }
  const rowLabel = (row: AnyRecord) => kindLabels[row.historyKind]?.[language === 'en' ? 1 : 0] || eventLabel(row.action)
  // Related records carry a day, not a time (their «12:00» is only a placeholder).
  const formatRow = (row: AnyRecord) => (kindLabels[row.historyKind] ? formatDay(row.at) : format(row.at))
  const formatDay = (value: string | null | undefined) => {
    const d = new Date(value || '')
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { dateStyle: 'medium' }).format(d)
  }
  const actorLabel = (row: AnyRecord) =>
    row.actorName
      ? `${row.actorName}${row.actorRole ? ` · ${row.actorRole.replaceAll('_', ' ')}` : ''}`
      : '—'
  const exportDialog = useRecordTabExport({
    onExportItems, id: 'history', label: { el: 'Ιστορικό', en: 'History' }, employee, language, count: registry.filtered.length,
    table: () => ({ headers: language === 'en' ? ['Event', 'Details', 'User', 'Date'] : ['Είδος', 'Περιγραφή', 'Χρήστης', 'Ημερομηνία'], rows: registry.filtered.map((row: AnyRecord) => [rowLabel(row), row.action === 'update' ? changedLabel(row.changedFields) : '', row.actorName ? actorLabel(row) : '', formatRow(row)]) }),
  })
  return (
    <section className="record-section record-secondary-registry">
      {exportDialog}
      <SectionTitle
        title={language === 'en' ? 'History' : 'Ιστορικό'}
        subtitle={
          language === 'en'
            ? 'Changes to the record and the employee\'s training, visits and evaluations, newest first.'
            : 'Αλλαγές της καρτέλας και οι εκπαιδεύσεις, επισκέψεις και αξιολογήσεις του εργαζομένου, τα νεότερα πρώτα.'
        }
      />
      <State {...state} language={language} onRetry={state.reload} />
      {!state.loading && !state.error && (
        <RegistryFilter
          query={registry.query}
          setQuery={registry.setQuery}
          language={language}
          count={registry.filtered.length}
        />
      )}
      {!state.loading &&
        !state.error &&
        (registry.filtered.length ? (
          <>
            <div className="scroll-table">
              <table className="data-table sticky-table">
                <thead>
                  <tr>
                    <th>{language === 'en' ? 'Event' : 'Είδος'}</th>
                    <th>{language === 'en' ? 'Details' : 'Περιγραφή'}</th>
                    <th>{language === 'en' ? 'User' : 'Χρήστης'}</th>
                    <th>{language === 'en' ? 'Date / time' : 'Ημερομηνία / ώρα'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paging.paged.map((row: AnyRecord) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{rowLabel(row)}</strong>
                      </td>
                      <td>{row.action === 'update' ? changedLabel(row.changedFields) : '—'}</td>
                      <td>{actorLabel(row)}</td>
                      <td>{formatRow(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paging={paging} total={registry.filtered.length} language={language} />
          </>
        ) : (
          <Empty
            language={language}
            title={
              language === 'en'
                ? 'No lifecycle history is available'
                : 'Δεν υπάρχει διαθέσιμο ιστορικό καρτέλας'
            }
          />
        ))}
    </section>
  )
}
